-- Correções do motor preservando a base v7.
create or replace function public._lock_bidding(p_listing uuid) returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.status <> 'active' or l.ends_at is null or l.ends_at <= clock_timestamp() or l.starts_at > clock_timestamp() then raise exception 'AUCTION_ENDED'; end if;
  if l.seller_id = uid then raise exception 'SELLER_CANNOT_BID'; end if;
  return l;
end $$;
create or replace function public.place_bid(p_listing uuid, p_amount bigint, p_idempotency text) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid(); leader uuid; minbid bigint; bid_id uuid; previous_max bigint; existing record;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_idempotency is null or char_length(p_idempotency) not between 8 and 100 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9007199254740991 then raise exception 'BID_TOO_LOW'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  -- repetição do mesmo pedido (retry de rede) devolve o estado atual sem novo lance
  perform 1 from public.listings where id = p_listing for update;
  select b.listing_id,b.amount_cents into existing from bid_idempotency i join bids b on b.id=i.bid_id where i.bidder_id=uid and i.idempotency_key=p_idempotency;
  if found then
    if existing.listing_id<>p_listing or existing.amount_cents<>p_amount then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    select * into l from listings where id=p_listing; return l;
  end if;
  if (select count(*) from bid_idempotency where bidder_id=uid and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED'; end if;
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
  if leader is not null and not exists(select 1 from proxy_bids where listing_id=l.id and bidder_id=leader and active and max_amount_cents>=p_amount) then
    perform public._notify(leader, 'outbid', 'Você foi superado', 'Alguém deu um lance maior em "' || l.title || '".', '/l/' || l.slug);
  end if;
  select max_amount_cents into previous_max from proxy_bids where listing_id=l.id and bidder_id=leader and active;
  if previous_max >= p_amount then
    -- O teto anterior ganha empate e pode cobrir por menos de um incremento quando esgotado.
    insert into bids(listing_id,bidder_id,amount_cents,kind,created_at) values(l.id,leader,least(previous_max,p_amount+bid_increment(p_amount)),'auto',clock_timestamp());
    update listings set current_price_cents=least(previous_max,p_amount+bid_increment(p_amount)),bid_count=bid_count+1 where id=l.id;
    update auction_leaders set bidder_id=leader,updated_at=clock_timestamp() where listing_id=l.id;
    perform _notify(uid,'outbid','Seu lance foi superado','Um limite automático anterior cobriu seu lance.','/l/'||l.slug);
  else
    perform public._settle_auction(l.id);
  end if;
  perform public._apply_antisniping(l.id);
  select * into l from public.listings where id = l.id;
  return l;
end $$;
create or replace function public.cancel_proxy_bid(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from listings where id=p_listing for update;
  update public.proxy_bids set active = false, updated_at = now() where listing_id = p_listing and bidder_id = auth.uid();
end $$;

create table public.proxy_requests(bidder_id uuid not null references profiles(id),idempotency_key text not null,listing_id uuid not null references listings(id),amount_cents bigint not null,created_at timestamptz not null default clock_timestamp(),primary key(bidder_id,idempotency_key));
alter table public.proxy_requests enable row level security;
revoke all on public.proxy_requests from anon,authenticated;
alter function public.set_proxy_bid(uuid,bigint) rename to _set_proxy_bid_v7;
revoke all on function public._set_proxy_bid_v7(uuid,bigint) from public,anon,authenticated;
create function public.set_proxy_bid(p_listing uuid,p_max bigint,p_idempotency text default null) returns public.listings language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); old public.proxy_requests; l public.listings;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_max is null or p_max<=0 or p_max>9007199254740991 then raise exception 'MAX_TOO_LOW'; end if;
 if p_idempotency is not null and char_length(p_idempotency) not between 8 and 100 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 perform 1 from listings where id=p_listing for update;
 if p_idempotency is not null then
  select * into old from proxy_requests where bidder_id=uid and idempotency_key=p_idempotency;
  if found then
   if old.listing_id<>p_listing or old.amount_cents<>p_max then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   select * into l from listings where id=p_listing;return l;
  end if;
 end if;
 if (select count(*) from proxy_requests where bidder_id=uid and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'RATE_LIMITED'; end if;
 l:=public._set_proxy_bid_v7(p_listing,p_max);
 insert into proxy_requests(bidder_id,idempotency_key,listing_id,amount_cents) values(uid,coalesce(p_idempotency,gen_random_uuid()::text),p_listing,p_max);
 return l;
end $$;
revoke all on function public.set_proxy_bid(uuid,bigint,text) from public,anon;
grant execute on function public.set_proxy_bid(uuid,bigint,text) to authenticated;
