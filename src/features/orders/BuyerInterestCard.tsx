import { useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';

/**
 * Fase de validação (PAYMENTS_LIVE=false): ainda não há CNPJ nem provedor de pagamento escolhido.
 * Por decisão do dono do produto, comprador e vendedor combinam e pagam diretamente entre si
 * (Pix, dinheiro etc.) enquanto isso — a plataforma não processa nem retém nada. Este card só
 * confirma que o comprador quer seguir e libera o contato para combinarem por fora.
 */
export function BuyerInterestCard({
  orderId,
  buyerName,
  itemTitle,
  confirmedAt,
  onSuccess,
}: {
  orderId: string;
  buyerName: string;
  itemTitle: string;
  confirmedAt: string | null;
  onSuccess: () => void;
}) {
  const [whatsapp, setWhatsapp] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function confirm() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('confirm_buyer_interest', {
        p_order: orderId,
        p_whatsapp: whatsapp,
      });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notice buyer-interest-card">
      <p>
        <PartyPopper size={16} aria-hidden /> Oi {buyerName}! Parabéns, você venceu a oferta do &ldquo;
        {itemTitle}&rdquo; no MeuLance 🎉
      </p>
      <p>
        Estamos numa fase inicial de validação: ainda não temos CNPJ nem pagamento protegido pela plataforma.
        Por enquanto, comprador e vendedor combinam e pagam diretamente entre si (Pix, dinheiro etc.).
        Confirme que você continua interessado e liberamos o contato do vendedor pra vocês combinarem.
      </p>
      <p className="muted" style={{ margin: '4px 0 8px' }}>
        Só entregue o pagamento depois de ver o valor realmente caído na sua conta — comprovante em print não
        garante nada.
      </p>
      {confirmedAt ? (
        <p role="status">
          Interesse confirmado em{' '}
          {new Date(confirmedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. O contato do
          vendedor já está liberado abaixo.
        </p>
      ) : (
        <>
          <label>
            Seu WhatsApp (com DDD)
            <input
              required
              inputMode="tel"
              placeholder="(11) 91234-5678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </label>
          <p className="muted" style={{ margin: '4px 0 8px' }}>
            Usamos para o vendedor te chamar e combinar entrega e pagamento.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !whatsapp.trim()}
            onClick={() => void confirm()}
          >
            {busy ? 'Enviando…' : 'Sim, continuo interessado'}
          </button>
        </>
      )}
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
    </div>
  );
}
