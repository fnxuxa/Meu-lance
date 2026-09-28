-- Excluir/cancelar um anúncio de preço fixo com ofertas pendentes não pode deixar o
-- comprador esperando uma resposta que nunca vai vir: cancela as ofertas pendentes junto.
create or replace function public.cancel_listing(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; b record; o record;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.status not in ('draft', 'active') then raise exception 'NOT_CANCELLABLE'; end if;
  if l.bid_count > 0 and l.status = 'active' and l.ends_at - now() <= interval '1 day' then
    raise exception 'TOO_CLOSE_TO_END';
  end if;
  update public.listings set status = 'cancelled' where id = l.id;
  if l.bid_count > 0 then
    for b in select distinct bidder_id from public.bids where listing_id = l.id loop
      perform public._notify(
        b.bidder_id, 'system', 'Leilão cancelado pelo vendedor',
        'O vendedor cancelou "' || l.title || '" antes do fim. Nenhuma cobrança será feita.',
        '/l/' || l.slug
      );
    end loop;
  end if;
  for o in update public.price_offers set status = 'cancelled', responded_at = now()
      where listing_id = l.id and status = 'pending' returning buyer_id
  loop
    perform public._notify(
      o.buyer_id, 'system', 'Anúncio removido pelo vendedor',
      'O vendedor removeu "' || l.title || '" antes de responder sua oferta.',
      '/conta/lances'
    );
  end loop;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'listing_cancelled', 'listing', l.id::text);
end $$;
