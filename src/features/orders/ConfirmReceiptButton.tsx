import { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';

/** Pedidos em que o comprador já pode confirmar o recebimento (envio ou retirada em mãos). */
export const CONFIRMABLE_STATUSES = ['paid', 'awaiting_shipment', 'shipped', 'delivered'];

/**
 * Confirmação de recebimento em dois toques, para evitar clique acidental:
 * confirmar encerra o pedido e libera o valor ao vendedor.
 */
export function ConfirmReceiptButton({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const [asking, setAsking] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function confirm() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('confirm_delivery', { p_order: orderId });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setMessage(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <div className="confirm-receipt">
      {!asking ? (
        <button type="button" className="btn primary" onClick={() => setAsking(true)}>
          <PackageCheck size={16} aria-hidden /> Confirmar recebimento
        </button>
      ) : (
        <div className="confirm-receipt-ask" role="group" aria-label="Confirmar recebimento">
          <p>Você já recebeu e conferiu o item? Depois de confirmar, o pedido é encerrado.</p>
          <div>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? 'Confirmando…' : 'Sim, recebi'}
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => setAsking(false)}>
              Ainda não
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
    </div>
  );
}
