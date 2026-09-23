-- Correção: a limpeza automática falhava para todo leilão com lances.
-- Apagar o leilão apaga os lances em cascata, e a trava de imutabilidade (block_bid_mutation)
-- abortava o job inteiro (desfazendo também as outras exclusões da mesma execução).
-- Agora a trava só abre para a limpeza: exige usuário privilegiado E a chave de transação
-- meulance.bid_purge ligada pela própria cleanup_expired_listings. UPDATE continua sempre proibido.
-- chave de idempotência de um lance apagado não serve mais para nada
alter table public.bid_idempotency drop constraint bid_idempotency_bid_id_fkey,
  add constraint bid_idempotency_bid_id_fkey foreign key (bid_id) references public.bids(id) on delete cascade;

create or replace function public.block_bid_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and current_user in ('postgres', 'service_role', 'supabase_admin')
     and current_setting('meulance.bid_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'BIDS_IMMUTABLE';
end $$;

create or replace function public.cleanup_expired_listings(p_days integer default 10) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer := 0; l record;
begin
  if p_days < 3 then raise exception 'RETENTION_TOO_SHORT'; end if;
  perform set_config('meulance.bid_purge', 'on', true);
  for l in
    select li.id from public.listings li
    where (
        li.status in ('ended_no_bids', 'cancelled', 'removed')
        and coalesce(li.ends_at, li.created_at) < now() - make_interval(days => p_days)
      ) or (
        li.status = 'ended_with_winner'
        and exists (select 1 from public.orders o where o.listing_id = li.id)
        and not exists (select 1 from public.orders o where o.listing_id = li.id
                         and (o.status not in ('completed','refunded','cancelled','payment_expired')
                              or o.updated_at >= now() - make_interval(days => p_days)))
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
  perform set_config('meulance.bid_purge', 'off', true);
  if n > 0 then
    insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'listings_auto_cleaned', 'system', null, jsonb_build_object('count', n, 'retention_days', p_days));
  end if;
  return n;
end $$;
revoke all on function public.cleanup_expired_listings(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_listings(integer) to service_role;
