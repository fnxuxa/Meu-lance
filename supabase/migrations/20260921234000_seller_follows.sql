-- Seguir vendedor: distinto de "seguir leilão" (watchlist). Segue a pessoa, não um item.
create table public.seller_follows(
  follower_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, seller_id),
  check (follower_id <> seller_id)
);
alter table public.seller_follows enable row level security;
create index seller_follows_seller_idx on public.seller_follows(seller_id);

create policy "own follows read" on public.seller_follows
  for select using (auth.uid() = follower_id or auth.uid() = seller_id);
create policy "own follows insert" on public.seller_follows
  for insert to authenticated with check (auth.uid() = follower_id);
create policy "own follows delete" on public.seller_follows
  for delete to authenticated using (auth.uid() = follower_id);
revoke update on public.seller_follows from anon, authenticated;

-- contagem de seguidores exposta no perfil público
drop view if exists public.public_profiles;
create view public.public_profiles as
select p.id, p.display_name, p.city, p.state, p.avatar_url, p.created_at,
       (p.email_verified_at is not null) as email_verified,
       (p.phone_verified_at is not null) as phone_verified,
       (p.identity_verified_at is not null) as identity_verified,
       (select count(*) from public.orders o where o.seller_id = p.id and o.status = 'completed')::int as completed_sales,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id) as rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id)::int as rating_count,
       (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active')::int as active_listings,
       (select count(*) from public.seller_follows f where f.seller_id = p.id)::int as follower_count
from public.profiles p where p.banned_at is null;
grant select on public.public_profiles to anon, authenticated;

-- notifica o vendedor quando alguém começa a segui-lo
create or replace function public._notify_seller_followed() returns trigger
  language plpgsql security definer set search_path = public as $$
declare follower_name text;
begin
  select display_name into follower_name from public.profiles where id = new.follower_id;
  perform public._notify(
    new.seller_id, 'system', 'Novo seguidor',
    coalesce(follower_name, 'Alguém') || ' começou a seguir você.',
    '/vendedor/' || new.seller_id
  );
  return new;
end $$;
create trigger seller_followed_notify after insert on public.seller_follows
  for each row execute function public._notify_seller_followed();
