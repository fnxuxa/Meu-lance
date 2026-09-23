-- MeuLance: oferta ao 2º colocado (opcional, escolhida pelo vendedor ao criar o anúncio).
-- Se o vencedor não paga no prazo, o pedido expira e, com a opção ligada, o 2º maior lance
-- recebe uma oferta pelo valor do próprio maior lance, com prazo para aceitar (padrão 24h).
-- Aceitar não é obrigatório. Só existe uma oferta por anúncio.
-- A expiração de pedidos só roda com payments_live = true: sem pagamento real ninguém consegue pagar.

insert into public.app_config(key, value) values ('second_chance_hours', '24') on conflict (key) do nothing;

alter table public.listings add column if not exists second_chance_enabled boolean not null default false;
grant update (second_chance_enabled) on public.listings to authenticated;

-- Um leilão pode ter mais de um pedido (o expirado e o do 2º colocado), mas só um "vivo".
alter table public.orders drop constraint if exists orders_listing_id_key;
create unique index orders_one_live_per_listing on public.orders(listing_id)
  where status not in ('payment_expired', 'cancelled');

create table public.second_chance_offers(
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  expired_order_id uuid not null references public.orders(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  expires_at timestamptz not null,
  order_id uuid references public.orders(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.second_chance_offers enable row level security;
create policy "offer bidder, seller or staff" on public.second_chance_offers for select to authenticated using (
  auth.uid() = bidder_id or public.is_staff()
  or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
revoke all on public.second_chance_offers from anon;
revoke insert, update, delete on public.second_chance_offers from authenticated;

-- Comissão do vendedor e taxa do comprador calculadas num só lugar.
create or replace function public._order_fees(p_amount bigint, out fee bigint, out buyer_fee bigint)
language plpgsql stable security definer set search_path = public as $$
declare bps int; buyer_bps int;
begin
  select (value #>> '{}')::int into bps from public.app_config where key = 'commission_bps';
  select (value #>> '{}')::int into buyer_bps from public.app_config where key = 'buyer_fee_bps';
  bps := case when bps between 0 and 10000 then bps else 500 end;
  buyer_bps := case when buyer_bps between 0 and 10000 then buyer_bps else 300 end;
  fee := round(p_amount * bps / 10000.0);
  buyer_fee := round(p_amount * buyer_bps / 10000.0);
end $$;

create or replace function public._payment_deadline() returns timestamptz
language sql stable security definer set search_path = public as $$
  select now() + make_interval(hours => coalesce((select (value #>> '{}')::int from public.app_config where key = 'payment_deadline_hours'), 48))
$$;

-- Fechamento: mesmo comportamento de 20260922101000, com o conflito no índice parcial.
create or replace function public.close_due_auctions() returns integer language plpgsql security definer set search_path = public as $$
declare r public.listings; n integer := 0; leader uuid; f record; oid uuid;
begin
  for r in select * from public.listings where status = 'active' and ends_at <= now() for update skip locked loop
    select bidder_id into leader from public.auction_leaders where listing_id = r.id;
    if leader is null then
      update public.listings set status = 'ended_no_bids' where id = r.id;
      perform public._notify(r.seller_id, 'system', 'Leilão encerrado sem lances',
        '"' || r.title || '" terminou sem lances. Relance com 1 clique — um valor inicial menor costuma atrair os primeiros lances.',
        '/conta/anuncios');
    else
      update public.listings set status = 'ended_with_winner' where id = r.id;
      select * into f from public._order_fees(r.current_price_cents);
      oid := null;
      insert into public.orders(listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_net_cents, buyer_fee_cents, status, payment_due_at)
        values (r.id, leader, r.seller_id, r.current_price_cents, f.fee, r.current_price_cents - f.fee, f.buyer_fee, 'pending_payment', public._payment_deadline())
        on conflict (listing_id) where status not in ('payment_expired', 'cancelled') do nothing
        returning id into oid;
      if oid is not null then
        perform public._notify(leader, 'won', 'Você venceu!', 'Você arrematou "' || r.title || '". Conclua o pagamento no prazo.', '/pedido/' || oid);
        perform public._notify(r.seller_id, 'order', 'Seu item foi arrematado', '"' || r.title || '" recebeu um lance vencedor.', '/pedido/' || oid);
        insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
          values (null, 'auction_closed', 'listing', r.id::text,
                  jsonb_build_object('amount_cents', r.current_price_cents, 'buyer_fee_cents', f.buyer_fee, 'order_id', oid));
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.close_due_auctions() from public, anon, authenticated;
grant execute on function public.close_due_auctions() to service_role;

create or replace function public._offer_second_chance(p_order public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings; r record; hours int;
begin
  select * into l from public.listings where id = p_order.listing_id;
  if not found or not l.second_chance_enabled then return; end if;
  if exists (select 1 from public.second_chance_offers where listing_id = l.id) then return; end if;
  select b.bidder_id, max(b.amount_cents) as amount into r
    from public.bids b join public.profiles p on p.id = b.bidder_id and p.banned_at is null
   where b.listing_id = l.id and b.bidder_id <> p_order.buyer_id
   group by b.bidder_id order by max(b.amount_cents) desc, min(b.sequence_no) asc limit 1;
  if not found then
    perform public._notify(l.seller_id, 'order', 'Sem 2º colocado',
      'O vencedor de "' || l.title || '" não pagou e não há outro participante para receber a oferta.', '/conta/vendas');
    return;
  end if;
  select (value #>> '{}')::int into hours from public.app_config where key = 'second_chance_hours';
  insert into public.second_chance_offers(listing_id, expired_order_id, bidder_id, amount_cents, expires_at)
    values (l.id, p_order.id, r.bidder_id, r.amount, now() + make_interval(hours => coalesce(hours, 24)));
  perform public._notify(r.bidder_id, 'order', 'Oferta de segunda chance',
    'O vencedor de "' || l.title || '" não pagou. O item pode ser seu pelo valor do seu maior lance. Responda em até '
    || coalesce(hours, 24) || 'h.', '/conta/compras');
  perform public._notify(l.seller_id, 'order', 'Oferta enviada ao 2º colocado',
    'O vencedor de "' || l.title || '" não pagou. Oferecemos o item ao 2º colocado.', '/conta/vendas');
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (null, 'second_chance_offered', 'listing', l.id::text, jsonb_build_object('bidder_id', r.bidder_id, 'amount_cents', r.amount));
end $$;

-- Job: expira ofertas vencidas e pedidos não pagos (este último só com pagamento real ligado).
create or replace function public.expire_unpaid_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare o public.orders; s record; n int := 0;
begin
  for s in update public.second_chance_offers set status = 'expired', responded_at = now()
            where status = 'pending' and expires_at <= now() returning listing_id loop
    perform public._notify(l.seller_id, 'order', 'Oferta ao 2º colocado expirou',
      'O 2º colocado não respondeu à oferta de "' || l.title || '".', '/conta/vendas')
      from public.listings l where l.id = s.listing_id;
  end loop;
  if coalesce((select value #>> '{}' from public.app_config where key = 'payments_live'), 'false') <> 'true' then return 0; end if;
  for o in select * from public.orders where status = 'pending_payment' and payment_due_at <= now() for update skip locked loop
    update public.orders set status = 'payment_expired', cancel_reason = 'payment_deadline' where id = o.id;
    update public.profiles set strikes_count = strikes_count + 1 where id = o.buyer_id;
    insert into public.audit_log(actor_id, action, entity_type, entity_id) values (null, 'order_payment_expired', 'order', o.id::text);
    perform public._notify(o.buyer_id, 'order', 'Prazo de pagamento expirou',
      'Você não pagou o pedido no prazo. O pedido foi cancelado e sua conta recebeu uma advertência.', '/pedido/' || o.id);
    perform public._notify(o.seller_id, 'order', 'Comprador não pagou', 'O prazo de pagamento do pedido expirou.', '/pedido/' || o.id);
    perform public._offer_second_chance(o);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.accept_second_chance(p_offer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.second_chance_offers; l public.listings; f record; oid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.second_chance_offers where id = p_offer for update;
  if not found or s.bidder_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if s.status = 'accepted' then return s.order_id; end if;
  if s.status <> 'pending' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if s.expires_at <= now() then raise exception 'OFFER_EXPIRED'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = s.listing_id for update;
  select * into f from public._order_fees(s.amount_cents);
  insert into public.orders(listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_net_cents, buyer_fee_cents, status, payment_due_at)
    values (l.id, s.bidder_id, l.seller_id, s.amount_cents, f.fee, s.amount_cents - f.fee, f.buyer_fee, 'pending_payment', public._payment_deadline())
    on conflict (listing_id) where status not in ('payment_expired', 'cancelled') do nothing
    returning id into oid;
  if oid is null then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  update public.second_chance_offers set status = 'accepted', order_id = oid, responded_at = now() where id = s.id;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'second_chance_accepted', 'order', oid::text, jsonb_build_object('offer_id', s.id));
  perform public._notify(l.seller_id, 'order', '2º colocado aceitou', 'O 2º colocado aceitou comprar "' || l.title || '".', '/pedido/' || oid);
  return oid;
end $$;

create or replace function public.decline_second_chance(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.second_chance_offers;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.second_chance_offers where id = p_offer for update;
  if not found or s.bidder_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if s.status = 'declined' then return; end if;
  if s.status <> 'pending' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  update public.second_chance_offers set status = 'declined', responded_at = now() where id = s.id;
  perform public._notify(l.seller_id, 'order', '2º colocado recusou', 'O 2º colocado recusou a oferta de "' || l.title || '".', '/conta/vendas')
    from public.listings l where l.id = s.listing_id;
end $$;

revoke all on function public._order_fees(bigint), public._payment_deadline(), public._offer_second_chance(public.orders),
  public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to service_role;
revoke all on function public.accept_second_chance(uuid), public.decline_second_chance(uuid) from public, anon;
grant execute on function public.accept_second_chance(uuid), public.decline_second_chance(uuid) to authenticated;

-- Limpeza: considera todos os pedidos do leilão, ofertas pendentes e o IMEI ainda retido.
create or replace function public.cleanup_expired_listings(p_days integer default 10) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer := 0; l record;
begin
  if p_days < 3 then raise exception 'RETENTION_TOO_SHORT'; end if;
  for l in
    select li.id from public.listings li
    where (
        li.status in ('ended_no_bids', 'cancelled', 'removed')
        and coalesce(li.ends_at, li.created_at) < now() - make_interval(days => p_days)
      ) or (
        li.status = 'ended_with_winner'
        and exists (select 1 from public.orders o where o.listing_id = li.id)
        and not exists (select 1 from public.orders o where o.listing_id = li.id
                         and (o.status not in ('completed','refunded','cancelled','payment_expired')
                              or o.updated_at >= now() - make_interval(days => p_days)))
        and not exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id where o.listing_id = li.id)
        and not exists (select 1 from public.second_chance_offers s where s.listing_id = li.id and s.status = 'pending')
        and not exists (select 1 from public.listing_imeis i where i.listing_id = li.id)
      )
    for update of li skip locked
  loop
    delete from storage.objects where bucket_id = 'listing-images' and public._storage_path_matches_listing(name, l.id);
    delete from public.listings where id = l.id;
    n := n + 1;
  end loop;
  if n > 0 then
    insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'listings_auto_cleaned', 'system', null, jsonb_build_object('count', n, 'retention_days', p_days));
  end if;
  return n;
end $$;
revoke all on function public.cleanup_expired_listings(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_listings(integer) to service_role;
