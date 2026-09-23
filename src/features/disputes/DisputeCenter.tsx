import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
export function DisputeCenter({
  orderId,
  userId,
  asIs = false,
  onSuccess,
}: {
  orderId: string;
  userId: string;
  /** item vendido no estado: dano/mau funcionamento não é motivo de disputa (Termos, §10) */
  asIs?: boolean;
  onSuccess?: () => void;
}) {
  const [reason, setReason] = useState('not_as_described'),
    [description, setDescription] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [message, setMessage] = useState('');
  if (sent)
    return (
      <section className="success-panel">
        <h2>Disputa registrada</h2>
        <p>Seu relato foi salvo para análise.</p>
      </section>
    );
  return (
    <form
      className="dispute-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!supabase || busy) return;
        setBusy(true);
        try {
          const { error } = await supabase
            .from('disputes')
            .insert({ order_id: orderId, opened_by: userId, reason, description: description.trim() });
          if (error) throw error;
          setSent(true);
          onSuccess?.();
        } catch (err) {
          setMessage(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Abrir disputa</h2>
      <label>
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="not_as_described">Item diferente do anúncio / defeito não declarado</option>
          {!asIs && <option value="damaged">Produto danificado</option>}
          <option value="not_shipped">Não recebi / não foi enviado</option>
          <option value="other">Outro</option>
        </select>
      </label>
      <label>
        Explique em detalhes
        <textarea
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {asIs && (
        <p className="muted small">
          Item vendido no estado: a disputa vale para item diferente do anunciado, defeito não declarado no
          checklist ou item não enviado.
        </p>
      )}
      <button className="btn primary" disabled={busy || description.trim().length < 20}>
        Registrar disputa
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
