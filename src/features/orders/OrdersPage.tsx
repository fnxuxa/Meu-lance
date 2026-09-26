import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, PackageCheck, PackageSearch, ShieldAlert, Star, Truck } from 'lucide-react';
import { BackButton } from '../../components/BackButton';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { useProfile } from '../auth/useProfile';
import { BuyerInterestCard } from './BuyerInterestCard';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { OrderCounterparty } from './OrderCounterparty';
import { DisputeThread } from '../disputes/DisputeThread';
import { OrderChat } from '../messaging/OrderChat';
import { DisputeCenter } from '../disputes/DisputeCenter';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { CONFIRMABLE_STATUSES, ConfirmReceiptButton } from './ConfirmReceiptButton';
import { SecondChanceOffers } from './SecondChanceOffers';
import { OrderImei } from './OrderImei';
const labels: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  awaiting_shipment: 'Aguardando envio',
  shipped: 'Enviado',
  delivered: 'Entregue',
  completed: 'Entregue e confirmado',
  disputed: 'Em disputa',
  payment_expired: 'Pagamento expirado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};
type OrderRow = {
  id: string;
  amount_cents: number;
  buyer_fee_cents: number | null;
  status: string;
  created_at: string;
  listings: { title: string } | null;
};
export function OrdersPage({ sales = false }: { sales?: boolean }) {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  useDocumentMeta({ title: sales ? 'Minhas vendas' : 'Meus pedidos', noindex: true });
  const query = useQuery({
    queryKey: ['orders', user?.id, sales],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('orders')
        .select('id,amount_cents,buyer_fee_cents,status,created_at,listings(title)')
        .eq(sales ? 'seller_id' : 'buyer_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });
  const refresh = () => {
    void query.refetch();
    void queryClient.invalidateQueries({ queryKey: ['order'] });
  };
  return (
    <main className="page simple">
      <BackButton />
      <h1>{sales ? 'Minhas vendas' : 'Meus pedidos'}</h1>
      {!sales && user && <SecondChanceOffers userId={user.id} />}
      {loading || (user && query.isPending) ? (
        <p>Carregando…</p>
      ) : !user ? (
        <Link to="/entrar">Entre para continuar</Link>
      ) : query.error ? (
        <div className="empty-state">
          <PackageSearch aria-hidden />
          <h2>Não conseguimos carregar {sales ? 'suas vendas' : 'seus pedidos'} agora</h2>
          <p>Tente novamente em instantes.</p>
          <button type="button" className="btn secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : query.data?.length ? (
        <div className="orders-list">
          {query.data.map((o) => (
            <div className="order-row-wrap" key={o.id}>
              <Link className="order-row" to={'/pedido/' + o.id}>
                <span>{o.listings?.title ?? 'Pedido ' + o.id.slice(0, 8)}</span>
                <strong>
                  {formatBRL(sales ? o.amount_cents : o.amount_cents + (o.buyer_fee_cents ?? 0))}
                </strong>
                <span className={'order-status-pill ' + o.status}>{labels[o.status] ?? o.status}</span>
              </Link>
              {!sales && CONFIRMABLE_STATUSES.includes(o.status) && (
                <ConfirmReceiptButton orderId={o.id} onSuccess={refresh} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <PackageSearch aria-hidden />
          <h2>{sales ? 'Nenhuma venda aqui ainda' : 'Nenhum pedido aqui ainda'}</h2>
          <p>
            {sales
              ? 'Quando um anúncio seu terminar com vencedor, a venda aparece aqui.'
              : 'Quando seu lance for o maior, o pedido aparece aqui.'}
          </p>
          {!sales && (
            <Link className="btn secondary" to="/buscar">
              Ver anúncios
            </Link>
          )}
        </div>
      )}
      {sales && (
        <div className="hero-actions">
          <Link className="btn secondary" to="/vender/novo">
            Criar anúncio
          </Link>
          <Link className="btn secondary" to="/conta/anuncios">
            Meus anúncios
          </Link>
        </div>
      )}
    </main>
  );
}
function ShipmentForm({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const [carrier, setCarrier] = useState(''),
    [tracking, setTracking] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('mark_order_shipped', {
        p_order: orderId,
        p_carrier: carrier.trim() || null,
        p_tracking: tracking.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="fulfillment-card" onSubmit={submit}>
      <h2>
        <Truck size={18} /> Marcar como enviado
      </h2>
      <p className="muted">
        Controle interno do MeuLance — o comprador é avisado, mas isso não confirma pagamento ou entrega junto
        ao Mercado Pago.
      </p>
      <div className="form-grid">
        <label>
          Transportadora (opcional)
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Correios, etc." />
        </label>
        <label>
          Código de rastreio (opcional)
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="BR123456789" />
        </label>
      </div>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Salvando…' : 'Marcar como enviado'}
      </button>
      {message && (
        <p role="status" className="auth-message error">
          {message}
        </p>
      )}
    </form>
  );
}
function ConfirmDeliveryCard({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  return (
    <div className="fulfillment-card highlight">
      <h2>
        <PackageCheck size={18} /> Recebeu o item?
      </h2>
      <p className="muted">
        Confirme aqui quando o item chegar ou quando você retirar em mãos e conferir. Isso encerra o pedido e
        libera sua avaliação. Se o item veio diferente do anunciado, não confirme: abra uma disputa.
      </p>
      <ConfirmReceiptButton orderId={orderId} onSuccess={onSuccess} />
    </div>
  );
}
function ReviewCard({
  orderId,
  authorId,
  subjectId,
  subjectLabel,
}: {
  orderId: string;
  authorId: string;
  subjectId: string;
  subjectLabel: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['review', orderId, authorId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('reviews')
        .select('rating,comment')
        .eq('order_id', orderId)
        .eq('author_id', authorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (query.isPending) return null;
  if (query.data) {
    return (
      <div className="fulfillment-card">
        <h2>
          <Star size={18} /> Sua avaliação de {subjectLabel}
        </h2>
        <div className="star-display">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={18} fill={n <= query.data!.rating ? 'currentColor' : 'none'} />
          ))}
        </div>
        {query.data.comment && <p className="muted">{query.data.comment}</p>}
      </div>
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy || !rating) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.from('reviews').insert({
        order_id: orderId,
        author_id: authorId,
        subject_id: subjectId,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      await query.refetch();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="fulfillment-card highlight" onSubmit={submit}>
      <h2>
        <Star size={18} /> Avalie {subjectLabel}
      </h2>
      <p className="muted">Sua nota ajuda outros usuários a confiar na plataforma.</p>
      <div className="star-picker">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-label={`${n} estrelas`}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
          >
            <Star size={26} fill={n <= (hoverRating || rating) ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea
        placeholder="Comentário (opcional)"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button className="btn primary" disabled={busy || !rating}>
        {busy ? 'Enviando…' : 'Enviar avaliação'}
      </button>
      {message && (
        <p role="status" className="auth-message error">
          {message}
        </p>
      )}
    </form>
  );
}
export function OrderPage() {
  const { id } = useParams();
  const { user, loading } = useSession();
  const profileQuery = useProfile();
  const queryClient = useQueryClient();
  useDocumentMeta({ title: 'Pedido', noindex: true });
  const query = useQuery({
    queryKey: ['order', id, user?.id],
    enabled: !!supabase && !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('orders')
        .select(
          'id,listing_id,buyer_id,seller_id,amount_cents,fee_cents,seller_net_cents,buyer_fee_cents,status,payment_due_at,tracking_code,carrier,shipped_at,confirmed_at,buyer_confirmed_interest_at,listings(title,slug,condition)',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as typeof data & { listings: { title: string; slug: string; condition: string } | null };
    },
  });
  function refresh() {
    void query.refetch();
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }
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
  const isBuyer = o.buyer_id === user.id;
  const isSeller = o.seller_id === user.id;
  return (
    <main className="page simple">
      <BackButton fallback="/conta/compras" />
      <h1>Pedido {o.id.slice(0, 8)}</h1>
      {o.listings && (
        <p>
          <Link to={'/l/' + o.listings.slug}>{o.listings.title}</Link>
        </p>
      )}
      <p>
        <span className={'order-status-pill ' + o.status}>{labels[o.status] ?? o.status}</span>
      </p>
      <dl className="order-amounts">
        <dt>Valor da compra</dt>
        <dd>{formatBRL(o.amount_cents)}</dd>
        {isBuyer && (
          <>
            <dt>Taxa de proteção do comprador</dt>
            <dd>{formatBRL(o.buyer_fee_cents)}</dd>
            <dt>Total a pagar</dt>
            <dd>
              <b>{formatBRL(o.amount_cents + o.buyer_fee_cents)}</b>
            </dd>
          </>
        )}
        {isSeller && (
          <>
            <dt>Comissão do MeuLance</dt>
            <dd>− {formatBRL(o.fee_cents)}</dd>
            <dt>Você recebe</dt>
            <dd>
              <b>{formatBRL(o.seller_net_cents)}</b>
            </dd>
          </>
        )}
      </dl>
      {isSeller && (
        <p className="muted" style={{ margin: '-8px 0 12px' }}>
          Esse valor ainda não desconta uma eventual taxa de saque do gateway de pagamento — será calculada
          quando a integração (Pagar.me/Iugu) for definida.
        </p>
      )}
      {o.status === 'pending_payment' && isBuyer && o.listings && (
        <BuyerInterestCard
          orderId={o.id}
          buyerName={profileQuery.data?.display_name ?? 'comprador'}
          itemTitle={o.listings.title}
          confirmedAt={o.buyer_confirmed_interest_at}
          onSuccess={refresh}
        />
      )}
      <OrderCounterparty orderId={o.id} status={o.status} isSeller={isSeller} />
      {o.status === 'pending_payment' && isSeller && (
        <p>
          O comprador teve o maior lance. Ainda estamos validando a estrutura de pagamento (CNPJ + retenção)
          antes de seguir com a cobrança — tenha paciência, você poderá enviar o item assim que tudo estiver
          pronto. Não faça combinações fora da plataforma.
        </p>
      )}
      {(o.tracking_code || o.carrier) && (
        <p className="tracking-line">
          <Truck size={15} />
          Rastreio: {o.carrier} {o.tracking_code}
        </p>
      )}
      {o.confirmed_at && (
        <p className="tracking-line">
          <CheckCircle2 size={15} />
          Recebimento confirmado em{' '}
          {new Date(o.confirmed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
      )}
      <OrderImei listingId={o.listing_id} isBuyer={isBuyer} />
      {isSeller && ['paid', 'awaiting_shipment'].includes(o.status) && (
        <ShipmentForm orderId={o.id} onSuccess={refresh} />
      )}
      {isBuyer && CONFIRMABLE_STATUSES.includes(o.status) && (
        <ConfirmDeliveryCard orderId={o.id} onSuccess={refresh} />
      )}
      {isBuyer && o.status === 'completed' && (
        <div className="notice">
          <ShieldAlert size={16} />O pagamento ao vendedor segue as regras do Mercado Pago para esse pedido.
          Isso ainda não está automatizado nesta versão.
        </div>
      )}
      {o.status === 'completed' && isBuyer && (
        <ReviewCard orderId={o.id} authorId={user.id} subjectId={o.seller_id} subjectLabel="o vendedor" />
      )}
      {o.status === 'completed' && isSeller && (
        <ReviewCard orderId={o.id} authorId={user.id} subjectId={o.buyer_id} subjectLabel="o comprador" />
      )}
      <DisputeThread orderId={o.id} userId={user.id} />
      <OrderChat key={o.id + user.id} orderId={o.id} userId={user.id} />
      {isBuyer && ['paid', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status) && (
        <DisputeCenter
          orderId={o.id}
          userId={user.id}
          asIs={o.listings?.condition === 'for_parts'}
          onSuccess={refresh}
        />
      )}
    </main>
  );
}
