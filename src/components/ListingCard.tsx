import { MapPin, Timer, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types/domain';
import { formatBRL } from '../lib/money';
export function ListingCard({ item }: { item: Listing }) {
  return (
    <Link className="card" to={`/l/${item.slug}`}>
      <div className="card-img">
        <img src={item.image} alt={item.title} loading="lazy" />
        <span className="ending">
          <Timer size={13} />
          {new Date(item.endsAt).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="card-body">
        <div className="eyebrow">
          {item.category} · {item.condition}
        </div>
        <h3>{item.title}</h3>
        <div className="price-label">Lance atual</div>
        <div className="price">{formatBRL(item.currentPriceCents)}</div>
        <div className="meta">
          <span>
            <MapPin size={14} />
            {item.city}, {item.state}
          </span>
          <span>
            <Truck size={14} />
            {item.delivery}
          </span>
        </div>
        <div className="bids">{item.bidCount} lances</div>
      </div>
    </Link>
  );
}
