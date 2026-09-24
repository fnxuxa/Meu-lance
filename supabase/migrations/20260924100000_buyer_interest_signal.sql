-- MeuLance: fase de validação sem pagamento ativo (PAYMENTS_LIVE=false). O comprador que venceu
-- confirma, por um botão, que ainda quer fechar a compra assim que a estrutura de pagamento
-- (CNPJ + retenção) estiver pronta. Serve só de sinal de demanda; não gera cobrança nem obrigação.
alter table public.orders add column if not exists buyer_confirmed_interest_at timestamptz;

create or replace function public.confirm_buyer_interest(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if auth.uid() is distinct from o.buyer_id then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'pending_payment' then raise exception 'INVALID_ORDER_STATE'; end if;
  if o.buyer_confirmed_interest_at is not null then return o; end if;
  update public.orders
    set buyer_confirmed_interest_at = now()
    where id = p_order
    returning * into o;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'buyer_confirmed_interest', 'order', o.id::text);
  return o;
end $$;
revoke all on function public.confirm_buyer_interest(uuid) from public, anon;
grant execute on function public.confirm_buyer_interest(uuid) to authenticated;
