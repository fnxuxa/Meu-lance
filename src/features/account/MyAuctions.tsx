import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Gavel, ImageOff, TrendingDown, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
type Row = {
  id: string;
  slug: string;
  title: string;
  current_price_cents: number;
  ends_at: string;
  status: string;
  listing_images: { storage_path: string; sort_order: number }[];
};
type Item = Row & { state: 'winning' | 'outbid' | 'watching'; image: string | null };
const STATUS_LABEL: Record<string, string> = {
  active: 'Em andamento',
  ended_with_winner: 'Encerrado',
  ended_no_bids: 'Encerrado sem lances',
  cancelled: 'Cancelado',
  removed: 'Removido',
};
export function MyAuctions() {
  const { user, loading } = useSession();
  const [filter, setFilter] = useState('all');
  useDocumentMeta({ title: 'Meus leilões', noindex: true });
  const query = useQuery({
    queryKey: ['my-auctions', user?.id],
    enabled: !!supabase && !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const results = await Promise.all([
        supabase!.from('bids').select('listing_id').eq('bidder_id', user!.id),
        supabase!.from('watchlist').select('listing_id').eq('user_id', user!.id),
        supabase!.from('auction_leaders').select('listing_id').eq('bidder_id', user!.id),
      ]);
      for (const r of results) if (r.error) throw r.error;
      const [bids, watches, leaders] = results.map(
        (x) => new Set((x.data ?? []).map((v) => v.listing_id as string)),
      );
      const ids = [...new Set([...bids, ...watches])];
      if (!ids.length) return [];
      const { data, error } = await supabase!
        .from('listings')
        .select('id,slug,title,current_price_cents,ends_at,status,listing_images(storage_path,sort_order)')
        .in('id', ids)
        .order('ends_at');
      if (error) throw error;
      return (data as Row[]).map((l) => {
        const image = [...(l.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return {
          ...l,
          state: leaders.has(l.id) ? 'winning' : bids.has(l.id) ? 'outbid' : 'watching',
          image: image ? supabase!.storage.from('listing-images').getPublicUrl(image.storage_path).data.publicUrl : null,
        } as Item;
      });
    },
  });
  if (loading || (user && query.isPending))
    return (
      <main className="account-shell">
        <p>Carregando seus leilões…</p>
      </main>
    );
  if (!user)
    return (
      <main className="account-shell">
        <h1>Meus leilões</h1>
        <Link className="btn primary" to="/entrar">
          Entrar para acompanhar
        </Link>
      </main>
    );
  const items = (query.data ?? []).filter((x) => filter === 'all' || x.state === filter);
  return (
    <main className="account-shell">
      <h1>Meus leilões</h1>
      <nav className="auction-tabs">
        {[
          ['all', 'Todos'],
          ['winning', 'Liderando / vencidos'],
          ['outbid', 'Superados'],
          ['watching', 'Acompanhando (⭐)'],
        ].map(([key, label]) => (
          <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </nav>
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {!query.error && !items.length && <p>Nenhum leilão neste filtro.</p>}
      <div className="auction-watch-grid">
        {items.map((x) => {
          const label =
            x.status === 'active'
              ? x.state === 'winning'
                ? 'Você está ganhando'
                : x.state === 'outbid'
                  ? 'Você foi superado'
                  : 'Acompanhando'
              : x.status === 'ended_with_winner' && x.state === 'winning'
                ? 'Você venceu'
                : (STATUS_LABEL[x.status] ?? 'Encerrado');
          const Icon = x.state === 'winning' ? Trophy : x.state === 'outbid' ? TrendingDown : Gavel;
          return (
            <Link className={'watch-card ' + x.state} key={x.id} to={'/l/' + x.slug}>
              <div className="watch-thumb">
                {x.image ? <img src={x.image} alt="" loading="lazy" /> : <ImageOff size={20} />}
              </div>
              <div className="watch-body">
                <span className="status-pill">
                  <Icon size={12} />
                  {label}
                </span>
                <h3>{x.title}</h3>
                <div className="watch-meta">
                  <strong>{formatBRL(x.current_price_cents)}</strong>
                  <span>
                    {x.status === 'active' ? 'Termina em ' : 'Encerrado em '}
                    {new Date(x.ends_at).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <span className="btn secondary watch-cta">Ver leilão</span>
            </Link>
          );
        })}
      </div>
      <Link to="/conta/notificacoes">Configurar alertas</Link>
    </main>
  );
}
