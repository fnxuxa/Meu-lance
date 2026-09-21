import { BadgeCheck, MailCheck, Smartphone, Star } from 'lucide-react';
export type SellerProfile = {
  display_name: string;
  email_verified: boolean;
  phone_verified: boolean;
  identity_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
};
export function TrustBadges({ seller }: { seller?: SellerProfile | null }) {
  if (!seller) return null;
  return (
    <div className="trust-badges">
      {seller.email_verified && (
        <span>
          <MailCheck />
          E-mail verificado
        </span>
      )}
      {seller.phone_verified && (
        <span>
          <Smartphone />
          Telefone verificado
        </span>
      )}
      {seller.identity_verified && (
        <span>
          <BadgeCheck />
          Identidade verificada
        </span>
      )}
      {seller.rating_count > 0 && seller.rating_avg !== null && (
        <span>
          <Star />
          {Number(seller.rating_avg).toLocaleString('pt-BR')} · {seller.rating_count} avaliações
        </span>
      )}
    </div>
  );
}
