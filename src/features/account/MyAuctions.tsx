import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { formatBRL } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
type Row = {
  id: string;
  slug: string;
  title: string;
  current_price_cents: number;
  ends_at: string;
  status: string;
};
type Item = Row & { state: 'winning' | 'outbid' | 'watching' };
export function MyAuctions({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const { user, loading } = useSession();
  const [filter, setFilter] = useState('all');
  const query = useQuery({
    queryKey: ['my-auctions', user?.id, favoritesOnly],
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
      const ids = [...new Set(favoritesOnly ? [...watches] : [...bids, ...watches])];
      if (!ids.length) return [];
      const { data, error } = await supabase!
        .from('listings')
        .select('id,slug,title,current_price_cents,ends_at,status')
        .in('id', ids)
        .order('ends_at');
      if (error) throw error;
      return (data as Row[]).map(
        (l) =>
          ({ ...l, state: leaders.has(l.id) ? 'winning' : bids.has(l.id) ? 'outbid' : 'watching' }) as Item,
      );
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
      <h1>{favoritesOnly ? 'Meus favoritos' : 'Meus leilões'}</h1>
      <nav className="auction-tabs">
        {[
          ['all', 'Todos'],
          ['winning', 'Liderando / vencidos'],
          ['outbid', 'Superados'],
          ['watching', 'Acompanhando'],
        ].map(([key, label]) => (
          <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </nav>
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {!query.error && !items.length && <p>Nenhum leilão neste filtro.</p>}
      <div className="auction-watch-grid">
        {items.map((x) => (
          <article className={'watch-card ' + x.state} key={x.id}>
            <div>
              <span>
                {x.status === 'active'
                  ? x.state === 'winning'
                    ? 'VOCÊ ESTÁ GANHANDO'
                    : x.state === 'outbid'
                      ? 'VOCÊ FOI SUPERADO'
                      : 'ACOMPANHANDO'
                  : x.status === 'ended_with_winner' && x.state === 'winning'
                    ? 'VOCÊ VENCEU'
                    : 'ENCERRADO'}
              </span>
              <h3>{x.title}</h3>
              <strong>{formatBRL(x.current_price_cents)}</strong>
              <p>{new Date(x.ends_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            </div>
            <Link className="btn secondary" to={'/l/' + x.slug}>
              Ver leilão
            </Link>
          </article>
        ))}
      </div>
      <Link to="/conta/notificacoes">Configurar alertas</Link>
    </main>
  );
}
