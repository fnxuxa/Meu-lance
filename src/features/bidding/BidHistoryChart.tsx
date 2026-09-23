import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBRL } from '../../lib/money';
import { plural } from '../../lib/text';
type BidRow = {
  id: string;
  amount_cents: number;
  kind: string;
  created_at: string;
  bidder_mask: string;
  sequence_no: number;
};
const WIDTH = 560;
const HEIGHT = 160;
const PAD = 28;
export function BidHistoryChart({
  listingId,
  startPriceCents,
}: {
  listingId: string;
  startPriceCents: number;
}) {
  const query = useQuery({
    queryKey: ['bid-history', listingId],
    enabled: !!supabase,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('public_bids')
        .select('id,amount_cents,kind,created_at,bidder_mask,sequence_no')
        .eq('listing_id', listingId)
        // sequence_no desempata lances com o mesmo horário (AGENTS.md §20); created_at sozinho é ambíguo
        .order('sequence_no', { ascending: true });
      if (error) throw error;
      return data as BidRow[];
    },
  });
  const bids = query.data ?? [];
  if (query.isPending || bids.length === 0) return null;
  const points = [{ amount_cents: startPriceCents }, ...bids];
  const min = Math.min(...points.map((p) => p.amount_cents));
  const max = Math.max(...points.map((p) => p.amount_cents));
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD + i * step,
    y: HEIGHT - PAD - ((p.amount_cents - min) / range) * (HEIGHT - PAD * 2),
  }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${HEIGHT - PAD} L${coords[0].x.toFixed(1)},${HEIGHT - PAD} Z`;
  return (
    <div className="bid-history-chart">
      <h3>
        <TrendingUp size={16} /> Histórico de lances
      </h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Gráfico da evolução do preço do leilão">
        <defs>
          <linearGradient id={`bh-grad-${listingId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#07864f" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#07864f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={PAD}
          y1={HEIGHT - PAD}
          x2={WIDTH - PAD}
          y2={HEIGHT - PAD}
          stroke="#e2e9e4"
          strokeWidth="1"
        />
        <path d={areaPath} fill={`url(#bh-grad-${listingId})`} />
        <path d={linePath} fill="none" stroke="#07864f" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 4.5 : 3}
            fill={i === coords.length - 1 ? '#07864f' : '#fff'}
            stroke="#07864f"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="bid-history-range">
        <span>Início: {formatBRL(startPriceCents)}</span>
        <span>{plural(bids.length, 'lance', 'lances')}</span>
        <span>Atual: {formatBRL(points[points.length - 1].amount_cents)}</span>
      </div>
      <ul className="bid-history-list">
        {[...bids]
          .reverse()
          .slice(0, 6)
          .map((b) => (
            <li key={b.id}>
              <span>{b.bidder_mask}</span>
              <b>{formatBRL(b.amount_cents)}</b>
              <span className="muted">
                {new Date(b.created_at).toLocaleTimeString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
