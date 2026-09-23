import { describe, expect, it } from 'vitest';
import { normalizeText, plural } from './text';
import { formatTimeLeft } from './time';

describe('texto', () => {
  it('normaliza acentos e caixa para busca', () => {
    expect(normalizeText('  Célular São Paulo ')).toBe('celular sao paulo');
    expect(normalizeText('Eletrônicos')).toContain('eletronicos');
  });
  it('pluraliza em pt-BR', () => {
    expect(plural(0, 'lance', 'lances')).toBe('0 lances');
    expect(plural(1, 'lance', 'lances')).toBe('1 lance');
    expect(plural(1200, 'lance', 'lances')).toBe('1.200 lances');
  });
});

describe('tempo restante', () => {
  it('formata faixas e trata encerrado', () => {
    expect(formatTimeLeft(0)).toBeNull();
    expect(formatTimeLeft(-5)).toBeNull();
    expect(formatTimeLeft(NaN)).toBeNull();
    expect(formatTimeLeft(45_000)).toBe('45s');
    expect(formatTimeLeft(12 * 60_000 + 5_000)).toBe('12min 05s');
    expect(formatTimeLeft(2 * 3_600_000 + 14 * 60_000)).toBe('2h 14min');
    expect(formatTimeLeft(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h');
  });
});
