-- Revisão de terminologia/posicionamento (docs/TERMINOLOGIA_E_POSICIONAMENTO.md): só troca o texto das
-- notificações mostradas ao usuário. Mecânica, nomes internos (close_due_auctions, auction_leaders,
-- notification_kind etc.) e migrations históricas continuam exatamente iguais — reproduzido aqui só o
-- corpo das duas funções com os literais de texto trocados.
create or replace function public.close_due_auctions() returns integer language plpgsql security definer set search_path = public as $$
declare r public.listings; n integer := 0; leader uuid; f record; oid uuid;
begin
  for r in select * from public.listings where status = 'active' and ends_at <= now() for update skip locked loop
    select bidder_id into leader from public.auction_leaders where listing_id = r.id;
    if leader is null then
      update public.listings set status = 'ended_no_bids' where id = r.id;
      perform public._notify(r.seller_id, 'system', 'Anúncio encerrado sem lances',
        '"' || r.title || '" terminou sem lances. Relance com 1 clique — um valor inicial menor costuma atrair os primeiros lances.',
        '/conta/anuncios');
    else
      update public.listings set status = 'ended_with_winner' where id = r.id;
      select * into f from public._order_fees(r.current_price_cents);
      oid := null;
      insert into public.orders(listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_net_cents, buyer_fee_cents, status, payment_due_at)
        values (r.id, leader, r.seller_id, r.current_price_cents, f.fee, r.current_price_cents - f.fee, f.buyer_fee, 'pending_payment', public._payment_deadline())
        on conflict (listing_id) where status not in ('payment_expired', 'cancelled') do nothing
        returning id into oid;
      if oid is not null then
        perform public._notify(leader, 'won', 'Seu lance foi o maior!', 'Seu lance foi o maior em "' || r.title || '". Conclua o pagamento no prazo.', '/pedido/' || oid);
        perform public._notify(r.seller_id, 'order', 'Seu item foi vendido', '"' || r.title || '" recebeu um lance vencedor.', '/pedido/' || oid);
        insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
          values (null, 'auction_closed', 'listing', r.id::text,
                  jsonb_build_object('amount_cents', r.current_price_cents, 'buyer_fee_cents', f.buyer_fee, 'order_id', oid));
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.close_due_auctions() from public, anon, authenticated;
grant execute on function public.close_due_auctions() to service_role;

create or replace function public._notify_saved_searches() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then return new; end if;
  for s in
    select distinct on (ss.user_id) ss.id, ss.user_id
      from public.saved_searches ss
      join public.profiles p on p.id = ss.user_id and p.banned_at is null
     where ss.user_id <> new.seller_id
       and (ss.category_id is null or ss.category_id = new.category_id)
       and (ss.condition is null or ss.condition = new.condition)
       and (ss.state is null or ss.state = new.state)
       and (ss.max_price_cents is null or new.start_price_cents <= ss.max_price_cents)
       and (ss.query is null
            or new.search_vec @@ websearch_to_tsquery('portuguese', ss.query)
            or public._fold(new.title) like '%' || public._fold(ss.query) || '%')
     order by ss.user_id, ss.created_at
     limit 1000
  loop
    perform public._notify(s.user_id, 'system', 'Novo anúncio na sua busca salva',
      '"' || new.title || '" acabou de ser publicado.', '/l/' || new.slug);
    update public.saved_searches set last_notified_at = now() where id = s.id;
  end loop;
  return new;
end $$;
