-- MeuLance: endurecimento de segurança (RLS, privilégios por coluna, views públicas, storage).
-- Regra: dado privado nunca sai por policy "using (true)"; escrita sensível só por RPC (security definer).

-- ───────── helpers ─────────
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')) $$;
grant execute on function public.is_admin(), public.is_staff() to anon, authenticated;

create or replace function public.contains_contact(t text) returns boolean language sql immutable as $$
  select t ~* '(\d[\s().-]*){9,}'
      or t ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
      or t ~* '(https?://|www\.)'
      or t ~* '\m(whats(app)?|zap|wpp|telegram|insta(gram)?)\M'
$$;

create or replace function public.make_slug(t text) returns text language sql volatile as $$
  select left(trim(both '-' from regexp_replace(
           translate(lower(t),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),'[^a-z0-9]+','-','g')),60)
         || '-' || substr(md5(random()::text || clock_timestamp()::text),1,6)
$$;

-- ───────── profiles ─────────
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists banned_at timestamptz,
  add column if not exists email_verified_at timestamptz,
  add column if not exists identity_verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add constraint profiles_display_name_len check (char_length(display_name) between 2 and 40);

drop policy if exists "public profiles readable" on public.profiles;
create policy "own or staff profile read" on public.profiles for select using (auth.uid() = id or public.is_staff());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, full_name, city, state, avatar_url) on public.profiles to authenticated;

create or replace function public.guard_profile_privileged() returns trigger language plpgsql as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin')
     and (new.role is distinct from old.role or new.seller_status is distinct from old.seller_status
       or new.strikes_count is distinct from old.strikes_count or new.phone_e164 is distinct from old.phone_e164
       or new.phone_verified_at is distinct from old.phone_verified_at or new.email_verified_at is distinct from old.email_verified_at
       or new.identity_verified_at is distinct from old.identity_verified_at or new.banned_at is distinct from old.banned_at) then
    raise exception 'PRIVILEGED_COLUMN';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_privileged();

-- perfil público: só campos seguros (nunca nome completo, telefone, role)
create view public.public_profiles as
select p.id, p.display_name, p.city, p.state, p.avatar_url, p.created_at,
       (p.email_verified_at is not null) as email_verified,
       (p.phone_verified_at is not null) as phone_verified,
       (p.identity_verified_at is not null) as identity_verified,
       (select count(*) from public.orders o where o.seller_id = p.id and o.status = 'completed')::int as completed_sales,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id) as rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id)::int as rating_count,
       (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active')::int as active_listings
from public.profiles p where p.banned_at is null;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  n := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));
  if n is null or char_length(n) < 2 then n := 'Usuário'; end if;
  insert into public.profiles(id, display_name, full_name, email_verified_at)
  values (new.id, left(n, 40), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email_confirmed_at)
  on conflict (id) do nothing;
  insert into public.notification_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.sync_email_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email_verified_at = new.email_confirmed_at where id = new.id;
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row execute function public.sync_email_verified();

insert into public.profiles(id, display_name, email_verified_at)
select u.id, case when char_length(split_part(u.email,'@',1)) < 2 then 'Usuário' else left(split_part(u.email,'@',1),40) end, u.email_confirmed_at
from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);

-- ───────── listings ─────────
alter table public.listings
  add column if not exists brand text, add column if not exists model text,
  add column if not exists declaration_accepted_at timestamptz,
  add column if not exists duration_days int check (duration_days in (3,5,7,10)),
  add column if not exists view_count int not null default 0;
alter table public.listings add column if not exists search_vec tsvector
  generated always as (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,''))) stored;
alter table public.listings add constraint listings_condition_chk check (condition in ('new','like_new','good','fair','for_parts'));

create or replace function public.listings_before_write() returns trigger language plpgsql as $$
declare priv boolean := current_user in ('postgres','service_role','supabase_admin');
begin
  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then new.slug := public.make_slug(new.title); end if;
    if not priv then
      new.status := 'draft'; new.bid_count := 0; new.extensions_count := 0;
      new.starts_at := null; new.ends_at := null; new.original_ends_at := null;
      new.current_price_cents := new.start_price_cents;
    end if;
  elsif not priv then
    if old.status <> 'draft' then raise exception 'LISTING_LOCKED'; end if;
    new.seller_id := old.seller_id; new.status := old.status; new.slug := old.slug; new.bid_count := old.bid_count;
    new.extensions_count := old.extensions_count; new.starts_at := old.starts_at; new.ends_at := old.ends_at;
    new.original_ends_at := old.original_ends_at; new.current_price_cents := new.start_price_cents;
  end if;
  return new;
end $$;
create trigger listings_guard before insert or update on public.listings for each row execute function public.listings_before_write();

drop policy if exists "seller creates listings" on public.listings;
drop policy if exists "seller updates own prebid listing" on public.listings;
create policy "seller creates draft" on public.listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller edits own draft" on public.listings for update to authenticated
  using (auth.uid() = seller_id and status = 'draft') with check (auth.uid() = seller_id and status = 'draft');
create policy "seller deletes own draft" on public.listings for delete to authenticated using (auth.uid() = seller_id and status = 'draft');
create policy "staff read listings" on public.listings for select using (public.is_staff());
revoke insert, update, delete on public.listings from anon, authenticated;
grant insert (seller_id, category_id, title, description, condition, brand, model, defects_declared, start_price_cents,
              current_price_cents, delivery_mode, city, state, declaration_accepted_at, duration_days) on public.listings to authenticated;
grant update (category_id, title, description, condition, brand, model, defects_declared, start_price_cents,
              delivery_mode, city, state, declaration_accepted_at, duration_days) on public.listings to authenticated;
grant delete on public.listings to authenticated;

-- ───────── imagens do anúncio ─────────
drop policy if exists "listing images public read" on public.listing_images;
create policy "listing images read" on public.listing_images for select using (
  exists (select 1 from public.listings l where l.id = listing_id and (l.status in ('active','ended_no_bids','ended_with_winner') or l.seller_id = auth.uid())));
create policy "seller adds images" on public.listing_images for insert to authenticated with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid() and l.status = 'draft'));
create policy "seller edits images" on public.listing_images for update to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid() and l.status = 'draft'));
create policy "seller removes images" on public.listing_images for delete to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid() and l.status = 'draft'));
create or replace function public.listing_images_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 10 then raise exception 'MAX_IMAGES'; end if;
  return new;
end $$;
create trigger listing_images_max before insert on public.listing_images for each row execute function public.listing_images_limit();
revoke insert, update, delete on public.listing_images from anon, authenticated;
grant insert (listing_id, storage_path, sort_order), update (sort_order), delete on public.listing_images to authenticated;

-- ───────── lances: histórico público mascarado; teto nunca exposto ─────────
drop policy if exists "bids public read" on public.bids;
create policy "own bids read" on public.bids for select using (auth.uid() = bidder_id);
revoke insert, update, delete on public.bids from anon, authenticated;
create view public.public_bids as
select b.id, b.listing_id, b.amount_cents, b.kind, b.created_at,
       left(p.display_name, 1) || '***' || right(p.display_name, 1) as bidder_mask
from public.bids b join public.profiles p on p.id = b.bidder_id;
grant select on public.public_bids to anon, authenticated;
revoke insert, update, delete on public.proxy_bids from anon, authenticated;

-- ───────── perguntas públicas ─────────
drop policy if exists "questions authenticated insert" on public.questions;
drop policy if exists "questions public read" on public.questions;
create policy "questions read" on public.questions for select using (true);
create policy "questions ask" on public.questions for insert to authenticated with check (
  auth.uid() = author_id and answer is null and answered_at is null
  and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active' and l.seller_id <> auth.uid()));
revoke all on public.questions from anon, authenticated;
grant select (id, listing_id, body, answer, answered_at, created_at) on public.questions to anon, authenticated;
grant insert (listing_id, author_id, body) on public.questions to authenticated;
create or replace function public.questions_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.contains_contact(new.body) then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
  if (select count(*) from public.questions where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;
create trigger questions_guard before insert on public.questions for each row execute function public.questions_before_insert();

-- ───────── pedidos (só o servidor escreve) ─────────
alter table public.orders
  add column if not exists paid_at timestamptz, add column if not exists ship_by timestamptz,
  add column if not exists shipped_at timestamptz, add column if not exists carrier text,
  add column if not exists tracking_code text, add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz, add column if not exists cancel_reason text;
revoke insert, update, delete on public.orders from anon, authenticated;
create policy "staff read orders" on public.orders for select using (public.is_staff());

-- ───────── disputas ─────────
alter table public.disputes add column if not exists snapshot jsonb;
alter table public.disputes add constraint disputes_reason_chk check (reason in ('not_shipped','not_as_described','damaged','other'));
alter table public.disputes add constraint disputes_desc_len check (char_length(description) between 20 and 4000);
drop policy if exists "buyer opens dispute" on public.disputes;
create policy "buyer opens dispute" on public.disputes for insert to authenticated with check (
  auth.uid() = opened_by and status = 'open'
  and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
              and o.status in ('paid','awaiting_shipment','shipped','delivered')));
revoke insert, update, delete on public.disputes from anon, authenticated;
grant insert (order_id, opened_by, reason, description) on public.disputes to authenticated;
create or replace function public.disputes_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select jsonb_build_object('title', l.title, 'description', l.description, 'defects_declared', l.defects_declared,
                            'amount_cents', o.amount_cents, 'captured_at', now())
    into new.snapshot from public.orders o join public.listings l on l.id = o.listing_id where o.id = new.order_id;
  return new;
end $$;
create trigger disputes_snapshot before insert on public.disputes for each row execute function public.disputes_before_insert();
create or replace function public.disputes_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'disputed' where id = new.order_id;
  insert into public.audit_log(actor_id, action, entity_type, entity_id) values (new.opened_by, 'dispute_opened', 'order', new.order_id::text);
  return new;
end $$;
create trigger disputes_open after insert on public.disputes for each row execute function public.disputes_after_insert();

drop policy if exists "evidence parties read" on public.dispute_evidence;
drop policy if exists "evidence parties insert" on public.dispute_evidence;
create policy "evidence read" on public.dispute_evidence for select using (
  public.is_staff() or exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id
                                where d.id = dispute_id and auth.uid() in (o.buyer_id, o.seller_id)));
create policy "evidence insert" on public.dispute_evidence for insert to authenticated with check (
  auth.uid() = author_id and exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id
    where d.id = dispute_id and d.status not in ('resolved_buyer','resolved_seller','cancelled') and auth.uid() in (o.buyer_id, o.seller_id)));
revoke insert, update, delete on public.dispute_evidence from anon, authenticated;
grant insert (dispute_id, author_id, kind, storage_path, note) on public.dispute_evidence to authenticated;

-- ───────── avaliações ─────────
create policy "reviews after completed order" on public.reviews for insert to authenticated with check (
  auth.uid() = author_id and exists (select 1 from public.orders o where o.id = order_id and o.status = 'completed'
    and ((o.buyer_id = auth.uid() and subject_id = o.seller_id) or (o.seller_id = auth.uid() and subject_id = o.buyer_id))));
revoke insert, update, delete on public.reviews from anon, authenticated;
grant insert (order_id, author_id, subject_id, rating, comment) on public.reviews to authenticated;

-- ───────── denúncias, notificações, auditoria, config ─────────
create policy "staff read reports" on public.reports for select using (public.is_staff());
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (reporter_id, listing_id, reported_user_id, reason, details) on public.reports to authenticated;

revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "prefs own insert" on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
revoke delete on public.notification_preferences from anon, authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, user_agent text,
  created_at timestamptz not null default now());
alter table public.push_subscriptions enable row level security;
create policy "push own all" on public.push_subscriptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke insert, update, delete on public.app_config from anon, authenticated;
revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.bid_idempotency from anon, authenticated;
revoke all on public.bid_idempotency from anon, authenticated;
create policy "staff read audit" on public.audit_log for select using (public.is_staff());

-- ───────── índices ─────────
create index listings_status_ends_idx on public.listings(status, ends_at);
create index listings_seller_idx on public.listings(seller_id);
create index listings_category_idx on public.listings(category_id);
create index listings_search_idx on public.listings using gin(search_vec);
create index bids_listing_idx on public.bids(listing_id, created_at desc);
create index bids_bidder_idx on public.bids(bidder_id);
create index proxy_bidder_idx on public.proxy_bids(bidder_id);
create index orders_buyer_idx on public.orders(buyer_id);
create index orders_seller_idx on public.orders(seller_id);
create index questions_listing_idx on public.questions(listing_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index order_messages_order_idx on public.order_messages(order_id, created_at);
create index reviews_subject_idx on public.reviews(subject_id);
create index listing_images_listing_idx on public.listing_images(listing_id, sort_order);
create index watchlist_listing_idx on public.watchlist(listing_id);

-- ───────── storage (só existe no Supabase; ignorado em Postgres puro) ─────────
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
      ('listing-images','listing-images', true, 5242880, array['image/webp','image/jpeg','image/png']),
      ('avatars','avatars', true, 2097152, array['image/webp','image/jpeg','image/png']),
      ('dispute-evidence','dispute-evidence', false, 5242880, array['image/webp','image/jpeg','image/png'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
    execute $p$create policy "public buckets read" on storage.objects for select using (bucket_id in ('listing-images','avatars'))$p$;
    execute $p$create policy "own folder upload" on storage.objects for insert to authenticated
      with check (bucket_id in ('listing-images','avatars','dispute-evidence') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "own folder delete" on storage.objects for delete to authenticated
      using (bucket_id in ('listing-images','avatars','dispute-evidence') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "evidence read parties" on storage.objects for select to authenticated using (
      bucket_id = 'dispute-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()
        or exists (select 1 from public.dispute_evidence e join public.disputes d on d.id = e.dispute_id
                   join public.orders o on o.id = d.order_id where e.storage_path = name and auth.uid() in (o.buyer_id, o.seller_id))))$p$;
  end if;
end $$;
