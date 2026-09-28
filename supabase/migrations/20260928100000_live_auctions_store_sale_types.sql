-- MeuLance: leilão ao vivo (agendado + curto), tipo de venda (leilão | preço fixo | preço fixo com
-- ofertas), vitrine/loja do vendedor, estoque e promoção. Tudo aditivo: leilões clássicos (7 dias,
-- sem agendamento) continuam publicando e fechando exatamente como hoje.
--
-- Pagamento (decisão do dono do produto, 28/09/2026): enquanto não há CNPJ nem provedor escolhido,
-- comprador e vendedor combinam e pagam diretamente entre si (Pix, dinheiro etc.), para TODO tipo de
-- venda. A plataforma não processa nem retém nada disso — só facilita o contato depois que as partes
-- já sabem uma da outra (fim de leilão com interesse confirmado, ou oferta aceita em preço fixo).

-- ───────── tipo de venda e leilão ao vivo ─────────
alter table public.listings
  add column if not exists sale_type text not null default 'auction'
    check (sale_type in ('auction','fixed_price','fixed_price_offers')),
  add column if not exists auction_mode text not null default 'classic'
    check (auction_mode in ('classic','live')),
  add column if not exists live_duration_minutes int check (live_duration_minutes between 1 and 60),
  add column if not exists promo_price_cents bigint,
  add column if not exists stock_qty int check (stock_qty is null or stock_qty >= 0),
  add column if not exists stock_sold int not null default 0,
  add column if not exists paused_at timestamptz;
alter table public.listings add constraint listings_promo_lt_price_chk
  check (promo_price_cents is null or (promo_price_cents > 0 and promo_price_cents < start_price_cents));
alter table public.listings add constraint listings_stock_sold_chk check (stock_sold >= 0);

insert into public.app_config(key, value) values
  ('live_auction', '{"min_minutes":2,"max_minutes":10,"default_minutes":5,"window_seconds":30,"extension_seconds":30,"max_extensions":20}')
on conflict (key) do nothing;

-- vendedor pode ler/gravar as colunas novas no próprio rascunho (mesma regra de sempre: só em draft)
grant insert (sale_type, auction_mode, live_duration_minutes, promo_price_cents, stock_qty) on public.listings to authenticated;
grant update (sale_type, auction_mode, live_duration_minutes, promo_price_cents, stock_qty) on public.listings to authenticated;

-- listagem pública não mostra pausado (mas o próprio vendedor sempre vê os seus, como já valia antes)
drop policy if exists "active listings public read" on public.listings;
create policy "active listings public read" on public.listings for select using (
  (status in ('active','scheduled','ended_no_bids','ended_with_winner') and paused_at is null) or auth.uid() = seller_id
);

-- ───────── loja do vendedor: slug público + whatsapp (privado, só revelado depois do "match") ─────────
alter table public.profiles
  add column if not exists store_slug text unique,
  add column if not exists whatsapp_e164 text;
grant update (whatsapp_e164) on public.profiles to authenticated;

create or replace function public.ensure_store_slug() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s text; nm text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select store_slug, display_name into s, nm from public.profiles where id = uid;
  if s is not null then return s; end if;
  loop
    s := public.make_slug(coalesce(nullif(trim(nm), ''), 'loja'));
    begin
      update public.profiles set store_slug = s where id = uid;
      exit;
    exception when unique_violation then
      -- colisão rara (mesmo nome + mesmo sufixo aleatório): tenta de novo com novo sufixo
    end;
  end loop;
  return s;
end $$;
revoke all on function public.ensure_store_slug() from public, anon;
grant execute on function public.ensure_store_slug() to authenticated;

create or replace function public.set_store_slug(p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s text := lower(trim(coalesce(p_slug, '')));
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if s !~ '^[a-z0-9](-?[a-z0-9])*$' or char_length(s) not between 3 and 40 then raise exception 'INVALID_STORE_SLUG'; end if;
  if s in ('admin','novo','api','loja','vender','conta','entrar','cadastrar') then raise exception 'INVALID_STORE_SLUG'; end if;
  update public.profiles set store_slug = s where id = uid;
  return s;
exception when unique_violation then raise exception 'STORE_SLUG_TAKEN';
end $$;
revoke all on function public.set_store_slug(text) from public, anon;
grant execute on function public.set_store_slug(text) to authenticated;

create or replace view public.public_profiles as
select p.id, p.display_name, p.city, p.state, p.avatar_url, p.created_at,
       (p.email_verified_at is not null) as email_verified,
       (p.phone_verified_at is not null) as phone_verified,
       (p.identity_verified_at is not null) as identity_verified,
       p.completed_sales_count as completed_sales,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id and r.subject_role = 'seller') as rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id and r.subject_role = 'seller')::int as rating_count,
       (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active' and l.paused_at is null)::int as active_listings,
       (select count(*) from public.seller_follows f where f.seller_id = p.id)::int as follower_count,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id and r.subject_role = 'buyer') as buyer_rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id and r.subject_role = 'buyer')::int as buyer_rating_count,
       p.store_slug
from public.profiles p where p.banned_at is null;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- comprador confirmou interesse: agora o contato é liberado (get_order_counterparty), então o aviso
-- ao vendedor troca de "aguarde a plataforma" para "combine o pagamento direto".
create or replace function public.confirm_buyer_interest(p_order uuid, p_whatsapp text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; digits text;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is distinct from o.buyer_id then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'pending_payment' then raise exception 'INVALID_ORDER_STATE'; end if;
  if o.buyer_confirmed_interest_at is not null then return o; end if;
  digits := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if char_length(digits) not between 10 and 13 then raise exception 'INVALID_WHATSAPP'; end if;
  update public.orders
    set buyer_confirmed_interest_at = now(), buyer_whatsapp = digits
    where id = p_order
    returning * into o;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'buyer_confirmed_interest', 'order', o.id::text);
  perform public._notify(o.seller_id, 'order', 'Comprador confirmou interesse',
    'O comprador do seu anúncio confirmou que quer continuar. Ainda não há pagamento protegido pela ' ||
    'plataforma: combine e receba o pagamento diretamente com ele antes de enviar o item.',
    '/pedido/' || o.id);
  return o;
end $$;
revoke all on function public.confirm_buyer_interest(uuid, text) from public, anon;
grant execute on function public.confirm_buyer_interest(uuid, text) to authenticated;

-- ───────── criação/publicação com tipo de venda ─────────
create or replace function public.create_listing_draft_v2(
 p_title text, p_description text, p_condition text, p_defects text, p_start_price_cents bigint,
 p_delivery_mode public.delivery_mode, p_city text, p_state text, p_category uuid default null,
 p_sale_type text default 'auction', p_promo_price_cents bigint default null, p_stock_qty int default null,
 p_scheduled_start timestamptz default null, p_live_minutes int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lid uuid; cfg jsonb; minm int; maxm int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  if p_title is null or char_length(trim(p_title)) not between 8 and 120 then raise exception 'INVALID_TITLE'; end if;
  if p_description is null or char_length(trim(p_description)) not between 20 and 10000 then raise exception 'INVALID_DESCRIPTION'; end if;
  if p_condition is null or p_condition not in ('new','like_new','good','fair','for_parts') then raise exception 'INVALID_CONDITION'; end if;
  if p_start_price_cents is null or p_start_price_cents not between 5000 and 20000000 then raise exception 'INVALID_START_PRICE'; end if;
  if p_city is null or char_length(trim(p_city)) not between 2 and 100 or p_state is null
     or upper(trim(p_state)) not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  then raise exception 'INVALID_LOCATION'; end if;
  if p_delivery_mode is null then raise exception 'INVALID_DELIVERY'; end if;
  if p_category is null or not exists(select 1 from categories where id = p_category and active) then raise exception 'INVALID_CATEGORY'; end if;
  if contains_contact(p_title || ' ' || p_description || ' ' || coalesce(p_defects, '')) then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
  if p_sale_type not in ('auction','fixed_price','fixed_price_offers') then raise exception 'INVALID_SALE_TYPE'; end if;

  if p_sale_type = 'auction' then
    if p_promo_price_cents is not null or p_stock_qty is not null then raise exception 'INVALID_SALE_TYPE'; end if;
    if p_live_minutes is not null then
      select value into cfg from app_config where key = 'live_auction';
      minm := coalesce((cfg->>'min_minutes')::int, 2); maxm := coalesce((cfg->>'max_minutes')::int, 10);
      if p_live_minutes < minm or p_live_minutes > maxm then raise exception 'INVALID_LIVE_DURATION'; end if;
      if p_scheduled_start is not null and p_scheduled_start < now() - interval '1 minute' then raise exception 'INVALID_SCHEDULE'; end if;
    end if;
  else
    if p_promo_price_cents is not null and p_promo_price_cents >= p_start_price_cents then raise exception 'INVALID_PROMO_PRICE'; end if;
    if p_stock_qty is not null and p_stock_qty < 1 then raise exception 'INVALID_STOCK'; end if;
    if p_scheduled_start is not null or p_live_minutes is not null then raise exception 'INVALID_SALE_TYPE'; end if;
  end if;

  insert into listings(seller_id, category_id, title, description, condition, defects_declared, start_price_cents,
                        current_price_cents, status, delivery_mode, city, state, slug,
                        sale_type, auction_mode, live_duration_minutes, promo_price_cents, stock_qty, starts_at)
  values(uid, p_category, trim(p_title), trim(p_description), p_condition, nullif(trim(p_defects), ''), p_start_price_cents,
         p_start_price_cents, 'draft', p_delivery_mode, trim(p_city), upper(trim(p_state)), public.make_slug(p_title) || '-' || gen_random_uuid()::text,
         p_sale_type, case when p_sale_type = 'auction' and p_live_minutes is not null then 'live' else 'classic' end,
         p_live_minutes, p_promo_price_cents, case when p_sale_type = 'auction' then null else coalesce(p_stock_qty, 1) end,
         case when p_sale_type = 'auction' and p_live_minutes is not null then p_scheduled_start else null end)
  returning id into lid;
  return lid;
end $$;
revoke all on function public.create_listing_draft_v2(text,text,text,text,bigint,public.delivery_mode,text,text,uuid,text,bigint,int,timestamptz,int) from public, anon;
grant execute on function public.create_listing_draft_v2(text,text,text,text,bigint,public.delivery_mode,text,text,uuid,text,bigint,int,timestamptz,int) to authenticated;

-- publish_listing/_publish_listing_v7: mesma assinatura de sempre (troca real, não overload), agora
-- ramificando por sale_type/auction_mode. duration_days só é obrigatório/validado para leilão clássico.
create or replace function public._publish_listing_v7(p_listing uuid, p_duration_days int) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings; start_ts timestamptz; cfg jsonb; minm int; maxm int;
begin
  select * into l from public.listings where id = p_listing for update;
  if l.sale_type = 'auction' and l.auction_mode = 'classic' then
    if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;
    update public.listings
       set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => p_duration_days),
           original_ends_at = now() + make_interval(days => p_duration_days), duration_days = p_duration_days,
           current_price_cents = start_price_cents
     where id = l.id returning * into l;
  elsif l.sale_type = 'auction' and l.auction_mode = 'live' then
    if l.live_duration_minutes is null then raise exception 'INVALID_LIVE_DURATION'; end if;
    select value into cfg from app_config where key = 'live_auction';
    minm := coalesce((cfg->>'min_minutes')::int, 2); maxm := coalesce((cfg->>'max_minutes')::int, 10);
    if l.live_duration_minutes < minm or l.live_duration_minutes > maxm then raise exception 'INVALID_LIVE_DURATION'; end if;
    start_ts := greatest(coalesce(l.starts_at, now()), now());
    update public.listings
       set status = (case when start_ts <= now() then 'active' else 'scheduled' end)::public.listing_status,
           starts_at = start_ts, ends_at = start_ts + make_interval(mins => l.live_duration_minutes),
           original_ends_at = start_ts + make_interval(mins => l.live_duration_minutes),
           current_price_cents = start_price_cents
     where id = l.id returning * into l;
  else
    -- preço fixo / preço fixo com ofertas: sem prazo de leilão
    update public.listings
       set status = 'active', starts_at = now(), ends_at = null, original_ends_at = null,
           current_price_cents = start_price_cents
     where id = l.id returning * into l;
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id) values (auth.uid(), 'listing_published', 'listing', l.id::text);
  return l;
end $$;
revoke all on function public._publish_listing_v7(uuid,int) from public, anon, authenticated;

create or replace function public.publish_listing(p_listing uuid, p_duration_days int, p_declaration_accepted boolean default false)
returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; has_problem boolean; has_defects boolean; cfg jsonb; minm int; maxm int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and identity_verified_at is not null) then
    raise exception 'IDENTITY_NOT_VERIFIED';
  end if;
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  if l.status in ('active','scheduled') then return l; end if;
  if p_declaration_accepted then update listings set declaration_accepted_at = clock_timestamp() where id = l.id returning * into l; end if;
  if l.declaration_accepted_at is null then raise exception 'DECLARATION_REQUIRED'; end if;
  if (select count(*) from public.listing_images where listing_id = l.id) < 3 then raise exception 'MIN_IMAGES'; end if;
  -- prazo/duração: validado aqui (antes do checklist), na mesma ordem de sempre para o leilão clássico.
  if l.sale_type = 'auction' and l.auction_mode = 'classic' then
    if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;
  elsif l.sale_type = 'auction' and l.auction_mode = 'live' then
    if l.live_duration_minutes is null then raise exception 'INVALID_LIVE_DURATION'; end if;
    select value into cfg from app_config where key = 'live_auction';
    minm := coalesce((cfg->>'min_minutes')::int, 2); maxm := coalesce((cfg->>'max_minutes')::int, 10);
    if l.live_duration_minutes < minm or l.live_duration_minutes > maxm then raise exception 'INVALID_LIVE_DURATION'; end if;
  end if;

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

-- ativa leilões ao vivo agendados quando chega a hora (job a cada minuto, ver migration seguinte).
-- também é aplicado de forma preguiçosa dentro de place_bid, para não depender só da folga do cron.
create or replace function public.activate_scheduled_listings() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.listings set status = 'active' where status = 'scheduled' and starts_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.activate_scheduled_listings() from public, anon, authenticated;
grant execute on function public.activate_scheduled_listings() to service_role;

-- ───────── lances: ativação preguiçosa do leilão agendado + anti-sniping de 30s no modo ao vivo ─────────
create or replace function public._lock_bidding(p_listing uuid) returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.status = 'scheduled' and l.starts_at <= clock_timestamp() then
    update public.listings set status = 'active' where id = l.id returning * into l;
  end if;
  if l.status <> 'active' or l.ends_at is null or l.ends_at <= clock_timestamp() or l.starts_at > clock_timestamp() then raise exception 'AUCTION_ENDED'; end if;
  if l.seller_id = uid then raise exception 'SELLER_CANNOT_BID'; end if;
  if l.condition = 'for_parts' and not exists (select 1 from public.as_is_acknowledgments where listing_id = l.id and user_id = uid) then
    raise exception 'AS_IS_ACK_REQUIRED';
  end if;
  return l;
end $$;

create or replace function public._apply_antisniping(p_listing uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare cfg jsonb; win int; ext int; maxext int; n int; mode text;
begin
  select auction_mode into mode from public.listings where id = p_listing;
  select value into cfg from public.app_config where key = (case when mode = 'live' then 'live_auction' else 'anti_sniping' end);
  win := coalesce((cfg->>'window_seconds')::int, 120);
  ext := coalesce((cfg->>'extension_seconds')::int, 120);
  maxext := coalesce((cfg->>'max_extensions')::int, 5);
  update public.listings
     set ends_at = ends_at + make_interval(secs => ext), extensions_count = extensions_count + 1
   where id = p_listing and status = 'active' and ends_at - now() <= make_interval(secs => win) and extensions_count < maxext;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ───────── ofertas em preço fixo com ofertas ─────────
create table public.price_offers(
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '72 hours'
);
alter table public.price_offers enable row level security;
create index price_offers_listing_idx on public.price_offers(listing_id);
create policy "offer parties read" on public.price_offers for select using (
  auth.uid() = buyer_id or auth.uid() in (select seller_id from public.listings where id = listing_id) or public.is_staff()
);
revoke insert, update, delete on public.price_offers from anon, authenticated;

create or replace function public.make_price_offer(p_listing uuid, p_amount_cents bigint) returns public.price_offers
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.listings; oid uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'INVALID_MONEY'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.sale_type <> 'fixed_price_offers' or l.status <> 'active' or l.paused_at is not null then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if l.seller_id = uid then raise exception 'SELLER_CANNOT_BID'; end if;
  if p_amount_cents >= l.start_price_cents then raise exception 'INVALID_MONEY'; end if;
  if (select count(*) from price_offers where buyer_id = uid and created_at > now() - interval '1 hour') >= 20 then raise exception 'RATE_LIMITED'; end if;
  if (select count(*) from price_offers where buyer_id = uid and listing_id = p_listing and status = 'pending') >= 3 then raise exception 'RATE_LIMITED'; end if;
  insert into price_offers(listing_id, buyer_id, amount_cents) values (p_listing, uid, p_amount_cents) returning id into oid;
  perform public._notify(l.seller_id, 'message', 'Nova oferta recebida', 'Você recebeu uma oferta em "' || l.title || '".', '/l/' || l.slug);
  return (select o from price_offers o where o.id = oid);
end $$;
revoke all on function public.make_price_offer(uuid,bigint) from public, anon;
grant execute on function public.make_price_offer(uuid,bigint) to authenticated;

create or replace function public.respond_price_offer(p_offer uuid, p_accept boolean) returns public.price_offers
language plpgsql security definer set search_path = public as $$
declare o public.price_offers; l public.listings;
begin
  select * into o from price_offers where id = p_offer for update;
  if not found then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  select * into l from listings where id = o.listing_id;
  if l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'pending' then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if o.expires_at <= now() then
    update price_offers set status = 'expired' where id = o.id returning * into o;
    raise exception 'OFFER_EXPIRED';
  end if;
  update price_offers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = o.id returning * into o;
  perform public._notify(o.buyer_id, 'message',
    case when p_accept then 'Sua oferta foi aceita' else 'Sua oferta foi recusada' end,
    case when p_accept then 'O vendedor aceitou sua oferta em "' || l.title || '". Combine o pagamento direto com ele.'
         else 'O vendedor recusou sua oferta em "' || l.title || '".' end,
    '/l/' || l.slug);
  return o;
end $$;
revoke all on function public.respond_price_offer(uuid,boolean) from public, anon;
grant execute on function public.respond_price_offer(uuid,boolean) to authenticated;

-- ───────── contato direto (preço fixo / oferta aceita / leilão vencido): pagamento combinado fora da
-- plataforma por enquanto. Revoga rate limit simples via audit_log para não virar coletor de telefone. ─────────
create or replace function public.get_seller_contact(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.listings; wa text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from listings where id = p_listing;
  if not found or l.sale_type = 'auction' or l.status <> 'active' or l.paused_at is not null then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if l.seller_id = uid then raise exception 'FORBIDDEN'; end if;
  if (select count(*) from audit_log where actor_id = uid and action = 'seller_contact_revealed' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'RATE_LIMITED';
  end if;
  select whatsapp_e164 into wa from profiles where id = l.seller_id;
  insert into audit_log(actor_id, action, entity_type, entity_id) values (uid, 'seller_contact_revealed', 'listing', l.id::text);
  return jsonb_build_object('whatsapp', wa, 'has_whatsapp', wa is not null);
end $$;
revoke all on function public.get_seller_contact(uuid) from public, anon;
grant execute on function public.get_seller_contact(uuid) to authenticated;

create or replace function public.get_offer_counterparty(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.price_offers; l public.listings; uid uuid := auth.uid(); other uuid; wa text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from price_offers where id = p_offer;
  if not found or uid not in (o.buyer_id, (select seller_id from listings where id = o.listing_id)) then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'accepted' then return jsonb_build_object('released', false); end if;
  select * into l from listings where id = o.listing_id;
  other := case when uid = o.buyer_id then l.seller_id else o.buyer_id end;
  select whatsapp_e164 into wa from profiles where id = other;
  return jsonb_build_object('released', true, 'whatsapp', wa);
end $$;
revoke all on function public.get_offer_counterparty(uuid) from public, anon;
grant execute on function public.get_offer_counterparty(uuid) to authenticated;

-- leilão vencido: comprador e vendedor combinam o pagamento direto assim que o comprador confirma
-- interesse (não é mais preciso esperar a plataforma — ver docs/payments.md).
create or replace function public.get_order_counterparty(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders; l public.listings; other uuid; p public.profiles; seller_side boolean; released boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from orders where id = p_order_id;
  if not found or auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'FORBIDDEN'; end if;
  released := order_contact_released(o.status) or (o.status = 'pending_payment' and o.buyer_confirmed_interest_at is not null);
  if not released then return jsonb_build_object('released', false); end if;
  select * into l from listings where id = o.listing_id;
  seller_side := auth.uid() = o.seller_id;
  other := case when seller_side then o.buyer_id else o.seller_id end;
  select * into p from profiles where id = other;
  return jsonb_build_object(
    'released', true,
    'full_name', coalesce(p.full_name, p.display_name),
    'whatsapp', case when seller_side then o.buyer_whatsapp else p.whatsapp_e164 end,
    'address', case when seller_side or l.delivery_mode in ('pickup','both') then jsonb_build_object(
      'zip', p.address_zip, 'street', p.address_street, 'number', p.address_number,
      'complement', p.address_complement, 'neighborhood', p.address_neighborhood,
      'city', p.city, 'state', p.state) end);
end $$;
revoke all on function public.get_order_counterparty(uuid) from public, anon;
grant execute on function public.get_order_counterparty(uuid) to authenticated;

-- ───────── "minha loja": pausar/retomar/marcar como vendido (só preço fixo — leilão não pausa nem
-- marca vendido manualmente, o encerramento é sempre pelo prazo/lance) ─────────
create or replace function public.pause_listing(p_listing uuid, p_paused boolean) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.sale_type = 'auction' then raise exception 'NOT_CANCELLABLE'; end if;
  if l.status <> 'active' then raise exception 'INVALID_ORDER_STATE'; end if;
  update listings set paused_at = case when p_paused then now() else null end where id = l.id returning * into l;
  return l;
end $$;
revoke all on function public.pause_listing(uuid,boolean) from public, anon;
grant execute on function public.pause_listing(uuid,boolean) to authenticated;

create or replace function public.mark_listing_sold(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.sale_type = 'auction' then raise exception 'NOT_CANCELLABLE'; end if;
  if l.status <> 'active' then raise exception 'INVALID_ORDER_STATE'; end if;
  update listings set status = 'ended_with_winner', ends_at = coalesce(ends_at, now()), paused_at = null, stock_sold = greatest(stock_sold, coalesce(stock_qty, 1))
    where id = l.id returning * into l;
  insert into audit_log(actor_id, action, entity_type, entity_id) values (auth.uid(), 'listing_marked_sold', 'listing', l.id::text);
  return l;
end $$;
revoke all on function public.mark_listing_sold(uuid) from public, anon;
grant execute on function public.mark_listing_sold(uuid) to authenticated;

-- registra 1 unidade vendida fora da plataforma (contato por WhatsApp); esgotar o estoque encerra
-- o anúncio sozinho. Não gera pedido/pagamento: é só controle de estoque informado pelo vendedor.
create or replace function public.decrement_listing_stock(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.sale_type = 'auction' or l.status <> 'active' then raise exception 'INVALID_ORDER_STATE'; end if;
  if l.stock_qty is not null and l.stock_sold >= l.stock_qty then raise exception 'INVALID_STOCK'; end if;
  update listings set stock_sold = stock_sold + 1,
         status = case when stock_qty is not null and stock_sold + 1 >= stock_qty then 'ended_with_winner' else status end,
         ends_at = case when stock_qty is not null and stock_sold + 1 >= stock_qty then coalesce(ends_at, now()) else ends_at end
    where id = l.id returning * into l;
  return l;
end $$;
revoke all on function public.decrement_listing_stock(uuid) from public, anon;
grant execute on function public.decrement_listing_stock(uuid) to authenticated;
