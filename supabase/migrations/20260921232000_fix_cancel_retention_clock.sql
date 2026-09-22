-- cancel_listing() deixava ends_at com a data ORIGINAL do fim do leilão, então a
-- limpeza automática (10 dias após ends_at) contava a partir do fim que o leilão
-- teria tido, não da data real do cancelamento — um anúncio cancelado no dia 1 de
-- um leilão de 10 dias só sumia ~19 dias depois, não 10. Agora ends_at é ajustado
-- para o momento do cancelamento, então a contagem de 10 dias começa dali.
create or replace function public.cancel_listing(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; b record;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.status not in ('draft', 'active') then raise exception 'NOT_CANCELLABLE'; end if;
  if l.bid_count > 0 and l.status = 'active' and l.ends_at - now() <= interval '1 day' then
    raise exception 'TOO_CLOSE_TO_END';
  end if;
  update public.listings set status = 'cancelled', ends_at = now() where id = l.id;
  if l.bid_count > 0 then
    for b in select distinct bidder_id from public.bids where listing_id = l.id loop
      perform public._notify(
        b.bidder_id, 'system', 'Leilão cancelado pelo vendedor',
        'O vendedor cancelou "' || l.title || '" antes do fim. Nenhuma cobrança será feita.',
        '/l/' || l.slug
      );
    end loop;
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'listing_cancelled', 'listing', l.id::text);
end $$;
