import { expect, it } from 'vitest';
import { MockPaymentProvider } from './payment-provider';
it('mock não informa pagamento inexistente ou pagamento automático', async () => {
  const p = new MockPaymentProvider();
  await expect(p.getPaymentStatus('missing')).rejects.toThrow('PAYMENT_NOT_FOUND');
  const { providerPaymentId: id } = await p.createCheckout({
    id: 'one',
    amountCents: 10000,
    buyerId: 'buyer',
    sellerId: 'seller',
  });
  expect(await p.getPaymentStatus(id)).toBe('pending');
  await expect(p.releaseToSeller('one')).rejects.toThrow('PAYMENT_NOT_PAID');
  await p.simulatePaid(id);
  expect(await p.getPaymentStatus(id)).toBe('paid');
  await p.refund(id);
  expect(await p.getPaymentStatus(id)).toBe('refunded');
  await p.refund(id);
});
