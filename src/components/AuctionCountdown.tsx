import { useEffect, useState } from 'react';
import { serverNow } from '../lib/clock';
import { Clock3 } from 'lucide-react';
export function AuctionCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor(((Date.parse(endsAt) || now) - now) / 1000)),
    urgent = s <= 300;
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return (
    <div className={urgent ? 'countdown urgent' : 'countdown'}>
      <Clock3 />
      <span>
        {d > 0 && `${d}d `}
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
      </span>
      {urgent && s > 0 ? <b>ENCERRANDO</b> : s === 0 ? <b>ENCERRADO</b> : null}
    </div>
  );
}
