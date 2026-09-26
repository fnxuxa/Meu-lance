-- Proteção contra negociação fora da plataforma (2 camadas).
-- Camada 2: filtro de contato no chat do pedido, com registro das tentativas (nível 1: só padrões inequívocos).
-- Camada 1: nome completo e endereço da contraparte só depois do pagamento; apelido público sem sobrenome.

-- ───────── detector (nível 1) ─────────
-- Devolve o tipo de padrão ('phone','email','link','app') ou NULL. Não bloqueia palavras comuns como
-- "celular" ou "número" (o produto vende celulares); só telefone, e-mail, link e apps de contato.
create or replace function public.contact_pattern(t text) returns text language plpgsql immutable as $$
declare
  low text; mapped text; squashed text; m text[]; n int;
  sep constant text := '[ ().\-_*+]*';
begin
  if t is null then return null; end if;
  low := translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  -- e-mail e link
  if low ~ '[a-z0-9._%+-]+ ?@ ?[a-z0-9.-]+\.[a-z]{2,}' or low ~ '\marroba\M' then return 'email'; end if;
  if low ~ '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|me|app|link)(\.br)?\M)' then return 'link'; end if;
  -- telefone: sequência de 8 a 13 dígitos (com separadores), inclusive com letra no lugar de dígito
  for pass in 1..2 loop
    if pass = 1 then
      mapped := low;
    else
      -- 2ª passada só vale se o texto já tem ao menos 5 dígitos reais (evita palavras)
      if length(regexp_replace(low, '\D', '', 'g')) < 5 then exit; end if;
      mapped := translate(low, 'oli|', '0111');
    end if;
    for m in select regexp_matches(mapped, '((?:[0-9]' || sep || '){8,})', 'g') loop
      n := length(regexp_replace(m[1], '\D', '', 'g'));
      if n between 8 and 13 then return 'phone'; end if;
    end loop;
  end loop;
  -- apps de contato, inclusive espaçados/pontuados e com números no lugar de letras
  squashed := regexp_replace(translate(low, '4031@5', 'aoeias'), '[^a-z]', '', 'g');
  if squashed ~ '(whatsap|zapzap|telegram|discord|instagram)' then return 'app'; end if;
  if low ~ '\m(zap|wpp|whats|whatsapp|insta|zapzap|telegram|discord|instagram)\M' then return 'app'; end if;
  if low ~ '\m(z[ ._*-]+a[ ._*-]+p|w[ ._*-]+p[ ._*-]+p)\M' then return 'app'; end if;
  return null;
end $$;

-- ───────── registro de tentativas (só a equipe lê; ninguém grava direto) ─────────
create table public.chat_flagged_attempts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  body text not null,
  pattern text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_flagged_attempts enable row level security;
create index chat_flagged_attempts_created_idx on public.chat_flagged_attempts(created_at desc);
create index chat_flagged_attempts_user_idx on public.chat_flagged_attempts(user_id, created_at desc);
create policy "staff read chat flags" on public.chat_flagged_attempts for select using (public.is_staff());
revoke all on public.chat_flagged_attempts from anon, authenticated;
grant select on public.chat_flagged_attempts to authenticated;

-- Pedido "liberado": pagamento processado. Lista branca (estado novo nasce bloqueado).
create or replace function public.order_contact_released(p_status text) returns boolean language sql immutable as $$
  select p_status in ('paid','awaiting_shipment','shipped','delivered','completed','disputed','resolved_buyer','resolved_seller')
$$;

-- Trava final (também vale para INSERT direto): mesma regra, por lista branca.
create or replace function public.guard_order_message() returns trigger language plpgsql security definer set search_path=public as $$
declare o public.orders;
begin
 select * into o from orders where id=new.order_id for update;
 if auth.uid() is null or auth.uid() not in(o.buyer_id,o.seller_id) or new.sender_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
 if new.body is null or char_length(trim(new.body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
 if not order_contact_released(o.status) and contact_pattern(new.body) is not null then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
 return new;
end $$;

-- Envio pelo servidor: valida, registra a tentativa bloqueada e responde sem lançar exceção
-- (uma exceção desfaria o registro). Não pune ninguém: só bloqueia e registra.
create or replace function public.send_order_message(p_order_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; b text := trim(coalesce(p_body,'')); pat text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from orders where id = p_order_id;
  if not found or auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'FORBIDDEN'; end if;
  if char_length(b) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  if not order_contact_released(o.status) then
    pat := contact_pattern(b);
    if pat is not null then
      insert into chat_flagged_attempts(user_id, order_id, listing_id, body, pattern)
      values (auth.uid(), o.id, o.listing_id, b, pat);
      return jsonb_build_object('ok', false, 'code', 'CONTACT_SHARING_BLOCKED');
    end if;
  end if;
  insert into order_messages(order_id, sender_id, body) values (o.id, auth.uid(), b);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.send_order_message(uuid, text) from public, anon;
grant execute on function public.send_order_message(uuid, text) to authenticated;
-- Cliente não insere mais direto (senão burlaria o registro); o trigger segue como segunda barreira.
revoke insert on public.order_messages from authenticated;
revoke insert (order_id, sender_id, body) on public.order_messages from authenticated;

-- Lista para a equipe, mais recentes primeiro.
create or replace function public.staff_list_chat_flags(p_limit int default 100) returns table(
  id uuid, created_at timestamptz, user_id uuid, user_name text, order_id uuid, listing_id uuid,
  listing_title text, listing_slug text, pattern text, body text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'FORBIDDEN'; end if;
  return query
    select f.id, f.created_at, f.user_id, p.display_name, f.order_id, f.listing_id, l.title, l.slug, f.pattern, f.body
    from chat_flagged_attempts f
    join profiles p on p.id = f.user_id
    left join listings l on l.id = f.listing_id
    order by f.created_at desc limit least(greatest(p_limit,1), 500);
end $$;
revoke all on function public.staff_list_chat_flags(int) from public, anon;
grant execute on function public.staff_list_chat_flags(int) to authenticated;

-- ───────── Camada 1: dados da contraparte só após o pagamento ─────────
-- Devolve nome completo e endereço (nunca telefone/e-mail/CPF). O endereço do vendedor só vai
-- se o anúncio permite retirada; o do comprador vai ao vendedor para o envio.
create or replace function public.get_order_counterparty(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders; l public.listings; other uuid; p public.profiles; seller_side boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from orders where id = p_order_id;
  if not found or auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'FORBIDDEN'; end if;
  if not order_contact_released(o.status) then return jsonb_build_object('released', false); end if;
  select * into l from listings where id = o.listing_id;
  seller_side := auth.uid() = o.seller_id;
  other := case when seller_side then o.buyer_id else o.seller_id end;
  select * into p from profiles where id = other;
  return jsonb_build_object(
    'released', true,
    'full_name', coalesce(p.full_name, p.display_name),
    'address', case when seller_side or l.delivery_mode in ('pickup','both') then jsonb_build_object(
      'zip', p.address_zip, 'street', p.address_street, 'number', p.address_number,
      'complement', p.address_complement, 'neighborhood', p.address_neighborhood,
      'city', p.city, 'state', p.state) end);
end $$;
revoke all on function public.get_order_counterparty(uuid) from public, anon;
grant execute on function public.get_order_counterparty(uuid) to authenticated;

-- ───────── apelido público sem sobrenome ("Maria S.") ─────────
create or replace function public.short_display_name(t text) returns text language sql immutable as $$
  select case
    when array_length(regexp_split_to_array(trim(t), '\s+'), 1) >= 2 then
      left((regexp_split_to_array(trim(t), '\s+'))[1], 30) || ' ' ||
      upper(left((regexp_split_to_array(trim(t), '\s+'))[array_length(regexp_split_to_array(trim(t), '\s+'), 1)], 1)) || '.'
    else left(trim(t), 40) end
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare n text; f text;
begin
  f := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''));
  n := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), f, split_part(new.email, '@', 1));
  if n is null or char_length(n) < 2 then n := 'Usuário'; end if;
  n := short_display_name(n);
  insert into public.profiles(id, display_name, full_name, email_verified_at)
  values (new.id, left(n, 40), f, new.email_confirmed_at)
  on conflict (id) do nothing;
  insert into public.notification_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- Perfis existentes cujo apelido público é o nome completo digitado no cadastro.
update public.profiles set display_name = short_display_name(display_name)
where display_name ~ '\s' and (full_name is null or display_name = full_name);
