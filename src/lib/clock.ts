import { supabase } from './supabase';
let offset = 0;
export const serverNow = () => Date.now() + offset;
export async function syncServerClock() {
  if (!supabase) return;
  const start = Date.now();
  const { data, error } = await supabase.rpc('server_time');
  const time = Date.parse(String(data));
  if (error || !Number.isFinite(time)) throw error ?? new Error('Horário do servidor indisponível.');
  offset = time - (start + Date.now()) / 2;
}
