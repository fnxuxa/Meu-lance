import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const db = new PGlite({extensions:{pgcrypto}});
async function run(path) {
  console.log(path);
  const sql = (await readFile(path, 'utf8')).replace(/^\\set.*$/gm, '');
  // PGlite não traz pg_cron; o agendamento só é validado no Supabase.
  if (/pg_cron|\bcron\.job\b/i.test(sql)) return console.log(path + ' (ignorado: pg_cron indisponível)');
  try { await db.exec(sql); } catch (e) { console.error(e.message, e.where ?? ''); process.exitCode = 1; throw new Error('SQL falhou: ' + path); }
}
try {
  await run('supabase/tests/00_supabase_stub.sql');
  for (const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) await run('supabase/migrations/' + file);
  await run('supabase/seed.sql');
  await run('supabase/tests/database.sql');
  if ((await readdir('supabase/tests')).includes('regressions.sql')) await run('supabase/tests/regressions.sql');
  await run('supabase/tests/features.sql');
  console.log('SQL portátil: OK. Concorrência multiconexão exige test:db:native ou test:db.');
} finally { await db.close(); }
