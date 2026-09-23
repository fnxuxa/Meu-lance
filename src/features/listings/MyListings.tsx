import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ImageOff, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { BackButton } from '../../components/BackButton';
import { RelistForm } from './RelistForm';
type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  current_price_cents: number;
  start_price_cents: number;
  orders: { status: string }[] | null;
  second_chance_offers: { status: string }[] | null;
  bid_count: number;
  ends_at: string | null;
  listing_images: { storage_path: string; sort_order: number }[];
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Em andamento',
  ended_with_winner: 'Encerrado (vendido)',
  ended_no_bids: 'Encerrado sem lances',
  cancelled: 'Cancelado',
  removed: 'Removido',
};
/** Mesma regra de relist_listing(): sem lances, ou vencedor que não pagou e nada em andamento. */
function relistReason(l: Row): 'no_bids' | 'unpaid' | null {
  if (l.status === 'ended_no_bids') return 'no_bids';
  if (
    l.status === 'ended_with_winner' &&
    !!l.orders?.length &&
    l.orders.every((o) => ['payment_expired', 'cancelled'].includes(o.status)) &&
    !l.second_chance_offers?.some((o) => o.status === 'pending')
  )
    return 'unpaid';
  return null;
}
function cancelability(l: Row): { canCancel: boolean; reason?: string } {
  if (!['draft', 'active'].includes(l.status)) return { canCancel: false };
  if (l.bid_count === 0) return { canCancel: true };
  if (!l.ends_at) return { canCancel: true };
  const hoursLeft = (new Date(l.ends_at).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft > 24) return { canCancel: true };
  return {
    canCancel: false,
    reason: 'Tem lance e falta menos de 1 dia para o fim — não pode mais cancelar.',
  };
}
export function MyListings() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useDocumentMeta({ title: 'Meus anúncios', noindex: true });
  const query = useQuery({
    queryKey: ['my-listings', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('listings')
        .select(
          'id,slug,title,status,current_price_cents,start_price_cents,bid_count,ends_at,listing_images(storage_path,sort_order),orders(status),second_chance_offers(status)',
        )
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map((l) => {
        const image = [...(l.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return {
          ...l,
          image: image
            ? supabase!.storage.from('listing-images').getPublicUrl(image.storage_path).data.publicUrl
            : null,
        };
      });
    },
  });
  async function cancel(id: string) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('cancel_listing', { p_listing: id });
      if (error) throw error;
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  if (loading || (user && query.isPending))
    return (
      <main className="page simple">
        <p>Carregando seus anúncios…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Meus anúncios</h1>
        <Link className="btn primary" to="/entrar">
          Entrar
        </Link>
      </main>
    );
  return (
    <main className="account-shell">
      <BackButton />
      <h1>Meus anúncios</h1>
      <p className="muted">
        Você pode cancelar um anúncio livremente enquanto ninguém deu lance. Depois do primeiro lance,
        cancelar só é permitido se faltar mais de 1 dia para o fim — perto do encerramento, o compromisso do
        comprador é respeitado.
      </p>
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {!query.error && !query.data?.length && <p>Você ainda não publicou nenhum anúncio.</p>}
      <div className="auction-watch-grid">
        {query.data?.map((l) => {
          const { canCancel, reason } = cancelability(l);
          return (
            <div className={'watch-card ' + l.status} key={l.id}>
              <Link className="watch-thumb" to={'/l/' + l.slug}>
                {l.image ? <img src={l.image} alt="" loading="lazy" /> : <ImageOff size={20} />}
              </Link>
              <div className="watch-body">
                <span className="status-pill">
                  {relistReason(l) === 'unpaid' ? 'Vencedor não pagou' : (STATUS_LABEL[l.status] ?? l.status)}
                </span>
                <Link to={'/l/' + l.slug}>
                  <h3>{l.title}</h3>
                </Link>
                <div className="watch-meta">
                  <strong>{formatBRL(l.current_price_cents)}</strong>
                  <span>{l.bid_count} lances</span>
                </div>
              </div>
              {['draft', 'active'].includes(l.status) &&
                (canCancel ? (
                  <button
                    className="btn secondary watch-cta"
                    disabled={busyId === l.id}
                    onClick={() => void cancel(l.id)}
                  >
                    <Trash2 size={15} />
                    {busyId === l.id ? 'Cancelando…' : 'Cancelar'}
                  </button>
                ) : (
                  <span className="watch-cta locked" title={reason}>
                    Não é mais possível cancelar
                  </span>
                ))}
              {relistReason(l) && (
                <RelistForm
                  listingId={l.id}
                  previousStartCents={l.start_price_cents}
                  unpaid={relistReason(l) === 'unpaid'}
                  onDone={() => {
                    void query.refetch();
                    void queryClient.invalidateQueries({ queryKey: ['listings'] });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
