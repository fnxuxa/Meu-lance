-- cleanup_expired_listings apagava a foto com DELETE em storage.objects. Isso remove só a linha:
-- o arquivo continua no armazenamento (órfão). Agora os caminhos vão para storage_purge_queue e a
-- rota /api/purge-storage remove o arquivo (e a linha) pela API oficial do Storage.
create or replace function public.cleanup_expired_listings(p_days integer default null) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer := 0; l record; days integer := p_days;
begin
  if days is null then
    select (value #>> '{}')::int into days from public.app_config where key = 'listing_retention_days';
    days := coalesce(days, 30);
  end if;
  if days < 3 then raise exception 'RETENTION_TOO_SHORT'; end if;
  perform set_config('meulance.bid_purge', 'on', true);
  for l in
    select li.id from public.listings li
    where (
        li.status in ('ended_no_bids', 'cancelled', 'removed')
        and coalesce(li.ends_at, li.created_at) < now() - make_interval(days => days)
      ) or (
        li.status = 'ended_with_winner'
        and exists (select 1 from public.orders o where o.listing_id = li.id)
        and not exists (select 1 from public.orders o where o.listing_id = li.id
                         and (o.status not in ('completed','refunded','cancelled','payment_expired')
                              or o.updated_at >= now() - make_interval(days => days)))
        and not exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id where o.listing_id = li.id)
        and not exists (select 1 from public.second_chance_offers s where s.listing_id = li.id and s.status = 'pending')
        and not exists (select 1 from public.listing_imeis i where i.listing_id = li.id)
      )
    for update of li skip locked
  loop
    insert into public.storage_purge_queue(bucket, path)
      select 'listing-images', name from storage.objects
      where bucket_id = 'listing-images' and public._storage_path_matches_listing(name, l.id);
    delete from public.listings where id = l.id;
    n := n + 1;
  end loop;
  perform set_config('meulance.bid_purge', 'off', true);
  if n > 0 then
    insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'listings_auto_cleaned', 'system', null, jsonb_build_object('count', n, 'retention_days', days));
  end if;
  return n;
end $$;
revoke all on function public.cleanup_expired_listings(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_listings(integer) to service_role;
