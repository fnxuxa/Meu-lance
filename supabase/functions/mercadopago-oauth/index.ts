// PENDENTE (Fase M): OAuth do vendedor no Mercado Pago.
// Falha fechado de propósito: não devolve "ready" nem troca code sem validar o `state` one-time no servidor.
// Implementar: validar state em tabela própria, trocar code por token no backend, criptografar tokens (ENCRYPTION_KEY).
Deno.serve(() =>
  Response.json(
    { error: 'not_implemented', message: 'Integração Mercado Pago ainda não implementada.' },
    { status: 501 },
  ),
);
