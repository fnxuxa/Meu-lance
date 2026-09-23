import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Gavel, Radio } from 'lucide-react';
import { autoWatch, placeBid } from './api';
import { feeCents, formatBRL, parseBRLToCents } from '../../lib/money';
import { minimumBid, QUICK_BID_STEPS_CENTS } from '../../lib/auction';
import { errorMessage } from '../../lib/errors';
import { plural } from '../../lib/text';
export function LiveBidStage({
  listingId,
  initialPrice,
  initialCount = 0,
  startCents = initialPrice,
  minimumCents,
  disabled = false,
  buyerFeeBps,
  onSuccess,
}: {
  listingId: string;
  initialPrice: number;
  initialCount?: number;
  startCents?: number;
  minimumCents?: number;
  disabled?: boolean;
  /** taxa de proteção do comprador (basis points), só para exibir o total */
  buyerFeeBps?: number;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const pending = useRef<{ amount: number; key: string } | null>(null),
    locked = useRef(false);
  const min = minimumCents ?? minimumBid(initialPrice, initialCount, startCents);
  const typedCents = (() => {
    try {
      return amount ? parseBRLToCents(amount) : null;
    } catch {
      return null;
    }
  })();
  const buyerFee =
    typedCents !== null && buyerFeeBps !== undefined ? feeCents(typedCents, buyerFeeBps) : null;
  const queryClient = useQueryClient();
  // destaca o preço quando ele muda (lance próprio, de terceiros ou via realtime)
  const [bump, setBump] = useState(0);
  const lastPrice = useRef(initialPrice);
  useEffect(() => {
    if (initialPrice === lastPrice.current) return;
    lastPrice.current = initialPrice;
    setBump((n) => n + 1);
  }, [initialPrice]);
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
      void autoWatch(listingId).then(() => queryClient.invalidateQueries({ queryKey: ['favorite'] }));
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
        <strong key={bump} className={bump ? 'price-bump' : undefined} aria-live="polite">
          {formatBRL(initialPrice)}
        </strong>
      </div>
      <div className="live-meta">
        <span>
          <Gavel />
          {plural(initialCount, 'lance', 'lances')}
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
      {typedCents !== null && buyerFee !== null && (
        <p className="fee-line">
          Se vencer: {formatBRL(typedCents)} + {formatBRL(buyerFee)} de taxa de proteção ={' '}
          <b>{formatBRL(typedCents + buyerFee)}</b>
        </p>
      )}
      <label className="setting-row">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          Entendo que este lance é compromisso de compra e aceito os{' '}
          <Link to="/termos" target="_blank" rel="noopener">
            Termos de Uso
          </Link>
          .
        </span>
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
