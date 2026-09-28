import { formatBRL } from '../lib/money';

/** Preço de item de preço fixo: mostra o preço riscado quando há promoção ativa. */
export function PromoPrice({ startCents, promoCents }: { startCents: number; promoCents?: number | null }) {
  if (!promoCents) {
    return (
      <div className="fixed-price-box">
        <span className="price">{formatBRL(startCents)}</span>
      </div>
    );
  }
  const pct = Math.round((1 - promoCents / startCents) * 100);
  return (
    <div className="fixed-price-box">
      <span className="promo-tag">PROMOÇÃO · -{pct}%</span>
      <span className="price-strike">{formatBRL(startCents)}</span>
      <span className="price promo">{formatBRL(promoCents)}</span>
    </div>
  );
}
