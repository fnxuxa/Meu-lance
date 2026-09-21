import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { OrderChat } from '../messaging/OrderChat';
import { DisputeCenter } from '../disputes/DisputeCenter';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
const labels: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  awaiting_shipment: 'Aguardando envio',
  shipped: 'Enviado',
  delivered: 'Entregue',
  completed: 'Concluído',
  disputed: 'Em disputa',
  payment_expired: 'Pagamento expirado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};
export function OrdersPage({ sales = false }: { sales?: boolean }) {
  const { user, loading } = useSession();
  useDocumentMeta({ title: sales ? 'Minhas vendas' : 'Minhas compras', noindex: true });
  const query = useQuery({
    queryKey: ['orders', user?.id, sales],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('orders')
        .select('id,amount_cents,status,created_at')
        .eq(sales ? 'seller_id' : 'buyer_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <main className="page simple">
      <h1>{sales ? 'Minhas vendas' : 'Minhas compras'}</h1>
      {loading || (user && query.isPending) ? (
        <p>Carregando…</p>
      ) : !user ? (
        <Link to="/entrar">Entre para continuar</Link>
      ) : query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : query.data?.length ? (
        query.data.map((o) => (
          <article key={o.id}>
            <Link to={'/pedido/' + o.id}>Pedido {o.id.slice(0, 8)}</Link>
            <p>
              {formatBRL(o.amount_cents)} · {labels[o.status] ?? o.status}
            </p>
          </article>
        ))
      ) : (
        <p>Nenhum pedido registrado.</p>
      )}
      {sales && <Link to="/vender/novo">Criar anúncio</Link>}
    </main>
  );
}
export function OrderPage() {
  const { id } = useParams();
  const { user, loading } = useSession();
  useDocumentMeta({ title: 'Pedido', noindex: true });
  const query = useQuery({
    queryKey: ['order', id, user?.id],
    enabled: !!supabase && !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('orders')
        .select('id,buyer_id,seller_id,amount_cents,status,payment_due_at,tracking_code,carrier')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (loading || (user && query.isPending))
    return (
      <main className="page simple">
        <p>Carregando pedido…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <Link to="/entrar">Entre para acessar o pedido</Link>
      </main>
    );
  if (query.error || !query.data)
    return (
      <main className="page simple">
        <h1>Pedido indisponível</h1>
        <p>{query.error ? errorMessage(query.error) : 'Pedido não encontrado ou sem acesso.'}</p>
      </main>
    );
  const o = query.data;
  return (
    <main className="page simple">
      <h1>Pedido {o.id.slice(0, 8)}</h1>
      <p>
        {formatBRL(o.amount_cents)} · {labels[o.status] ?? o.status}
      </p>
      {o.status === 'pending_payment' && (
        <p>Pagamentos estão indisponíveis nesta versão. Não faça transferências por fora da plataforma.</p>
      )}
      {o.tracking_code && (
        <p>
          Rastreio: {o.carrier} · {o.tracking_code}
        </p>
      )}
      <OrderChat key={o.id + user.id} orderId={o.id} userId={user.id} />
      {o.buyer_id === user.id && ['paid', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status) && (
        <DisputeCenter
          orderId={o.id}
          userId={user.id}
          onSuccess={() => {
            void query.refetch();
          }}
        />
      )}
    </main>
  );
}
