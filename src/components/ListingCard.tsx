import { Gavel, MapPin, Timer, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types/domain';
import { formatBRL } from '../lib/money';
import { plural } from '../lib/text';
import { formatTimeLeft, URGENT_MS, useServerNow } from '../lib/time';

function TimeLeftBadge({ endsAt }: { endsAt: string }) {
  const now = useServerNow();
  const left = Date.parse(endsAt) - now;
  const label = formatTimeLeft(left);
  const urgent = label !== null && left <= URGENT_MS;
  return (
    <span className={'ending' + (urgent ? ' urgent' : '') + (label ? '' : ' ended')}>
      <Timer size={13} aria-hidden />
      {label ? (
        <>
          <span className="sr-only">Termina em </span>
          {label}
        </>
      ) : (
        'Encerrado'
      )}
    </span>
  );
}

export function ListingCard({ item, demo = false }: { item: Listing; demo?: boolean }) {
  return (
    <Link className="card" to={`/l/${item.slug}`}>
      <div className="card-img">
        <img src={item.image} alt={item.title} loading="lazy" decoding="async" width={400} height={300} />
        {demo && <span className="demo-tag">DEMONSTRAÇÃO</span>}
        <TimeLeftBadge endsAt={item.endsAt} />
      </div>
      <div className="card-body">
        <div className="eyebrow">
          {item.category} · {item.condition}
        </div>
        <h3>{item.title}</h3>
        <div className="price-label">{item.bidCount ? 'Lance atual' : 'Lance inicial'}</div>
        <div className="price">{formatBRL(item.currentPriceCents)}</div>
        <div className="meta">
          <span>
            <MapPin size={14} aria-hidden />
            {item.city}, {item.state}
          </span>
          <span>
            <Truck size={14} aria-hidden />
            {item.delivery}
          </span>
        </div>
        <div className="bids">
          <Gavel size={13} aria-hidden />
          {item.bidCount ? plural(item.bidCount, 'lance', 'lances') : 'Seja o primeiro a dar lance'}
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="card card-skeleton" aria-hidden>
      <div className="card-img skeleton" />
      <div className="card-body">
        <div className="skeleton line short" />
        <div className="skeleton line" />
        <div className="skeleton line price" />
        <div className="skeleton line short" />
      </div>
    </div>
  );
}

export function ListingGrid({
  items,
  loading,
  demo,
  skeletons = 4,
}: {
  items: Listing[];
  loading: boolean;
  demo?: boolean;
  skeletons?: number;
}) {
  return (
    <div className="grid" aria-busy={loading}>
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <ListingCardSkeleton key={i} />)
        : items.map((x, i) => (
            <div className="grid-item" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} key={x.id}>
              <ListingCard item={x} demo={demo} />
            </div>
          ))}
    </div>
  );
}
