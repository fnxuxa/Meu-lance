-- MeuLance: relançar também quando o vencedor não pagou (com ou sem oferta ao 2º colocado).
-- Lances são imutáveis, então o anúncio ganha "rodadas": relançar abre a rodada seguinte,
-- zera preço/contador/líder e o histórico público mostra só a rodada atual.
-- Pode relançar quando: terminou sem lances, OU terminou com vencedor, nenhum pedido está em
-- andamento (todos payment_expired/cancelled) e não há oferta ao 2º colocado pendente.

alter table public.listings add column if not exists auction_round integer not null default 1;
alter table public.bids add column if not exists auction_round integer not null default 1;
alter table public.second_chance_offers add column if not exists auction_round integer not null default 1;
alter table public.second_chance_offers drop constraint if exists second_chance_offers_listing_id_key;
create unique index if not exists second_chance_offers_round_unique on public.second_chance_offers(listing_id, auction_round);

create or replace function public._bids_set_round() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select auction_round into new.auction_round from public.listings where id = new.listing_id;
  return new;
end $$;
create trigger bids_set_round before insert on public.bids for each row execute function public._bids_set_round();
revoke all on function public._bids_set_round() from public, anon, authenticated;

create or replace view public.public_bids as
select b.id, b.listing_id, b.amount_cents, b.kind, b.created_at,
       left(p.display_name, 1) || '***' || right(p.display_name, 1) as bidder_mask, b.sequence_no
from public.bids b
join public.profiles p on p.id = b.bidder_id
join public.listings l on l.id = b.listing_id
where l.status in ('active', 'ended_no_bids', 'ended_with_winner') and b.auction_round = l.auction_round;

-- Oferta ao 2º colocado considera só a rodada atual; sem a opção, avisa que dá para relançar.
create or replace function public._offer_second_chance(p_order public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare l public.listings; r record; hours int;
begin
  select * into l from public.listings where id = p_order.listing_id;
  if not found then return; end if;
  if not l.second_chance_enabled then
    perform public._notify(l.seller_id, 'order', 'Você pode relançar',
      'O vencedor de "' || l.title || '" não pagou. Relance o anúncio com 1 clique em Meus anúncios.', '/conta/anuncios');
    return;
  end if;
  if exists (select 1 from public.second_chance_offers where listing_id = l.id and auction_round = l.auction_round) then return; end if;
  select b.bidder_id, max(b.amount_cents) as amount into r
    from public.bids b join public.profiles p on p.id = b.bidder_id and p.banned_at is null
   where b.listing_id = l.id and b.auction_round = l.auction_round and b.bidder_id <> p_order.buyer_id
   group by b.bidder_id order by max(b.amount_cents) desc, min(b.sequence_no) asc limit 1;
  if not found then
    perform public._notify(l.seller_id, 'order', 'Sem 2º colocado',
      'O vencedor de "' || l.title || '" não pagou e não há outro participante. Relance o anúncio em Meus anúncios.', '/conta/anuncios');
    return;
  end if;
  select (value #>> '{}')::int into hours from public.app_config where key = 'second_chance_hours';
  insert into public.second_chance_offers(listing_id, auction_round, expired_order_id, bidder_id, amount_cents, expires_at)
    values (l.id, l.auction_round, p_order.id, r.bidder_id, r.amount, now() + make_interval(hours => coalesce(hours, 24)));
  perform public._notify(r.bidder_id, 'order', 'Oferta de segunda chance',
    'O vencedor de "' || l.title || '" não pagou. O item pode ser seu pelo valor do seu maior lance. Responda em até '
    || coalesce(hours, 24) || 'h.', '/conta/compras');
  perform public._notify(l.seller_id, 'order', 'Oferta enviada ao 2º colocado',
    'O vencedor de "' || l.title || '" não pagou. Oferecemos o item ao 2º colocado.', '/conta/vendas');
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (null, 'second_chance_offered', 'listing', l.id::text, jsonb_build_object('bidder_id', r.bidder_id, 'amount_cents', r.amount));
end $$;
revoke all on function public._offer_second_chance(public.orders) from public, anon, authenticated;

create or replace function public.expire_unpaid_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare o public.orders; s record; n int := 0;
begin
  for s in update public.second_chance_offers set status = 'expired', responded_at = now()
            where status = 'pending' and expires_at <= now() returning listing_id loop
    perform public._notify(l.seller_id, 'order', 'Oferta ao 2º colocado expirou',
      'O 2º colocado não respondeu à oferta de "' || l.title || '". Relance o anúncio em Meus anúncios.', '/conta/anuncios')
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
revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to service_role;

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
  perform public._notify(l.seller_id, 'order', '2º colocado recusou',
    'O 2º colocado recusou a oferta de "' || l.title || '". Relance o anúncio em Meus anúncios.', '/conta/anuncios')
    from public.listings l where l.id = s.listing_id;
end $$;

create or replace function public.relist_listing(p_listing uuid, p_start_price_cents bigint, p_duration_days int)
returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid(); ends timestamptz; previous text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.profiles where id = uid and identity_verified_at is not null) then raise exception 'IDENTITY_NOT_VERIFIED'; end if;
  if l.status = 'ended_no_bids' then
    if l.bid_count <> 0 then raise exception 'NOT_RELISTABLE'; end if;
  elsif l.status = 'ended_with_winner' then
    if exists (select 1 from public.orders where listing_id = l.id and status not in ('payment_expired', 'cancelled'))
       or exists (select 1 from public.second_chance_offers where listing_id = l.id and status = 'pending') then
      raise exception 'NOT_RELISTABLE';
    end if;
  else
    raise exception 'NOT_RELISTABLE';
  end if;
  if p_start_price_cents is null or p_start_price_cents not between 5000 and 20000000 then raise exception 'INVALID_START_PRICE'; end if;
  if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;
  previous := l.status::text;
  ends := clock_timestamp() + make_interval(days => p_duration_days);
  -- nova rodada: lances antigos ficam guardados (imutáveis), mas saem do histórico público e do motor
  delete from public.auction_leaders where listing_id = l.id;
  update public.proxy_bids set active = false, updated_at = clock_timestamp() where listing_id = l.id and active;
  update public.listings
     set status = 'active', auction_round = auction_round + 1, bid_count = 0,
         start_price_cents = p_start_price_cents, current_price_cents = p_start_price_cents,
         starts_at = clock_timestamp(), ends_at = ends, original_ends_at = ends, duration_days = p_duration_days,
         extensions_count = 0
   where id = l.id returning * into l;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (uid, 'listing_relisted', 'listing', l.id::text,
            jsonb_build_object('start_price_cents', p_start_price_cents, 'duration_days', p_duration_days,
                               'previous_status', previous, 'auction_round', l.auction_round));
  return l;
end $$;
revoke all on function public.relist_listing(uuid, bigint, int) from public, anon;
grant execute on function public.relist_listing(uuid, bigint, int) to authenticated;
