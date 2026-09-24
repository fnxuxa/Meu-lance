import { useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';

/**
 * Fase de validação (PAYMENTS_LIVE=false): ainda não há estrutura de pagamento/retenção.
 * Este card avisa o vencedor e registra, sem cobrança nem compromisso, se ele continua
 * interessado — serve de sinal de demanda antes de abrir CNPJ e contratar um provedor.
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
        Estamos numa fase inicial de validação e ainda estamos finalizando a estrutura de pagamento seguro
        (CNPJ + sistema de retenção). Você continua interessado em fechar essa compra? Se sim, te aviso assim
        que a estrutura estiver pronta pra gente combinar o pagamento com segurança pra você e pro vendedor.
        Sem compromisso nenhum até lá.
      </p>
      {confirmedAt ? (
        <p role="status">
          Interesse confirmado em{' '}
          {new Date(confirmedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Assim que a
          estrutura de pagamento estiver pronta, avisamos por aqui.
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
            Usamos só para te avisar quando o pagamento estiver liberado. Nada de cobrança agora.
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
