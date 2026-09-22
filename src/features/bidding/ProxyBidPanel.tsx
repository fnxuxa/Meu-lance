import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBRL, parseBRLToCents } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { autoWatch } from './api';
export function ProxyBidPanel({
  listingId,
  currentCents,
  minimumCents,
  disabled = false,
  onSuccess,
}: {
  listingId: string;
  currentCents: number;
  minimumCents?: number;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  const [max, setMax] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const pending = useRef<{ amount: number; key: string } | null>(null),
    locked = useRef(false);
  const queryClient = useQueryClient();
  async function activate() {
    if (!supabase || disabled || !confirmed || locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      const cents = parseBRLToCents(max);
      if (pending.current?.amount !== cents) pending.current = { amount: cents, key: crypto.randomUUID() };
      const { error } = await supabase.rpc('set_proxy_bid', {
        p_listing: listingId,
        p_max: cents,
        p_idempotency: pending.current.key,
      });
      if (error) throw error;
      void autoWatch(listingId).then(() => queryClient.invalidateQueries({ queryKey: ['favorite'] }));
      pending.current = null;
      setConfirmed(false);
      setMessage('Limite registrado. Consulte sua posição na Central de Lances.');
      onSuccess?.();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <section className="proxy-panel">
      <div className="proxy-icon">
        <Bot />
      </div>
      <div className="proxy-copy">
        <span className="kicker">LANCE AUTOMÁTICO</span>
        <h3>Defina seu limite máximo.</h3>
        <p>O sistema disputa até esse valor. Seu teto é privado.</p>
        <p>
          Preço atual {formatBRL(currentCents)}
          {minimumCents !== undefined && ' · Lance mínimo ' + formatBRL(minimumCents)}
        </p>
        <label>
          Meu limite (R$)
          <input
            inputMode="decimal"
            value={max}
            disabled={disabled || busy}
            onChange={(e) => {
              setMax(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <label className="setting-row">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={disabled || busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Confirmo o compromisso de compra até este limite e aceito os{' '}
          <Link to="/termos" target="_blank" rel="noopener">
            Termos de Uso
          </Link>
          .
        </label>
        <button
          className="btn primary"
          disabled={disabled || busy || !confirmed || !max}
          onClick={() => void activate()}
        >
          {busy ? 'Enviando…' : 'Ativar automático'}
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
