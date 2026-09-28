import type { SellerProfile } from '../components/TrustBadges';
import type { Checklist } from '../lib/condition';
export type Listing = {
  id: string;
  slug: string;
  sellerId?: string;
  seller?: SellerProfile | null;
  title: string;
  category: string;
  categorySlug?: string;
  condition: string;
  /** código do banco (new, like_new, good, fair, for_parts) */
  conditionCode?: string;
  checklist?: Checklist;
  /** vendedor aceita oferecer ao 2º colocado se o vencedor não pagar */
  secondChance?: boolean;
  city: string;
  state: string;
  currentPriceCents: number;
  startPriceCents: number;
  minimumBidCents?: number;
  startsAt?: string | null;
  endsAt: string;
  bidCount: number;
  status?: string;
  image: string;
  images: string[];
  delivery: 'Envio' | 'Retirada' | 'Ambos';
  description: string;
  defects?: string;
  defectImages?: string[];
  featured?: boolean;
  participantCount?: number;
  /** leilão | preço fixo | preço fixo com ofertas */
  saleType: 'auction' | 'fixed_price' | 'fixed_price_offers';
  auctionMode: 'classic' | 'live';
  liveDurationMinutes?: number | null;
  promoPriceCents?: number | null;
  stockQty?: number | null;
  stockSold?: number;
};
