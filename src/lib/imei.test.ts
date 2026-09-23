import { describe, expect, it } from 'vitest';
import { isValidImei, normalizeImei } from './imei';

describe('IMEI', () => {
  it('aceita IMEI válido com ou sem separadores', () => {
    expect(isValidImei('490154203237518')).toBe(true);
    expect(isValidImei('49-015420-323751-8')).toBe(true);
    expect(normalizeImei('49 015420 323751 8')).toBe('490154203237518');
  });
  it('recusa dígito verificador errado e tamanho inválido', () => {
    expect(isValidImei('490154203237519')).toBe(false);
    expect(isValidImei('12345')).toBe(false);
    expect(isValidImei('4901542032375180')).toBe(false);
  });
});
