import { useRef, useState } from 'react';
import { Gavel, Radio } from 'lucide-react';
import { placeBid } from './api';
import { formatBRL, parseBRLToCents } from '../../lib/money';
import { minimumBid, QUICK_BID_STEPS_CENTS } from '../../lib/auction';
import { errorMessage } from '../../lib/errors';
export function LiveBidStage({
  listingId,
  initialPrice,
  initialCount = 0,
  startCents = initialPrice,
  minimumCents,
  disabled = false,
  onSuccess,
}: {
  listingId: string;
  initialPrice: number;
  initialCount?: number;
  startCents?: number;
  minimumCents?: number;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const pending = useRef<{ amount: number; key: string } | null>(null),
    locked = useRef(false);
  const min = minimumCents ?? minimumBid(initialPrice, initialCount, startCents);
  async function bid() {
    if (disabled || !confirmed || locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      const cents = parseBRLToCents(amount);
      if (cents < min) throw new Error('BID_TOO_LOW');
      if (pending.current?.amount !== cents) pending.current = { amount: cents, key: crypto.randomUUID() };
      await placeBid(listingId, cents, pending.current.key);
      pending.current = null;
      setConfirmed(false);
      setAmount('');
      setMessage('Lance registrado. Consulte o preço e sua posição atualizados.');
      onSuccess?.();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <section className="live-bid-stage">
      <span className="live-label">
        <Radio />
        DISPUTA
      </span>
      <div className="live-price">
        <small>Lance atual</small>
        <strong>{formatBRL(initialPrice)}</strong>
      </div>
      <div className="live-meta">
        <span>
          <Gavel />
          {initialCount} lances
        </span>
      </div>
      <p>Mínimo: {formatBRL(min)}</p>
      <div className="quick-bids">
        <button disabled={disabled || busy} onClick={() => setAmount((min / 100).toFixed(2))}>
          Mínimo
        </button>
        {QUICK_BID_STEPS_CENTS.map((v) => (
          <button
            disabled={disabled || busy}
            key={v}
            onClick={() => setAmount(((initialPrice + v) / 100).toFixed(2))}
          >
            +{formatBRL(v)}
          </button>
        ))}
      </div>
      <label>
        Seu lance (R$)
        <input
          aria-label="Seu lance (R$)"
          inputMode="decimal"
          value={amount}
          disabled={disabled || busy}
          onChange={(e) => {
            setAmount(e.target.value);
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
        Entendo que este lance é compromisso de compra.
      </label>
      <button
        className="btn primary"
        disabled={disabled || busy || !confirmed || !amount}
        onClick={() => void bid()}
      >
        {busy ? 'Enviando…' : 'Confirmar lance'}
      </button>
      {disabled && <p>Lances indisponíveis neste anúncio.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
