// PENDENTE (Fase M): webhook do Mercado Pago.
// Responder 501 (e não 204) evita que o provedor considere eventos como processados enquanto isto não existe.
// Implementar: validar assinatura (MP_WEBHOOK_SECRET), deduplicar em payment_events, reconsultar o pagamento na API.
Deno.serve(() => new Response('not implemented', { status: 501 }));
