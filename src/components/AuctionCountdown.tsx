import { useEffect, useState } from 'react';
import { serverNow } from '../lib/clock';
import { Clock3 } from 'lucide-react';
function digits(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return { s, d, h, m, sec };
}
/**
 * Mostra "começa em" enquanto o leilão ao vivo agendado ainda não começou (startsAt no futuro) e
 * "termina em" depois disso — sempre com a hora do servidor, nunca o relógio do aparelho.
 */
export function AuctionCountdown({ startsAt, endsAt }: { startsAt?: string | null; endsAt: string }) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);
  const startMs = startsAt ? Date.parse(startsAt) : NaN;
  const notStarted = Number.isFinite(startMs) && startMs > now;
  const { s, d, h, m, sec } = digits(notStarted ? startMs - now : (Date.parse(endsAt) || now) - now);
  const urgent = !notStarted && s <= 300;
  return (
    <div className={urgent ? 'countdown urgent' : 'countdown'}>
      <Clock3 />
      <span>
        <span className="sr-only">{notStarted ? 'Começa em ' : 'Termina em '}</span>
        {d > 0 && `${d}d `}
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
      </span>
      {notStarted ? (
        <b>COMEÇA EM BREVE</b>
      ) : urgent && s > 0 ? (
        <b>ENCERRANDO</b>
      ) : s === 0 ? (
        <b>ENCERRADO</b>
      ) : null}
    </div>
  );
}
