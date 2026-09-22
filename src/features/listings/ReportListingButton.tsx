import { FormEvent, useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
const REASONS = [
  ['suspected_stolen', 'Suspeito de item roubado'],
  ['prohibited_item', 'Item proibido'],
  ['misleading', 'Anúncio enganoso'],
  ['other', 'Outro motivo'],
] as const;
export function ReportListingButton({ listingId, sellerId }: { listingId: string; sellerId?: string }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('suspected_stolen');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  if (!user) return null;
  if (sent)
    return (
      <p className="report-sent">
        <Flag size={14} /> Denúncia enviada. Nossa equipe vai analisar.
      </p>
    );
  if (!open)
    return (
      <button type="button" className="report-link" onClick={() => setOpen(true)}>
        <Flag size={14} /> Denunciar anúncio
      </button>
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !user || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        listing_id: listingId,
        reported_user_id: sellerId ?? null,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="report-form" onSubmit={submit}>
      <label>
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Detalhes (opcional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
      </label>
      <div className="report-form-actions">
        <button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancelar
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar denúncia'}
        </button>
      </div>
      {message && (
        <p role="status" className="auth-message error">
          {message}
        </p>
      )}
    </form>
  );
}
