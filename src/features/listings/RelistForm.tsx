import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBRL, parseBRLToCents } from '../../lib/money';
import { errorMessage } from '../../lib/errors';

const MIN_START_CENTS = 5_000;

/** Sugestão ao relançar sem lances: 20% abaixo, arredondado para baixo a R$ 5, nunca menos de R$ 50. */
export function suggestedRelistCents(previousCents: number): number {
  return Math.max(MIN_START_CENTS, Math.floor((previousCents * 0.8) / 500) * 500);
}

export function RelistForm({
  listingId,
  previousStartCents,
  unpaid = false,
  onDone,
}: {
  listingId: string;
  previousStartCents: number;
  /** terminou com vencedor que não pagou: houve interesse, então sugere manter o valor inicial */
  unpaid?: boolean;
  onDone: () => void;
}) {
  const suggested = unpaid ? previousStartCents : suggestedRelistCents(previousStartCents);
  const [price, setPrice] = useState((suggested / 100).toFixed(2).replace('.', ',')),
    [duration, setDuration] = useState('7'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function relist() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('relist_listing', {
        p_listing: listingId,
        p_start_price_cents: parseBRLToCents(price),
        p_duration_days: Number(duration),
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="relist-form">
      <p className="muted small">
        {unpaid ? (
          <>
            O vencedor não pagou. Relance para uma nova disputa: os lances anteriores não valem mais. Valor
            inicial anterior: {formatBRL(previousStartCents)}.
          </>
        ) : (
          <>
            Terminou sem lances com início em {formatBRL(previousStartCents)}. Um valor inicial menor costuma
            atrair os primeiros lances. Sugestão: {formatBRL(suggested)}.
          </>
        )}
      </p>
      <div className="relist-fields">
        <label>
          Novo valor inicial (R$)
          <input
            inputMode="decimal"
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Duração
          <select value={duration} disabled={busy} onChange={(e) => setDuration(e.target.value)}>
            <option value="3">3 dias</option>
            <option value="5">5 dias</option>
            <option value="7">7 dias</option>
            <option value="10">10 dias</option>
          </select>
        </label>
      </div>
      <button type="button" className="btn primary" disabled={busy || !price} onClick={() => void relist()}>
        <RotateCcw size={15} />
        {busy ? 'Relançando…' : 'Relançar anúncio'}
      </button>
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
    </div>
  );
}
