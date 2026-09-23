# Pagamentos — MeuLance

Pagamentos reais estão desativados. As funções de OAuth e webhook respondem 501; entrega externa de notificações também está pendente.

O MockPaymentProvider é um simulador em memória testado: checkout começa pendente; ID inexistente não é tratado como pago; a simulação precisa marcar pagamento explicitamente. Ele não atualiza pedidos reais.

TODO(verificar-doc): antes de integrar Mercado Pago, consultar a documentação oficial atual para o produto contratado, OAuth, campos de split, assinatura, deduplicação, reconsulta e reconciliação. Não assumir que split equivale a retenção/liberação após entrega.

A confirmação comercial sobre retenção, taxas e reembolso continua pendente. Manter PAYMENTS_LIVE=false até os requisitos de AGENTS.md estarem atendidos.

## Taxa de proteção do comprador (22/09/2026)

- Além da comissão do vendedor (`commission_bps`, 5%), o comprador paga `buyer_fee_bps` (padrão 300 = 3%) sobre o valor arrematado.
- Gravada em `orders.buyer_fee_cents` por `close_due_auctions()`; total do comprador = `amount_cents + buyer_fee_cents`. O vendedor continua recebendo `seller_net_cents`.
- O checkout deve cobrar o total do comprador, e a parte da plataforma passa a ser `fee_cents + buyer_fee_cents`.
- TODO(verificar-doc): confirmar com o Mercado Pago como cobrar do comprador um valor acima do preço do item no split (campo da taxa da plataforma no produto contratado) e como fica o reembolso parcial/integral dessa taxa em disputa resolvida a favor do comprador.
- Risco: a taxa aumenta o incentivo para negociar por fora. Manter o bloqueio de contatos antes do pagamento.
