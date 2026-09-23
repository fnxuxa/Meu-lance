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
};
