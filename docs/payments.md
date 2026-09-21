# Pagamentos — MeuLance

Pagamentos reais estão desativados. As funções de OAuth e webhook respondem 501; entrega externa de notificações também está pendente.

O MockPaymentProvider é um simulador em memória testado: checkout começa pendente; ID inexistente não é tratado como pago; a simulação precisa marcar pagamento explicitamente. Ele não atualiza pedidos reais.

TODO(verificar-doc): antes de integrar Mercado Pago, consultar a documentação oficial atual para o produto contratado, OAuth, campos de split, assinatura, deduplicação, reconsulta e reconciliação. Não assumir que split equivale a retenção/liberação após entrega.

A confirmação comercial sobre retenção, taxas e reembolso continua pendente. Manter PAYMENTS_LIVE=false até os requisitos de AGENTS.md estarem atendidos.
