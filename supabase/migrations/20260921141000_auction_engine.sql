-- MeuLance: motor de leilão (lances manuais, lance automático/proxy, anti-sniping, fechamento).
-- Toda regra de preço/vencedor vive aqui, dentro de transação com trava na linha do leilão.
--
-- Semântica:
--  * lance manual = valor exato que o usuário quer ver como preço atual;
--  * lance automático = teto privado; o sistema sobe só o necessário (menor incremento acima do rival);
--  * empate de tetos: quem definiu o teto primeiro continua na frente;
--  * quem lidera não pode dar lance manual em si mesmo (ALREADY_LEADING) — só aumentar o teto.
-- O histórico público (public_bids) é mascarado. Um teto só fica visível quando é "consumido" como preço.

insert into public.app_config(key, value) values
  ('bid_increments', '[{"upto":10000,"inc":200},{"upto":50000,"inc":500},{"upto":200000,"inc":1000},{"upto":null,"inc":2500}]'),
  ('payments_live', 'false')
on conflict (key) do nothing;

create or replace function public.bid_increment(p bigint) returns bigint language sql stable set search_path = public as $$
  select coalesce((
    select (t.v->>'inc')::bigint
    from jsonb_array_elements(coalesce((select value from public.app_config where key = 'bid_increments'), '[]'::jsonb))
         with ordinality as t(v, ord)
    where (t.v->>'upto') is null or p <= (t.v->>'upto')::bigint
    order by t.ord limit 1), 200)
$$;
grant execute on function public.bid_increment(bigint) to anon, authenticated;

-- líder do leilão: identidade só visível para o próprio líder
create table public.auction_leaders (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id),
  updated_at timestamptz not null default now());
insert into public.auction_leaders(listing_id, bidder_id)
  select id, highest_bidder_id from public.listings where highest_bidder_id is not null;
alter table public.listings drop column highest_bidder_id;
alter table public.auction_leaders enable row level security;
create policy "leader sees self" on public.auction_leaders for select to authenticated using (auth.uid() = bidder_id);
revoke insert, update, delete on public.auction_leaders from anon, authenticated;
revoke select on public.auction_leaders from anon;
alter table public.auction_leaders replica identity full;
do $$ begin alter publication supabase_realtime add table public.auction_leaders; exception when others then null; end $$;

create or replace function public._notify(p_user uuid, p_kind public.notification_kind, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, href) values (p_user, p_kind, p_title, p_body, p_href)
$$;

create or replace function public._apply_antisniping(p_listing uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare cfg jsonb; win int; ext int; maxext int; n int;
begin
  select value into cfg from public.app_config where key = 'anti_sniping';
  win := coalesce((cfg->>'window_seconds')::int, 120);
  ext := coalesce((cfg->>'extension_seconds')::int, 120);
  maxext := coalesce((cfg->>'max_extensions')::int, 5);
  update public.listings
     set ends_at = ends_at + make_interval(secs => ext), extensions_count = extensions_count + 1
   where id = p_listing and status = 'active' and ends_at - now() <= make_interval(secs => win) and extensions_count < maxext;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- resolve a disputa entre tetos (proxy). Chamada com a linha do leilão já travada.
create or replace function public._settle_auction(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  l public.listings; leader uuid; lmax bigint; lceil bigint; h record; rival bigint; newp bigint; nb int := 0;
begin
  select * into l from public.listings where id = p_listing;
  select bidder_id into leader from public.auction_leaders where listing_id = p_listing;
  select max_amount_cents into lmax from public.proxy_bids where listing_id = p_listing and bidder_id = leader and active;
  lmax := coalesce(lmax, 0);
  lceil := greatest(l.current_price_cents, lmax);
  select bidder_id, max_amount_cents into h from public.proxy_bids
   where listing_id = p_listing and active and bidder_id is distinct from leader
   order by max_amount_cents desc, updated_at asc limit 1;
  if not found then return; end if;
  if h.max_amount_cents < l.current_price_cents + public.bid_increment(l.current_price_cents) then return; end if;
  select greatest(lceil, coalesce(max(max_amount_cents), 0)) into rival from public.proxy_bids
   where listing_id = p_listing and active and bidder_id <> h.bidder_id and bidder_id is distinct from leader;

  if h.max_amount_cents > lceil then
    -- o desafiante passa o líder atual
    newp := least(h.max_amount_cents, rival + public.bid_increment(rival));
    if lmax > l.current_price_cents then
      insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (p_listing, leader, lmax, 'auto', clock_timestamp());
      nb := nb + 1;
    end if;
    insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (p_listing, h.bidder_id, newp, 'auto', clock_timestamp());
    nb := nb + 1;
    insert into public.auction_leaders(listing_id, bidder_id) values (p_listing, h.bidder_id)
      on conflict (listing_id) do update set bidder_id = excluded.bidder_id, updated_at = now();
    if leader is not null then
      perform public._notify(leader, 'outbid', 'Você foi superado', 'Outro participante passou o seu lance em "' || l.title || '".', '/l/' || l.slug);
    end if;
  else
    -- o líder se defende usando o teto
    newp := least(lceil, h.max_amount_cents + public.bid_increment(h.max_amount_cents));
    insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (p_listing, h.bidder_id, h.max_amount_cents, 'auto', clock_timestamp());
    insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (p_listing, leader, newp, 'auto', clock_timestamp());
    nb := 2;
    perform public._notify(h.bidder_id, 'outbid', 'Seu limite foi superado', 'O lance automático de outro participante cobriu o seu limite em "' || l.title || '".', '/l/' || l.slug);
  end if;
  update public.listings set current_price_cents = newp, bid_count = bid_count + nb where id = p_listing;
end $$;

create or replace function public._lock_bidding(p_listing uuid) returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.status <> 'active' or l.ends_at <= now() then raise exception 'AUCTION_ENDED'; end if;
  if l.seller_id = uid then raise exception 'SELLER_CANNOT_BID'; end if;
  return l;
end $$;

create or replace function public.place_bid(p_listing uuid, p_amount bigint, p_idempotency text) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid(); leader uuid; minbid bigint; bid_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_idempotency is null or char_length(p_idempotency) not between 8 and 100 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BID_TOO_LOW'; end if;
  -- repetição do mesmo pedido (retry de rede) devolve o estado atual sem novo lance
  perform 1 from public.listings where id = p_listing for update;
  if exists (select 1 from public.bid_idempotency where bidder_id = uid and idempotency_key = p_idempotency) then
    select * into l from public.listings where id = p_listing; return l;
  end if;
  l := public._lock_bidding(p_listing);
  select bidder_id into leader from public.auction_leaders where listing_id = l.id;
  if leader = uid then raise exception 'ALREADY_LEADING'; end if;
  minbid := case when l.bid_count = 0 then l.start_price_cents else l.current_price_cents + public.bid_increment(l.current_price_cents) end;
  if p_amount < minbid then raise exception 'BID_TOO_LOW'; end if;

  insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (l.id, uid, p_amount, 'manual', clock_timestamp()) returning id into bid_id;
  insert into public.bid_idempotency(bidder_id, idempotency_key, bid_id) values (uid, p_idempotency, bid_id);
  update public.listings set current_price_cents = p_amount, bid_count = bid_count + 1 where id = l.id;
  insert into public.auction_leaders(listing_id, bidder_id) values (l.id, uid)
    on conflict (listing_id) do update set bidder_id = excluded.bidder_id, updated_at = now();
  if leader is not null then
    perform public._notify(leader, 'outbid', 'Você foi superado', 'Alguém deu um lance maior em "' || l.title || '".', '/l/' || l.slug);
  end if;
  perform public._settle_auction(l.id);
  perform public._apply_antisniping(l.id);
  select * into l from public.listings where id = l.id;
  return l;
end $$;

create or replace function public.set_proxy_bid(p_listing uuid, p_max bigint) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid(); leader uuid; mine bigint; minbid bigint; before_count int;
begin
  perform 1 from public.listings where id = p_listing for update;
  l := public._lock_bidding(p_listing);
  before_count := l.bid_count;
  select bidder_id into leader from public.auction_leaders where listing_id = l.id;
  select max_amount_cents into mine from public.proxy_bids where listing_id = l.id and bidder_id = uid and active;
  if leader = uid then
    if p_max is null or p_max <= greatest(l.current_price_cents, coalesce(mine, 0)) then raise exception 'MAX_NOT_HIGHER'; end if;
  else
    minbid := case when l.bid_count = 0 then l.start_price_cents else l.current_price_cents + public.bid_increment(l.current_price_cents) end;
    if p_max is null or p_max < minbid then raise exception 'MAX_TOO_LOW'; end if;
  end if;
  insert into public.proxy_bids(listing_id, bidder_id, max_amount_cents, active, updated_at) values (l.id, uid, p_max, true, clock_timestamp())
    on conflict (listing_id, bidder_id) do update set max_amount_cents = excluded.max_amount_cents, active = true, updated_at = clock_timestamp();
  if leader is null then
    insert into public.bids(listing_id, bidder_id, amount_cents, kind, created_at) values (l.id, uid, l.start_price_cents, 'auto', clock_timestamp());
    update public.listings set current_price_cents = start_price_cents, bid_count = bid_count + 1 where id = l.id;
    insert into public.auction_leaders(listing_id, bidder_id) values (l.id, uid);
  end if;
  perform public._settle_auction(l.id);
  select * into l from public.listings where id = l.id;
  if l.bid_count > before_count then perform public._apply_antisniping(l.id); select * into l from public.listings where id = l.id; end if;
  return l;
end $$;

create or replace function public.cancel_proxy_bid(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.proxy_bids set active = false, updated_at = now() where listing_id = p_listing and bidder_id = auth.uid();
end $$;

create or replace function public.publish_listing(p_listing uuid, p_duration_days int) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.seller_id <> uid then raise exception 'FORBIDDEN'; end if;
  if l.status <> 'draft' then raise exception 'NOT_DRAFT'; end if;
  if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;
  if (select count(*) from public.listing_images where listing_id = l.id) < 3 then raise exception 'MIN_IMAGES'; end if;
  if l.declaration_accepted_at is null then raise exception 'DECLARATION_REQUIRED'; end if;
  update public.listings
     set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => p_duration_days),
         original_ends_at = now() + make_interval(days => p_duration_days), duration_days = p_duration_days,
         current_price_cents = start_price_cents
   where id = l.id returning * into l;
  insert into public.audit_log(actor_id, action, entity_type, entity_id) values (uid, 'listing_published', 'listing', l.id::text);
  return l;
end $$;

create or replace function public.cancel_listing(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.bid_count > 0 then raise exception 'HAS_BIDS'; end if;
  if l.status not in ('draft','active') then raise exception 'NOT_CANCELLABLE'; end if;
  update public.listings set status = 'cancelled' where id = l.id;
  insert into public.audit_log(actor_id, action, entity_type, entity_id) values (auth.uid(), 'listing_cancelled', 'listing', l.id::text);
end $$;

create or replace function public.answer_question(p_question uuid, p_answer text) returns void language plpgsql security definer set search_path = public as $$
declare q public.questions; l public.listings;
begin
  select * into q from public.questions where id = p_question for update;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  select * into l from public.listings where id = q.listing_id;
  if l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if p_answer is null or char_length(trim(p_answer)) < 2 or char_length(p_answer) > 800 then raise exception 'INVALID_ANSWER'; end if;
  if public.contains_contact(p_answer) then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
  update public.questions set answer = trim(p_answer), answered_at = now() where id = q.id;
  perform public._notify(q.author_id, 'message', 'Sua pergunta foi respondida', 'O vendedor respondeu sua pergunta em "' || l.title || '".', '/l/' || l.slug);
end $$;

-- fechamento: idempotente, uma única order por leilão, sem duplicar em corrida com lance
create or replace function public.close_due_auctions() returns integer language plpgsql security definer set search_path = public as $$
declare r public.listings; n integer := 0; leader uuid; bps int; hours int; fee bigint; oid uuid;
begin
  select coalesce((value #>> '{}')::int, 500) into bps from public.app_config where key = 'commission_bps';
  select coalesce((value #>> '{}')::int, 48) into hours from public.app_config where key = 'payment_deadline_hours';
  bps := coalesce(bps, 500); hours := coalesce(hours, 48);
  for r in select * from public.listings where status = 'active' and ends_at <= now() for update skip locked loop
    select bidder_id into leader from public.auction_leaders where listing_id = r.id;
    if leader is null then
      update public.listings set status = 'ended_no_bids' where id = r.id;
      perform public._notify(r.seller_id, 'system', 'Leilão encerrado sem lances', '"' || r.title || '" terminou sem lances.', '/l/' || r.slug);
    else
      update public.listings set status = 'ended_with_winner' where id = r.id;
      fee := round(r.current_price_cents * bps / 10000.0);
      insert into public.orders(listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_net_cents, status, payment_due_at)
        values (r.id, leader, r.seller_id, r.current_price_cents, fee, r.current_price_cents - fee, 'pending_payment', now() + make_interval(hours => hours))
        on conflict (listing_id) do nothing returning id into oid;
      if oid is not null then
        perform public._notify(leader, 'won', 'Você venceu!', 'Você arrematou "' || r.title || '". Conclua o pagamento no prazo.', '/pedido/' || oid);
        perform public._notify(r.seller_id, 'order', 'Seu item foi arrematado', '"' || r.title || '" recebeu um lance vencedor.', '/pedido/' || oid);
        insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
          values (null, 'auction_closed', 'listing', r.id::text, jsonb_build_object('amount_cents', r.current_price_cents, 'order_id', oid));
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- privilégios: funções internas e de servidor não ficam expostas via /rpc
revoke all on function public._notify(uuid, public.notification_kind, text, text, text), public._apply_antisniping(uuid),
  public._settle_auction(uuid), public._lock_bidding(uuid), public.close_due_auctions() from public, anon, authenticated;
grant execute on function public.close_due_auctions() to service_role;
revoke all on function public.place_bid(uuid, bigint, text), public.set_proxy_bid(uuid, bigint), public.cancel_proxy_bid(uuid),
  public.publish_listing(uuid, int), public.cancel_listing(uuid), public.answer_question(uuid, text) from public, anon;
grant execute on function public.place_bid(uuid, bigint, text), public.set_proxy_bid(uuid, bigint), public.cancel_proxy_bid(uuid),
  public.publish_listing(uuid, int), public.cancel_listing(uuid), public.answer_question(uuid, text) to authenticated;
