import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Eye,
  ImageOff,
  PauseCircle,
  PlayCircle,
  Share2,
  ShoppingBag,
  Star,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { useProfile } from '../auth/useProfile';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { BackButton } from '../../components/BackButton';
import { ShareImageButton } from '../../components/ShareImageButton';
import { RelistForm } from './RelistForm';
import { SellerOffersInbox } from './SellerOffersInbox';
import { DRAFT_KEY, DUPLICATE_FLAG_KEY } from './draftKeys';
type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  current_price_cents: number;
  start_price_cents: number;
  sale_type: 'auction' | 'fixed_price' | 'fixed_price_offers';
  paused_at: string | null;
  stock_qty: number | null;
  stock_sold: number;
  view_count: number;
  orders: { status: string }[] | null;
  second_chance_offers: { status: string }[] | null;
  bid_count: number;
  ends_at: string | null;
  listing_images: { storage_path: string; sort_order: number }[];
};
const SALE_TYPE_LABEL: Record<Row['sale_type'], string> = {
  auction: 'Leilão',
  fixed_price: 'Preço fixo',
  fixed_price_offers: 'Preço fixo · aceita ofertas',
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
  const profile = useProfile();
  const queryClient = useQueryClient();
  const nav = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useDocumentMeta({ title: 'Minha loja e anúncios', noindex: true });
  const query = useQuery({
    queryKey: ['my-listings', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('listings')
        .select(
          'id,slug,title,status,current_price_cents,start_price_cents,sale_type,paused_at,stock_qty,stock_sold,view_count,bid_count,ends_at,listing_images(storage_path,sort_order),orders(status),second_chance_offers(status)',
        )
        .eq('seller_id', user!.id)
        .neq('status', 'cancelled')
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
  const listingIds = query.data?.map((l) => l.id) ?? [];
  const favoritesQuery = useQuery({
    queryKey: ['my-listings-favorites', listingIds],
    enabled: !!supabase && listingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_favorite_counts', { p_listing_ids: listingIds });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data as { listing_id: string; cnt: number }[]) map[row.listing_id] = row.cnt;
      return map;
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
  async function togglePause(id: string, paused: boolean) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('pause_listing', { p_listing: id, p_paused: paused });
      if (error) throw error;
      await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  async function markSold(id: string) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('mark_listing_sold', { p_listing: id });
      if (error) throw error;
      await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  async function duplicate(id: string) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(
          'title,description,defects_declared,category_id,condition,delivery_mode,city,state,duration_days,second_chance_enabled,promo_price_cents,stock_qty,start_price_cents,sale_type,condition_checklist',
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      const draft: Record<string, unknown> = {
        title: data.title ?? '',
        category: data.category_id ?? '',
        condition: data.condition ?? 'like_new',
        description: data.description ?? '',
        defects: data.defects_declared ?? '',
        price: formatBRL(data.start_price_cents),
        duration: String(data.duration_days ?? 7),
        state: data.state ?? '',
        city: data.city ?? '',
        delivery: data.delivery_mode ?? 'both',
        secondChance: data.second_chance_enabled ? 'on' : '',
        saleType: data.sale_type,
        promoPrice: data.promo_price_cents != null ? formatBRL(data.promo_price_cents) : '',
        stockQty: data.stock_qty != null ? String(data.stock_qty) : '1',
        checklist: data.condition_checklist ?? undefined,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem(DUPLICATE_FLAG_KEY, '1');
      nav('/vender/novo');
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  async function shareStore() {
    if (!supabase) return;
    setMessage('');
    try {
      const slug = profile.data?.store_slug ?? (await supabase.rpc('ensure_store_slug', {})).data;
      if (!slug) throw new Error('Não foi possível gerar o link da loja.');
      const url = `${window.location.origin}/loja/${slug}`;
      if (navigator.share) await navigator.share({ title: 'Minha loja no MeuLance', url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage('Link da loja copiado: ' + url);
      }
      if (!profile.data?.store_slug) await profile.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
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
      <div className="store-header">
        <h1 style={{ margin: 0 }}>Minha loja e anúncios</h1>
        <button type="button" className="btn secondary" onClick={() => void shareStore()}>
          <Share2 size={15} /> Compartilhar minha loja
        </button>
      </div>
      <p className="muted">
        Anúncios de leilão: cancele livremente enquanto ninguém deu lance (depois do 1º lance, só com mais de
        1 dia para o fim). Anúncios de preço fixo: pause, retome ou marque como vendido quando quiser.
      </p>
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {!query.error && !query.data?.length && <p>Você ainda não publicou nenhum anúncio.</p>}
      <SellerOffersInbox />
      <div className="auction-watch-grid">
        {query.data?.map((l) => {
          const { canCancel, reason } = cancelability(l);
          const paused = !!l.paused_at;
          const fixedPrice = l.sale_type !== 'auction';
          return (
            <div className={'watch-card ' + l.status} key={l.id}>
              <Link className="watch-thumb" to={'/l/' + l.slug}>
                {l.image ? <img src={l.image} alt="" loading="lazy" /> : <ImageOff size={20} />}
              </Link>
              <div className="watch-body">
                <span className="status-pill">
                  {paused
                    ? 'Pausado'
                    : relistReason(l) === 'unpaid'
                      ? 'Vencedor não pagou'
                      : (STATUS_LABEL[l.status] ?? l.status)}
                </span>
                <span className="sale-type-badge">{SALE_TYPE_LABEL[l.sale_type]}</span>
                <Link to={'/l/' + l.slug}>
                  <h3>{l.title}</h3>
                </Link>
                <div className="watch-meta">
                  <strong>{formatBRL(l.current_price_cents)}</strong>
                  {fixedPrice ? (
                    l.stock_qty != null && (
                      <span className="stock-pill">
                        {Math.max(0, l.stock_qty - l.stock_sold)} de {l.stock_qty} em estoque
                      </span>
                    )
                  ) : (
                    <span>{l.bid_count} lances</span>
                  )}
                </div>
                <div className="watch-stats">
                  <span>
                    <Eye size={13} /> {l.view_count}
                  </span>
                  <span>
                    <Star size={13} /> {favoritesQuery.data?.[l.id] ?? 0}
                  </span>
                </div>
                <div className="watch-tools">
                  <button
                    type="button"
                    className="btn secondary watch-duplicate"
                    disabled={busyId === l.id}
                    onClick={() => void duplicate(l.id)}
                  >
                    <Copy size={14} /> Duplicar
                  </button>
                  {l.image && (
                    <ShareImageButton
                      title={l.title}
                      imageUrl={l.image}
                      priceCents={l.current_price_cents}
                      url={`${window.location.origin}/l/${l.slug}`}
                    />
                  )}
                </div>
              </div>
              {['draft', 'active'].includes(l.status) && (
                <div className="watch-cta watch-cta-group">
                  {fixedPrice && l.status === 'active' && (
                    <>
                      <button
                        className="btn secondary"
                        disabled={busyId === l.id}
                        onClick={() => void togglePause(l.id, !paused)}
                      >
                        {paused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                        {paused ? 'Retomar' : 'Pausar'}
                      </button>
                      <button
                        className="btn secondary"
                        disabled={busyId === l.id}
                        onClick={() => void markSold(l.id)}
                      >
                        <ShoppingBag size={15} /> Marcar vendido
                      </button>
                    </>
                  )}
                  {canCancel ? (
                    <button
                      className="btn secondary"
                      disabled={busyId === l.id}
                      onClick={() => void cancel(l.id)}
                    >
                      <Trash2 size={15} />
                      {busyId === l.id
                        ? fixedPrice
                          ? 'Excluindo…'
                          : 'Cancelando…'
                        : fixedPrice
                          ? 'Excluir anúncio'
                          : 'Cancelar'}
                    </button>
                  ) : (
                    <span className="locked" title={reason}>
                      {fixedPrice ? 'Não é mais possível excluir' : 'Não é mais possível cancelar'}
                    </span>
                  )}
                </div>
              )}
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
