-- MeuLance: o comprador confirma o recebimento por um botão na plataforma (Meus pedidos / pedido),
-- também na retirada em mãos. Não existe código de retirada. Pode confirmar a partir do pagamento,
-- porque na retirada o vendedor não marca envio.
create or replace function public.confirm_delivery(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is distinct from o.buyer_id then raise exception 'FORBIDDEN'; end if;
  if o.status = 'completed' then return o; end if;
  if o.status not in ('paid', 'awaiting_shipment', 'shipped', 'delivered') then raise exception 'INVALID_ORDER_STATE'; end if;
  update public.orders
    set status = 'completed', confirmed_at = now(), completed_at = now()
    where id = p_order
    returning * into o;
  perform public._notify(o.seller_id, 'order', 'Recebimento confirmado',
    'O comprador confirmou o recebimento do pedido.', '/pedido/' || o.id);
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'delivery_confirmed', 'order', o.id::text);
  return o;
end $$;
revoke all on function public.confirm_delivery(uuid) from public, anon;
grant execute on function public.confirm_delivery(uuid) to authenticated;
