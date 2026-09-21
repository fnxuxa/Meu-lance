import { describe, expect, it } from 'vitest';
import { feeCents, formatBRL, parseBRLToCents } from './money';

describe('money', () => {
  it('formata BRL', () => expect(formatBRL(123450)).toContain('1.234,50'));

  it('converte texto em centavos', () => {
    expect(parseBRLToCents('R$ 1.234,50')).toBe(123_450);
    expect(parseBRLToCents('1234,50')).toBe(123_450);
    expect(parseBRLToCents('1234.50')).toBe(123_450);
    expect(parseBRLToCents('50.5')).toBe(5_050); // antes virava R$ 505
    expect(parseBRLToCents('50')).toBe(5_000);
    expect(parseBRLToCents('1.234')).toBe(123_400);
  });

  it('recusa valores inválidos', () => {
    expect(() => parseBRLToCents('')).toThrow('INVALID_MONEY');
    expect(() => parseBRLToCents('abc')).toThrow('INVALID_MONEY');
    expect(() => parseBRLToCents('-10')).toThrow('INVALID_MONEY');
    expect(() => parseBRLToCents('0')).toThrow('INVALID_MONEY');
  });

  it('calcula comissão de 5%', () => {
    expect(feeCents(10_000)).toBe(500);
    expect(feeCents(9_999)).toBe(500);
  });
});

it.each(['abc123', '1,234', '1.23.4', '12,345', 'R$ 1.2,34', '9007199254740992', '1e3', '1-2'])(
  'recusa entrada malformada %s',
  (value) => expect(() => parseBRLToCents(value)).toThrow('INVALID_MONEY'),
);
