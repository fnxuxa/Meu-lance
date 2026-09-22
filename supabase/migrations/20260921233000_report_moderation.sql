-- Moderação de denúncias: staff pode marcar como resolvida/descartada e, se for
-- o caso, remover o anúncio denunciado (avisando o vendedor).

create or replace function public.resolve_report(p_id uuid, p_status text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'INVALID_STATUS'; end if;
  update public.reports set status = p_status where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'report_reviewed', 'report', p_id::text, jsonb_build_object('status', p_status));
end $$;
revoke all on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.resolve_report(uuid, text) to authenticated;

create or replace function public.staff_remove_listing(p_listing uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if l.status not in ('draft', 'active') then raise exception 'NOT_REMOVABLE'; end if;
  update public.listings set status = 'removed' where id = p_listing;
  perform public._notify(
    l.seller_id, 'system', 'Anúncio removido pela moderação',
    '"' || l.title || '" foi removido por violar as regras do MeuLance.' ||
      case when p_reason is not null then ' Motivo: ' || p_reason else '' end,
    '/conta/anuncios'
  );
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'listing_removed_by_staff', 'listing', p_listing::text, jsonb_build_object('reason', p_reason));
end $$;
revoke all on function public.staff_remove_listing(uuid, text) from public, anon;
grant execute on function public.staff_remove_listing(uuid, text) to authenticated;
