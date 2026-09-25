-- Até aqui não existia NENHUM jeito de encerrar uma disputa — nem no /admin, nem no banco
-- (o enum dispute_status tinha resolved_buyer/resolved_seller, mas nenhuma função levava até lá).
-- Moderador decide: resolved_buyer (reembolso) ou resolved_seller (liberação), com justificativa
-- obrigatória, que vai para audit_log (AGENTS.md §9). Pagamento real ainda não existe
-- (PAYMENTS_LIVE=false): isso só move o status do pedido — não movimenta dinheiro de verdade.
create or replace function public.resolve_dispute(p_dispute uuid, p_resolution text, p_note text)
returns public.disputes language plpgsql security definer set search_path = public as $$
declare d public.disputes; o public.orders;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if p_resolution not in ('buyer', 'seller') then raise exception 'INVALID_RESOLUTION'; end if;
  if p_note is null or char_length(trim(p_note)) < 10 then raise exception 'NOTE_TOO_SHORT'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if d.id is null then raise exception 'NOT_FOUND'; end if;
  if d.status in ('resolved_buyer', 'resolved_seller', 'cancelled') then raise exception 'ALREADY_RESOLVED'; end if;
  select * into o from public.orders where id = d.order_id for update;
  update public.disputes
    set status = (case when p_resolution = 'buyer' then 'resolved_buyer' else 'resolved_seller' end)::public.dispute_status,
        resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now()
    where id = p_dispute
    returning * into d;
  if p_resolution = 'buyer' then
    update public.orders set status = 'refunded' where id = o.id;
    perform public._notify(o.buyer_id, 'dispute', 'Disputa resolvida a seu favor',
      'A equipe do MeuLance analisou sua disputa e decidiu pelo reembolso: ' || p_note, '/pedido/' || o.id);
    perform public._notify(o.seller_id, 'dispute', 'Disputa resolvida a favor do comprador',
      'A equipe do MeuLance decidiu pelo reembolso ao comprador neste pedido: ' || p_note, '/pedido/' || o.id);
  else
    update public.orders set status = 'completed', completed_at = now() where id = o.id;
    perform public._notify(o.seller_id, 'dispute', 'Disputa resolvida a seu favor',
      'A equipe do MeuLance analisou a disputa e decidiu pela liberação do valor a você: ' || p_note, '/pedido/' || o.id);
    perform public._notify(o.buyer_id, 'dispute', 'Disputa resolvida a favor do vendedor',
      'A equipe do MeuLance decidiu pela liberação do valor ao vendedor neste pedido: ' || p_note, '/pedido/' || o.id);
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'dispute_resolved', 'dispute', p_dispute::text,
            jsonb_build_object('resolution', p_resolution, 'note', p_note));
  return d;
end $$;
revoke all on function public.resolve_dispute(uuid, text, text) from public, anon;
grant execute on function public.resolve_dispute(uuid, text, text) to authenticated;
