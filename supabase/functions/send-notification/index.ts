// PENDENTE: entrega de notificações (push/e-mail/WhatsApp). In-app já é gravado pelo banco em `notifications`.
// Exige o mesmo segredo interno das rotinas de servidor; sem ele, nada é aceito.
Deno.serve((req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return new Response('unauthorized', { status: 401 });
  return Response.json({ error: 'not_implemented' }, { status: 501 });
});
