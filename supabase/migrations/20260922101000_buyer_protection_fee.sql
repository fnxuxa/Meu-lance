-- MeuLance: taxa de proteção do comprador (padrão 3%), cobrada além do valor arrematado.
-- O vendedor continua pagando a comissão (commission_bps) sobre o valor do item.
-- Total do comprador = amount_cents + buyer_fee_cents (calculado na UI e no checkout; não é coluna
-- gerada para não interferir na replicação).
insert into public.app_config(key, value) values ('buyer_fee_bps', '300') on conflict (key) do nothing;

alter table public.orders add column if not exists buyer_fee_cents bigint not null default 0;
alter table public.orders add constraint orders_buyer_fee_chk check (buyer_fee_cents >= 0);

-- Fechamento (idempotente) agora grava a taxa do comprador e sugere relançar leilões sem lances.
create or replace function public.close_due_auctions() returns integer language plpgsql security definer set search_path = public as $$
declare r public.listings; n integer := 0; leader uuid; bps int; buyer_bps int; hours int; fee bigint; buyer_fee bigint; oid uuid;
begin
  select (value #>> '{}')::int into bps from public.app_config where key = 'commission_bps';
  select (value #>> '{}')::int into buyer_bps from public.app_config where key = 'buyer_fee_bps';
  select (value #>> '{}')::int into hours from public.app_config where key = 'payment_deadline_hours';
  bps := case when bps between 0 and 10000 then bps else 500 end;
  buyer_bps := case when buyer_bps between 0 and 10000 then buyer_bps else 300 end;
  hours := coalesce(hours, 48);
  for r in select * from public.listings where status = 'active' and ends_at <= now() for update skip locked loop
    select bidder_id into leader from public.auction_leaders where listing_id = r.id;
    if leader is null then
      update public.listings set status = 'ended_no_bids' where id = r.id;
      perform public._notify(r.seller_id, 'system', 'Leilão encerrado sem lances',
        '"' || r.title || '" terminou sem lances. Relance com 1 clique — um valor inicial menor costuma atrair os primeiros lances.',
        '/conta/anuncios');
    else
      update public.listings set status = 'ended_with_winner' where id = r.id;
      fee := round(r.current_price_cents * bps / 10000.0);
      buyer_fee := round(r.current_price_cents * buyer_bps / 10000.0);
      insert into public.orders(listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_net_cents, buyer_fee_cents, status, payment_due_at)
        values (r.id, leader, r.seller_id, r.current_price_cents, fee, r.current_price_cents - fee, buyer_fee, 'pending_payment', now() + make_interval(hours => hours))
        on conflict (listing_id) do nothing returning id into oid;
      if oid is not null then
        perform public._notify(leader, 'won', 'Você venceu!', 'Você arrematou "' || r.title || '". Conclua o pagamento no prazo.', '/pedido/' || oid);
        perform public._notify(r.seller_id, 'order', 'Seu item foi arrematado', '"' || r.title || '" recebeu um lance vencedor.', '/pedido/' || oid);
        insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
          values (null, 'auction_closed', 'listing', r.id::text,
                  jsonb_build_object('amount_cents', r.current_price_cents, 'buyer_fee_cents', buyer_fee, 'order_id', oid));
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.close_due_auctions() from public, anon, authenticated;
grant execute on function public.close_due_auctions() to service_role;
