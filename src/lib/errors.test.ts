import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('traduz códigos de domínio', () => {
    expect(errorMessage({ message: 'BID_TOO_LOW', code: 'P0001' })).toContain('abaixo do mínimo');
  });
  it('nunca mostra mensagem técnica do banco', () => {
    const leaked = errorMessage({ message: 'column orders.buyer_fee_cents does not exist', code: '42703' });
    expect(leaked).not.toMatch(/column|orders/);
    expect(errorMessage(new Error('relation "public.x" does not exist'))).not.toMatch(/relation/);
  });
  it('mantém mensagens pt-BR do próprio app e traduz o Auth', () => {
    expect(errorMessage(new Error('Use JPG, PNG ou WebP de até 10 MB.'))).toBe(
      'Use JPG, PNG ou WebP de até 10 MB.',
    );
    expect(errorMessage(new Error('Invalid login credentials'))).toBe('E-mail ou senha incorretos.');
  });
});
