import { useEffect, useState } from 'react';
import { serverNow } from './clock';

/** Tempo restante curto para cards: "3d 4h", "2h 14min", "12min 5s", "45s". Zero ou menos → null. */
export function formatTimeLeft(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Hora do servidor (com offset sincronizado) atualizada a cada `intervalMs`. */
export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** true quando a hora do servidor passa de `iso`. Só re-renderiza na virada (não a cada segundo). */
export function useIsPast(iso?: string): boolean {
  const target = iso ? Date.parse(iso) : NaN;
  const [past, setPast] = useState(() => serverNow() >= target);
  useEffect(() => {
    const check = () => setPast(serverNow() >= target);
    check();
    if (!Number.isFinite(target)) return;
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [target]);
  return past;
}

export const URGENT_MS = 5 * 60 * 1000;
