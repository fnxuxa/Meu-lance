-- MeuLance: reputação que não some com a limpeza automática.
-- A limpeza apaga leilão e pedido 10 dias após a conclusão; antes disso, as avaliações iam junto
-- (FK em cascata) e "vendas concluídas" era contado nos pedidos. Agora:
--  * avaliação fica (order_id vira NULL) e guarda o papel avaliado e o título do item;
--  * vendas concluídas é um contador no perfil, somado quando o pedido vira completed;
--  * no perfil público, rating_avg/rating_count são só avaliações como VENDEDOR
--    (avaliações como comprador ficam em buyer_rating_*).

alter table public.reviews drop constraint reviews_order_id_fkey,
  add constraint reviews_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;
alter table public.reviews alter column order_id drop not null;
alter table public.reviews
  add column if not exists subject_role text check (subject_role in ('seller', 'buyer')),
  add column if not exists listing_title text;

update public.reviews r
   set subject_role = case when o.seller_id = r.subject_id then 'seller' else 'buyer' end,
       listing_title = l.title
  from public.orders o join public.listings l on l.id = o.listing_id
 where o.id = r.order_id and r.subject_role is null;

create or replace function public._review_snapshot() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select case when o.seller_id = new.subject_id then 'seller' else 'buyer' end, l.title
    into new.subject_role, new.listing_title
    from public.orders o join public.listings l on l.id = o.listing_id where o.id = new.order_id;
  return new;
end $$;
create trigger reviews_snapshot before insert on public.reviews for each row execute function public._review_snapshot();
revoke all on function public._review_snapshot() from public, anon, authenticated;
create index if not exists reviews_subject_role_idx on public.reviews(subject_id, subject_role);

-- contador durável de vendas concluídas
alter table public.profiles add column if not exists completed_sales_count integer not null default 0;
update public.profiles p set completed_sales_count = s.n
  from (select seller_id, count(*)::int n from public.orders where status = 'completed' group by seller_id) s
 where s.seller_id = p.id;

create or replace function public._count_completed_sale() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.profiles set completed_sales_count = completed_sales_count + 1 where id = new.seller_id;
  end if;
  return new;
end $$;
create trigger orders_count_completed_sale after update of status on public.orders
  for each row execute function public._count_completed_sale();
revoke all on function public._count_completed_sale() from public, anon, authenticated;

-- usuário não altera o próprio contador
create or replace function public.guard_profile_privileged() returns trigger language plpgsql as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin')
     and (new.role is distinct from old.role or new.seller_status is distinct from old.seller_status
       or new.strikes_count is distinct from old.strikes_count or new.phone_e164 is distinct from old.phone_e164
       or new.phone_verified_at is distinct from old.phone_verified_at or new.email_verified_at is distinct from old.email_verified_at
       or new.identity_verified_at is distinct from old.identity_verified_at or new.banned_at is distinct from old.banned_at
       or new.completed_sales_count is distinct from old.completed_sales_count) then
    raise exception 'PRIVILEGED_COLUMN';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop view if exists public.public_profiles;
create view public.public_profiles as
select p.id, p.display_name, p.city, p.state, p.avatar_url, p.created_at,
       (p.email_verified_at is not null) as email_verified,
       (p.phone_verified_at is not null) as phone_verified,
       (p.identity_verified_at is not null) as identity_verified,
       p.completed_sales_count as completed_sales,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id and r.subject_role = 'seller') as rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id and r.subject_role = 'seller')::int as rating_count,
       (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active')::int as active_listings,
       (select count(*) from public.seller_follows f where f.seller_id = p.id)::int as follower_count,
       (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.subject_id = p.id and r.subject_role = 'buyer') as buyer_rating_avg,
       (select count(*) from public.reviews r where r.subject_id = p.id and r.subject_role = 'buyer')::int as buyer_rating_count
from public.profiles p where p.banned_at is null;
grant select on public.public_profiles to anon, authenticated;
