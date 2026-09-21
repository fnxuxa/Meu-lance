// Fecha leilões vencidos. Agende a cada minuto (cron do Supabase ou pg_cron) com:
//   Authorization: Bearer <CRON_SECRET>
// Alternativa sem Edge Function: supabase/scripts/schedule-close-auctions.sql (pg_cron chamando close_due_auctions()).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  // sem CRON_SECRET configurado, nada passa (antes, "Bearer undefined" autenticava)
  if (!secret || secret.length < 16) return new Response('server misconfigured', { status: 500 });
  const auth = req.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${secret}`)) return new Response('unauthorized', { status: 401 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.rpc('close_due_auctions');
  return Response.json({ closed: data, error: error?.message ?? null }, { status: error ? 500 : 200 });
});
