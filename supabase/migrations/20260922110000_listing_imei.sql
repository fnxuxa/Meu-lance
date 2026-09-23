-- MeuLance: IMEI obrigatório em celulares.
--  * validado (15 dígitos + dígito verificador Luhn) e gravado só pela RPC enquanto rascunho;
--  * privado: vendedor vê o próprio; comprador só depois do pagamento; moderação sempre;
--  * retenção: apagado 20 dias (app_config.imei_retention_days) após o pedido terminar
--    (concluído ou reembolsado). A limpeza de anúncios espera o IMEI ser apagado antes.
insert into public.app_config(key, value) values
  ('imei_required_categories', '["celulares"]'),
  ('imei_retention_days', '20')
on conflict (key) do nothing;

create or replace function public.imei_is_valid(p text) returns boolean language plpgsql immutable as $$
declare s int := 0; d int; i int;
begin
  if p is null or p !~ '^[0-9]{15}$' then return false; end if;
  for i in 1..15 loop
    d := substr(p, 16 - i, 1)::int;           -- da direita para a esquerda
    if i % 2 = 0 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
  end loop;
  return s % 10 = 0;
end $$;

create table public.listing_imeis(
  listing_id uuid primary key references public.listings(id) on delete cascade,
  imei text not null check (public.imei_is_valid(imei)),
  created_at timestamptz not null default now()
);
alter table public.listing_imeis enable row level security;
create policy "imei seller, paid buyer or staff" on public.listing_imeis for select to authenticated using (
  public.is_staff()
  or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  or exists (select 1 from public.orders o where o.listing_id = listing_imeis.listing_id and o.buyer_id = auth.uid()
             and o.status in ('paid','awaiting_shipment','shipped','delivered','completed','disputed')));
revoke all on public.listing_imeis from anon;
revoke insert, update, delete on public.listing_imeis from authenticated;

create or replace function public._imei_required(p_category uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.categories c, public.app_config a
     where c.id = p_category and a.key = 'imei_required_categories' and a.value ? c.slug)
$$;

create or replace function public.set_listing_imei(p_listing uuid, p_imei text) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings; v text := regexp_replace(coalesce(p_imei, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.status <> 'draft' then raise exception 'LISTING_LOCKED'; end if;
  if not public.imei_is_valid(v) then raise exception 'INVALID_IMEI'; end if;
  insert into public.listing_imeis(listing_id, imei) values (l.id, v)
    on conflict (listing_id) do update set imei = excluded.imei, created_at = now();
end $$;
revoke all on function public.set_listing_imei(uuid, text) from public, anon;
grant execute on function public.set_listing_imei(uuid, text) to authenticated;
revoke all on function public._imei_required(uuid) from public, anon, authenticated;

-- Publicação: mesmas regras de 20260922100000 + IMEI nas categorias exigidas.
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
  if public._imei_required(l.category_id) and not exists (select 1 from public.listing_imeis where listing_id = l.id) then
    raise exception 'IMEI_REQUIRED';
  end if;
  return public._publish_listing_v7(p_listing, p_duration_days);
end $$;
revoke all on function public.publish_listing(uuid, int, boolean) from public, anon;
grant execute on function public.publish_listing(uuid, int, boolean) to authenticated;

-- Retenção: apaga IMEI de pedidos terminados há mais de N dias, sem pedido em andamento.
create or replace function public.purge_expired_imeis() returns integer
language plpgsql security definer set search_path = public as $$
declare days int; n int;
begin
  select (value #>> '{}')::int into days from public.app_config where key = 'imei_retention_days';
  days := greatest(coalesce(days, 20), 1);
  delete from public.listing_imeis i
   where exists (select 1 from public.orders o where o.listing_id = i.listing_id
                  and o.status in ('completed','refunded')
                  and coalesce(o.completed_at, o.updated_at) < now() - make_interval(days => days))
     and not exists (select 1 from public.orders o where o.listing_id = i.listing_id
                      and o.status not in ('completed','refunded','cancelled','payment_expired'));
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'imeis_purged', 'system', null, jsonb_build_object('count', n, 'retention_days', days));
  end if;
  return n;
end $$;
revoke all on function public.purge_expired_imeis() from public, anon, authenticated;
grant execute on function public.purge_expired_imeis() to service_role;
