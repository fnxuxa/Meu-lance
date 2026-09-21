import { describe, expect, it } from 'vitest';
import { bidIncrement, DEFAULT_INCREMENT_TIERS, minimumBid } from './auction';

describe('auction', () => {
  it('usa as mesmas faixas do banco', () => {
    expect(bidIncrement(9_000)).toBe(200);
    expect(bidIncrement(10_000)).toBe(200);
    expect(bidIncrement(10_001)).toBe(500);
    expect(bidIncrement(30_000)).toBe(500);
    expect(bidIncrement(90_000)).toBe(1_000);
    expect(bidIncrement(200_000)).toBe(1_000);
    expect(bidIncrement(200_001)).toBe(2_500);
  });

  it('respeita faixas customizadas vindas do app_config', () => {
    expect(bidIncrement(5_000, [{ upto: null, inc: 700 }])).toBe(700);
    expect(DEFAULT_INCREMENT_TIERS.at(-1)?.upto).toBeNull();
  });

  it('calcula o lance mínimo', () => {
    expect(minimumBid(10_000)).toBe(10_200);
    expect(minimumBid(10_000, 0, 10_000)).toBe(10_000); // sem lances: vale o valor inicial
    expect(minimumBid(184_500, 18)).toBe(185_500);
  });
});
