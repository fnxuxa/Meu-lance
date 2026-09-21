/**
 * Faixas de incremento mínimo (em centavos). Espelham `public.bid_increment()` no banco
 * (app_config.bid_increments). O servidor é a fonte de verdade: isto serve só para pré-validar e sugerir valores.
 */
export type IncrementTier = { upto: number | null; inc: number };

export const DEFAULT_INCREMENT_TIERS: readonly IncrementTier[] = [
  { upto: 10_000, inc: 200 }, // até R$ 100 → R$ 2
  { upto: 50_000, inc: 500 }, // até R$ 500 → R$ 5
  { upto: 200_000, inc: 1_000 }, // até R$ 2.000 → R$ 10
  { upto: null, inc: 2_500 }, // acima → R$ 25
];

export function bidIncrement(
  currentCents: number,
  tiers: readonly IncrementTier[] = DEFAULT_INCREMENT_TIERS,
): number {
  const tier = tiers.find((t) => t.upto === null || currentCents <= t.upto);
  return tier?.inc ?? 200;
}

/** Menor lance aceito: valor inicial se ainda não há lances, senão preço atual + incremento. */
export function minimumBid(currentCents: number, bidCount = 1, startCents = currentCents): number {
  return bidCount === 0 ? startCents : currentCents + bidIncrement(currentCents);
}

export const QUICK_BID_STEPS_CENTS = [5_000, 10_000, 20_000, 50_000] as const;
