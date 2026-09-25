-- Correção: cleanup_expired_listings() vinha falhando (silenciosamente, todo dia às 3h30 via
-- cron) sempre que o leilão tinha foto — o Supabase Storage bloqueia DELETE direto em
-- storage.objects (trigger protect_objects_delete) a não ser que a flag de sessão
-- storage.allow_delete_query esteja ligada. A função nunca ligava essa flag, então a exclusão
-- do arquivo lançava exceção e desfazia a limpeza inteira daquele leilão (nada era apagado).
-- Aproveitado para tornar a retenção configurável (padrão do resto do app_config, igual ao
-- imei_retention_days) em vez de fixa no cron, e para dar um prazo próprio às notificações.
insert into public.app_config(key, value) values
  ('listing_retention_days', '30'),
  ('notification_retention_days', '30')
  on conflict (key) do nothing;

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
  perform set_config('storage.allow_delete_query', 'true', true);
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
    delete from storage.objects where bucket_id = 'listing-images' and public._storage_path_matches_listing(name, l.id);
    delete from public.listings where id = l.id;
    n := n + 1;
  end loop;
  perform set_config('storage.allow_delete_query', 'false', true);
  perform set_config('meulance.bid_purge', 'off', true);
  if n > 0 then
    insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'listings_auto_cleaned', 'system', null, jsonb_build_object('count', n, 'retention_days', days));
  end if;
  return n;
end $$;
revoke all on function public.cleanup_expired_listings(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_listings(integer) to service_role;

-- Notificações in-app não têm nenhuma limpeza hoje (crescem pra sempre). Sem peso jurídico
-- (não é audit_log nem prova de leilão), então pode ter retenção curta e configurável.
create or replace function public.purge_old_notifications() returns integer
  language plpgsql security definer set search_path = public as $$
declare days int; n int;
begin
  select (value #>> '{}')::int into days from public.app_config where key = 'notification_retention_days';
  days := greatest(coalesce(days, 30), 1);
  delete from public.notifications where created_at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_notifications() from public, anon, authenticated;
grant execute on function public.purge_old_notifications() to service_role;
