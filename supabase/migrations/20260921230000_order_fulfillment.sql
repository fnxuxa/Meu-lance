-- Fluxo de cumprimento de pedido: vendedor marca envio, comprador confirma recebimento.
-- orders só é escrito pelo servidor (revoke em hardening.sql) — tudo passa por função
-- security definer que valida quem é a parte certa e o estado atual do pedido.

create or replace function public.mark_order_shipped(p_order uuid, p_carrier text, p_tracking text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() <> o.seller_id then raise exception 'FORBIDDEN'; end if;
  if o.status not in ('paid', 'awaiting_shipment') then raise exception 'INVALID_ORDER_STATE'; end if;
  if p_carrier is not null and char_length(p_carrier) > 60 then raise exception 'CARRIER_TOO_LONG'; end if;
  if p_tracking is not null and char_length(p_tracking) > 60 then raise exception 'TRACKING_TOO_LONG'; end if;
  update public.orders
    set status = 'shipped', shipped_at = now(),
        carrier = nullif(trim(p_carrier), ''), tracking_code = nullif(trim(p_tracking), '')
    where id = p_order
    returning * into o;
  perform public._notify(
    o.buyer_id, 'order', 'Seu pedido foi enviado',
    case when o.tracking_code is not null
      then 'O vendedor marcou o pedido como enviado. Rastreio: ' || coalesce(o.carrier, '') || ' ' || o.tracking_code
      else 'O vendedor marcou o pedido como enviado.' end,
    '/pedido/' || o.id
  );
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'order_shipped', 'order', o.id::text);
  return o;
end $$;
revoke all on function public.mark_order_shipped(uuid, text, text) from public, anon;
grant execute on function public.mark_order_shipped(uuid, text, text) to authenticated;

-- IMPORTANTE: esta função só atualiza o status interno do pedido (para liberar a
-- avaliação e sinalizar o fim do prazo de disputa). Ela NÃO libera o pagamento ao
-- vendedor no Mercado Pago — isso é uma decisão separada, ainda em aberto (ver
-- AGENTS.md seção 6 e 15), que exige confirmar com o Mercado Pago se o produto
-- contratado suporta retenção/liberação após confirmação de entrega.
create or replace function public.confirm_delivery(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() <> o.buyer_id then raise exception 'FORBIDDEN'; end if;
  if o.status not in ('shipped', 'delivered') then raise exception 'INVALID_ORDER_STATE'; end if;
  update public.orders
    set status = 'completed', confirmed_at = now(), completed_at = now()
    where id = p_order
    returning * into o;
  perform public._notify(
    o.seller_id, 'order', 'Recebimento confirmado',
    'O comprador confirmou o recebimento do pedido.',
    '/pedido/' || o.id
  );
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'delivery_confirmed', 'order', o.id::text);
  return o;
end $$;
revoke all on function public.confirm_delivery(uuid) from public, anon;
grant execute on function public.confirm_delivery(uuid) to authenticated;
