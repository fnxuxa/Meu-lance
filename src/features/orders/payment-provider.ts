export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type OrderForPayment = { id: string; amountCents: number; buyerId: string; sellerId: string };
export interface PaymentProvider {
  connectSellerAccount(userId: string): Promise<{ authUrl: string }>;
  createCheckout(
    order: OrderForPayment,
  ): Promise<{ checkoutUrl?: string; pixQrCode?: string; providerPaymentId: string }>;
  releaseToSeller(orderId: string): Promise<void>;
  refund(paymentId: string, amountCents?: number): Promise<{ id: string }>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;
}
/** Simulador em memória para testes. Nunca comprova pagamento nem altera pedidos reais. */
export class MockPaymentProvider implements PaymentProvider {
  private payments = new Map<string, { status: PaymentStatus; amount: number; order: OrderForPayment }>();
  async connectSellerAccount(): Promise<{ authUrl: string }> {
    throw new Error('MOCK_ONLY_NO_OAUTH');
  }
  async createCheckout(order: OrderForPayment) {
    if (!Number.isSafeInteger(order.amountCents) || order.amountCents <= 0) throw new Error('INVALID_MONEY');
    const id = 'mock_' + order.id;
    const previous = this.payments.get(id);
    if (previous && JSON.stringify(previous.order) !== JSON.stringify(order))
      throw new Error('IDEMPOTENCY_CONFLICT');
    if (!previous)
      this.payments.set(id, { status: 'pending', amount: order.amountCents, order: { ...order } });
    return { providerPaymentId: id };
  }
  async simulatePaid(paymentId: string) {
    const p = this.get(paymentId);
    if (p.status !== 'pending') throw new Error('INVALID_PAYMENT_STATE');
    p.status = 'paid';
  }
  async releaseToSeller(orderId: string) {
    if (this.get('mock_' + orderId).status !== 'paid') throw new Error('PAYMENT_NOT_PAID');
  }
  async refund(paymentId: string, amountCents?: number) {
    const p = this.get(paymentId);
    if (amountCents !== undefined && amountCents !== p.amount)
      throw new Error('MOCK_PARTIAL_REFUND_UNSUPPORTED');
    if (!['paid', 'refunded'].includes(p.status)) throw new Error('PAYMENT_NOT_PAID');
    p.status = 'refunded';
    return { id: 'refund_' + paymentId };
  }
  async getPaymentStatus(paymentId: string) {
    return this.get(paymentId).status;
  }
  private get(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new Error('PAYMENT_NOT_FOUND');
    return p;
  }
}
