export const formatBRL = (cents: number | bigint) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100);
export function parseBRLToCents(input: string): number {
  const value = input.trim().replace(/^R\$\s*/, '');
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) normalized = value.replaceAll('.', '').replace(',', '.');
  else if (/^\d+(,\d{1,2})?$/.test(value)) normalized = value.replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value;
  else throw new Error('INVALID_MONEY');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('INVALID_MONEY');
  return Number(cents);
}
export function feeCents(amountCents: number, bps = 500): number {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    !Number.isInteger(bps) ||
    bps < 0 ||
    bps > 10000
  )
    throw new Error('INVALID_MONEY');
  return Number((BigInt(amountCents) * BigInt(bps) + 5000n) / 10000n);
}
