-- MeuLance: sinais de demanda para decidir quando abrir CNPJ e contratar o gateway (Pagar.me/Iugu),
-- sem pagamento real ainda (PAYMENTS_LIVE=false). Tudo aqui é aditivo e fácil de remover depois:
-- basta parar de chamar confirm_buyer_interest/salvar endereço quando o checkout de verdade entrar,
-- sem precisar desfazer nada no fluxo de lances/leilão.

-- ── whatsapp do vencedor, capturado só quando ele confirma que quer continuar ──
alter table public.orders add column if not exists buyer_whatsapp text;

-- ── endereço de entrega do comprador, salvo desde já para quando o envio for liberado ──
alter table public.profiles
  add column if not exists address_zip text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text;
grant update (address_zip, address_street, address_number, address_complement, address_neighborhood)
  on public.profiles to authenticated;

drop function if exists public.confirm_buyer_interest(uuid);
create or replace function public.confirm_buyer_interest(p_order uuid, p_whatsapp text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; digits text;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is distinct from o.buyer_id then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'pending_payment' then raise exception 'INVALID_ORDER_STATE'; end if;
  if o.buyer_confirmed_interest_at is not null then return o; end if;
  digits := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if char_length(digits) not between 10 and 13 then raise exception 'INVALID_WHATSAPP'; end if;
  update public.orders
    set buyer_confirmed_interest_at = now(), buyer_whatsapp = digits
    where id = p_order
    returning * into o;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'buyer_confirmed_interest', 'order', o.id::text);
  perform public._notify(o.seller_id, 'order', 'Comprador confirmou interesse',
    'O comprador do seu anúncio confirmou que quer continuar. Ainda estamos validando a estrutura de ' ||
    'pagamento — tenha paciência, você poderá enviar o item assim que tudo estiver pronto.',
    '/pedido/' || o.id);
  return o;
end $$;
revoke all on function public.confirm_buyer_interest(uuid, text) from public, anon;
grant execute on function public.confirm_buyer_interest(uuid, text) to authenticated;
