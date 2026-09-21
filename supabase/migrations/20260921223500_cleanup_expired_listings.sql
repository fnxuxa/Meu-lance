-- Limpeza automática: remove leilões concluídos há mais de N dias para não acumular dados sem uso.
-- "Concluído" = leilão sem vencedor (ended_no_bids/cancelled/removed) OU com pedido em estado terminal
-- (completed/refunded/cancelled) e sem nenhuma disputa registrada (disputas nunca são apagadas automaticamente).

-- 1) corrige FKs que hoje bloqueiam a exclusão de um leilão (NO ACTION -> CASCADE), e preserva
--    denúncias (reports) trocando a referência por SET NULL em vez de bloquear/apagar o registro.
alter table public.bids drop constraint bids_listing_id_fkey,
  add constraint bids_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade;
alter table public.proxy_bids drop constraint proxy_bids_listing_id_fkey,
  add constraint proxy_bids_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade;
alter table public.proxy_requests drop constraint proxy_requests_listing_id_fkey,
  add constraint proxy_requests_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade;
alter table public.watchlist drop constraint watchlist_listing_id_fkey,
  add constraint watchlist_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade;
alter table public.orders drop constraint orders_listing_id_fkey,
  add constraint orders_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade;
alter table public.disputes drop constraint disputes_order_id_fkey,
  add constraint disputes_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table public.reviews drop constraint reviews_order_id_fkey,
  add constraint reviews_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table public.reports drop constraint reports_listing_id_fkey,
  add constraint reports_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete set null;

-- 2) rastreia quando um pedido chegou a um estado terminal, para contar os 10 dias a partir daí.
alter table public.orders add column if not exists updated_at timestamptz not null default now();
create or replace function public._touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
  for each row execute function public._touch_updated_at();

-- 3) helper: caminho de storage segue o padrão `<seller_id>/<listing_id>/<arquivo>`.
create or replace function public._storage_path_matches_listing(p_name text, p_listing_id uuid) returns boolean
  language sql immutable as $$
  select split_part(p_name, '/', 2) = p_listing_id::text;
$$;

-- 4) função de limpeza: apaga fotos do storage e depois o leilão (cascata cuida do resto).
create or replace function public.cleanup_expired_listings(p_days integer default 10) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer := 0; l record;
begin
  if p_days < 3 then raise exception 'RETENTION_TOO_SHORT'; end if;
  for l in
    select li.id, li.slug
    from public.listings li
    left join public.orders o on o.listing_id = li.id
    where
      (
        li.status in ('ended_no_bids', 'cancelled', 'removed')
        and coalesce(li.ends_at, li.created_at) < now() - make_interval(days => p_days)
      )
      or (
        li.status = 'ended_with_winner'
        and o.status in ('completed', 'refunded', 'cancelled', 'payment_expired')
        and o.updated_at < now() - make_interval(days => p_days)
        and not exists (select 1 from public.disputes d where d.order_id = o.id)
      )
    for update of li skip locked
  loop
    delete from storage.objects
      where bucket_id = 'listing-images'
        and public._storage_path_matches_listing(name, l.id);
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
