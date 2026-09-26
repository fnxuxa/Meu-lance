import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Counterparty = {
  released: boolean;
  full_name?: string;
  address?: {
    zip: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

// Nome completo e endereço da outra parte: o servidor só devolve depois do pagamento do pedido.
export function OrderCounterparty({
  orderId,
  status,
  isSeller,
}: {
  orderId: string;
  status: string;
  isSeller: boolean;
}) {
  const query = useQuery({
    queryKey: ['order-counterparty', orderId, status],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_order_counterparty', { p_order_id: orderId });
      if (error) throw error;
      return data as Counterparty;
    },
  });
  const c = query.data;
  if (!c?.released) return null;
  const a = c.address;
  const line1 = a ? [a.street, a.number, a.complement].filter(Boolean).join(', ') : '';
  const line2 = a
    ? [a.neighborhood, [a.city, a.state].filter(Boolean).join(' - '), a.zip].filter(Boolean).join(' · ')
    : '';
  return (
    <section className="notice" aria-label={isSeller ? 'Dados para envio' : 'Dados do vendedor'}>
      <MapPin size={16} />
      <div>
        <b>
          {isSeller ? 'Enviar para' : 'Vendedor'}: {c.full_name}
        </b>
        {(line1 || line2) && (
          <p style={{ margin: '4px 0 0' }}>
            {line1}
            {line1 && line2 && <br />}
            {line2}
          </p>
        )}
        {!a?.street && isSeller && (
          <p style={{ margin: '4px 0 0' }}>
            O comprador ainda não cadastrou o endereço. Combine pelo chat do pedido.
          </p>
        )}
      </div>
    </section>
  );
}
