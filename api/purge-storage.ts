// Vercel Cron (diário): apaga do Storage, pela API oficial, os arquivos enfileirados em
// storage_purge_queue (SQL não remove o arquivo, só a linha). Exige CRON_SECRET, que a Vercel
// envia como "Authorization: Bearer ..." nas chamadas de cron.
import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos do runtime Node da Vercel não estão instalados
export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (req.query?.check === '1') {
    // Diagnóstico sem segredo: só booleanos, nenhum valor de variável é exposto.
    const u = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let queueReachable = false;
    if (u && k) {
      const probe = createClient(u, k, { auth: { persistSession: false } });
      const { error: probeError } = await probe
        .from('storage_purge_queue')
        .select('id', { count: 'exact', head: true });
      queueReachable = !probeError;
    }
    return res.status(200).json({
      cron_secret_set: !!secret,
      supabase_url_set: !!u,
      service_key_set: !!k,
      queue_reachable: queueReachable,
    });
  }
  if (!secret || req.headers.authorization !== `Bearer ${secret}`)
    return res.status(401).json({ error: 'unauthorized' });
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'not_configured' });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('storage_purge_queue')
    .select('id,bucket,path')
    .order('id')
    .limit(500);
  if (error) return res.status(500).json({ error: 'queue_read_failed' });

  let removed = 0;
  const byBucket = new Map<string, { ids: number[]; paths: string[] }>();
  for (const row of data ?? []) {
    const g = byBucket.get(row.bucket) ?? { ids: [], paths: [] };
    g.ids.push(row.id);
    g.paths.push(row.path);
    byBucket.set(row.bucket, g);
  }
  for (const [bucket, g] of byBucket) {
    const { error: rmError } = await sb.storage.from(bucket).remove(g.paths);
    if (rmError) continue; // mantém na fila para a próxima execução
    const { error: delError } = await sb.from('storage_purge_queue').delete().in('id', g.ids);
    if (!delError) removed += g.paths.length;
  }
  return res.status(200).json({ removed });
}
