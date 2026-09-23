-- MeuLance: relatório de estado do item.
--  * checklist de funcionamento por categoria (config em app_config, respostas no anúncio);
--  * fotos marcadas como "defeito";
--  * venda "no estado" (condition = 'for_parts'): comprador precisa aceitar antes de dar lance
--    e a disputa por "danificado" não se aplica (o item já é vendido como pode não funcionar).
-- As respostas entram no snapshot da disputa para comparar "declarado x recebido".

-- Perguntas redigidas para que "Sim" = em ordem. Respostas: yes | no | untested | na.
insert into public.app_config(key, value) values ('condition_checklists', $json${
  "celulares": [
    {"key":"powers_on","label":"Liga e funciona normalmente"},
    {"key":"screen_ok","label":"Tela sem trincas, manchas ou toque falhando"},
    {"key":"battery_ok","label":"Bateria segura carga normalmente"},
    {"key":"cameras_ok","label":"Câmeras funcionam"},
    {"key":"biometrics_ok","label":"Biometria / Face ID funciona"},
    {"key":"account_free","label":"Sem bloqueio de conta (iCloud/Google) ou operadora"},
    {"key":"charging_ok","label":"Carrega pelo conector"}
  ],
  "pc-games": [
    {"key":"powers_on","label":"Liga e funciona normalmente"},
    {"key":"stable","label":"Sem superaquecimento ou travamentos em uso prolongado"},
    {"key":"ports_ok","label":"Todas as portas e entradas funcionam"},
    {"key":"accessories_ok","label":"Controles e acessórios inclusos funcionam"},
    {"key":"never_mined","label":"Nunca usado para mineração (placas de vídeo)"},
    {"key":"never_repaired","label":"Sem sinais de abertura ou reparo"}
  ],
  "eletronicos": [
    {"key":"powers_on","label":"Liga e funciona normalmente"},
    {"key":"display_ok","label":"Imagem sem manchas, linhas ou pixels mortos"},
    {"key":"sound_ok","label":"Som funciona"},
    {"key":"ports_ok","label":"Todas as entradas funcionam"},
    {"key":"accessories_ok","label":"Controle remoto e acessórios inclusos"}
  ],
  "casa": [
    {"key":"structure_ok","label":"Estrutura firme, sem quebras"},
    {"key":"works_ok","label":"Funciona normalmente (se for elétrico)"},
    {"key":"surface_ok","label":"Sem manchas, rasgos ou mofo"},
    {"key":"parts_ok","label":"Todas as peças e acessórios presentes"}
  ],
  "ferramentas": [
    {"key":"powers_on","label":"Liga e funciona normalmente"},
    {"key":"no_play","label":"Sem folgas ou ruídos anormais"},
    {"key":"battery_ok","label":"Bateria e carregador inclusos funcionam"},
    {"key":"accessories_ok","label":"Acessórios presentes"}
  ],
  "esportes": [
    {"key":"frame_ok","label":"Quadro / estrutura sem trincas ou soldas"},
    {"key":"brakes_ok","label":"Freios funcionam"},
    {"key":"gears_ok","label":"Câmbio / marchas funcionam"},
    {"key":"tires_ok","label":"Pneus e câmaras em condição de uso"}
  ],
  "instrumentos": [
    {"key":"playable","label":"Todas as notas / teclas / trastes funcionam"},
    {"key":"body_ok","label":"Sem trincas no corpo ou braço"},
    {"key":"electronics_ok","label":"Parte elétrica (captadores, saída) funciona"},
    {"key":"tuning_ok","label":"Segura afinação normalmente"}
  ],
  "colecionaveis": [
    {"key":"complete","label":"Completo, sem peças faltando"},
    {"key":"no_damage","label":"Sem danos, descolamentos ou desbotamento"},
    {"key":"original_box","label":"Acompanha embalagem original"}
  ],
  "_default": [
    {"key":"works_ok","label":"Funciona normalmente"},
    {"key":"structure_ok","label":"Sem danos estruturais"},
    {"key":"parts_ok","label":"Peças e acessórios presentes"}
  ]
}$json$::jsonb)
on conflict (key) do nothing;

alter table public.listings add column if not exists condition_checklist jsonb;
alter table public.listing_images add column if not exists is_defect boolean not null default false;
grant insert (is_defect) on public.listing_images to authenticated;

create or replace function public._checklist_items(p_category uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(c.value -> (select slug from public.categories where id = p_category), c.value -> '_default')
       from public.app_config c where c.key = 'condition_checklists'),
    '[]'::jsonb)
$$;

create or replace function public._validate_checklist(p_category uuid, p_checklist jsonb) returns void
language plpgsql stable security definer set search_path = public as $$
declare items jsonb := public._checklist_items(p_category);
begin
  if jsonb_array_length(items) = 0 then return; end if;
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'object' then raise exception 'CHECKLIST_REQUIRED'; end if;
  if exists (select 1 from jsonb_array_elements(items) i
              where coalesce(p_checklist ->> (i ->> 'key'), '') not in ('yes','no','untested','na'))
  then raise exception 'CHECKLIST_INCOMPLETE'; end if;
  if exists (select 1 from jsonb_object_keys(p_checklist) k
              where not exists (select 1 from jsonb_array_elements(items) i where i ->> 'key' = k))
  then raise exception 'CHECKLIST_INVALID'; end if;
end $$;

-- O vendedor grava as respostas só enquanto o anúncio é rascunho.
create or replace function public.set_listing_condition_report(p_listing uuid, p_checklist jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.status <> 'draft' then raise exception 'LISTING_LOCKED'; end if;
  perform public._validate_checklist(l.category_id, p_checklist);
  update public.listings set condition_checklist = p_checklist where id = l.id;
end $$;

-- Publicação: além das regras anteriores, exige checklist válido e prova visual dos defeitos.
create or replace function public.publish_listing(p_listing uuid, p_duration_days int, p_declaration_accepted boolean default false)
returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; has_problem boolean; has_defects boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and identity_verified_at is not null) then
    raise exception 'IDENTITY_NOT_VERIFIED';
  end if;
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  if l.status = 'active' then return l; end if;
  if p_declaration_accepted then update listings set declaration_accepted_at = clock_timestamp() where id = l.id returning * into l; end if;
  if l.declaration_accepted_at is null then raise exception 'DECLARATION_REQUIRED'; end if;
  if (select count(*) from public.listing_images where listing_id = l.id) < 3 then raise exception 'MIN_IMAGES'; end if;
  if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;

  perform public._validate_checklist(l.category_id, l.condition_checklist);
  has_problem := exists (select 1 from jsonb_each_text(coalesce(l.condition_checklist, '{}'::jsonb)) where value = 'no');
  has_defects := nullif(trim(coalesce(l.defects_declared, '')), '') is not null;
  if (has_problem or l.condition = 'for_parts') and not has_defects then raise exception 'DEFECTS_DESCRIPTION_REQUIRED'; end if;
  if (has_problem or has_defects or l.condition = 'for_parts')
     and not exists (select 1 from public.listing_images where listing_id = l.id and is_defect) then
    raise exception 'DEFECT_PHOTO_REQUIRED';
  end if;
  return public._publish_listing_v7(p_listing, p_duration_days);
end $$;
revoke all on function public.publish_listing(uuid, int, boolean) from public, anon;
grant execute on function public.publish_listing(uuid, int, boolean) to authenticated;
revoke all on function public._checklist_items(uuid), public._validate_checklist(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_listing_condition_report(uuid, jsonb) from public, anon;
grant execute on function public.set_listing_condition_report(uuid, jsonb) to authenticated;

-- ───────── venda "no estado" ─────────
create table public.as_is_acknowledgments(
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
alter table public.as_is_acknowledgments enable row level security;
create policy "as-is own read" on public.as_is_acknowledgments for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.as_is_acknowledgments from anon, authenticated;
revoke select on public.as_is_acknowledgments from anon;

create or replace function public.acknowledge_as_is(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.listings where id = p_listing;
  if not found or l.status <> 'active' then raise exception 'AUCTION_ENDED'; end if;
  if l.condition <> 'for_parts' then raise exception 'NOT_AS_IS'; end if;
  insert into public.as_is_acknowledgments(listing_id, user_id) values (l.id, auth.uid()) on conflict do nothing;
end $$;
revoke all on function public.acknowledge_as_is(uuid) from public, anon;
grant execute on function public.acknowledge_as_is(uuid) to authenticated;

-- Vale para lance manual e lance automático (ambos passam por aqui).
create or replace function public._lock_bidding(p_listing uuid) returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.status <> 'active' or l.ends_at is null or l.ends_at <= clock_timestamp() or l.starts_at > clock_timestamp() then raise exception 'AUCTION_ENDED'; end if;
  if l.seller_id = uid then raise exception 'SELLER_CANNOT_BID'; end if;
  if l.condition = 'for_parts' and not exists (select 1 from public.as_is_acknowledgments where listing_id = l.id and user_id = uid) then
    raise exception 'AS_IS_ACK_REQUIRED';
  end if;
  return l;
end $$;
revoke all on function public._lock_bidding(uuid) from public, anon, authenticated;

-- Disputa: snapshot inclui estado e checklist; "danificado" não se aplica a item vendido no estado.
create or replace function public.disputes_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare cond text;
begin
  select l.condition into cond from public.orders o join public.listings l on l.id = o.listing_id where o.id = new.order_id;
  if cond = 'for_parts' and new.reason = 'damaged' then raise exception 'AS_IS_REASON_NOT_ALLOWED'; end if;
  select jsonb_build_object('title', l.title, 'description', l.description, 'defects_declared', l.defects_declared,
                            'condition', l.condition, 'condition_checklist', l.condition_checklist,
                            'amount_cents', o.amount_cents, 'captured_at', now())
    into new.snapshot from public.orders o join public.listings l on l.id = o.listing_id where o.id = new.order_id;
  return new;
end $$;
