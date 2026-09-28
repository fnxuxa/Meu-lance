import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { formatBRL, parseBRLToCents } from '../../lib/money';

type SellerContact = { whatsapp: string | null; has_whatsapp: boolean };
type MyOffer = { id: string; amount_cents: number; status: string };

/**
 * Preço fixo (com ou sem ofertas): sem lance, sem checkout. Fase de validação — o comprador
 * combina entrega e pagamento direto com o vendedor pelo WhatsApp (ver aviso na página).
 */
export function FixedPriceBuyBox({
  listingId,
  offersEnabled,
  startPriceCents,
  soldOut,
  stockQty,
  stockSold,
  demo,
}: {
  listingId: string;
  offersEnabled: boolean;
  startPriceCents: number;
  soldOut: boolean;
  stockQty?: number | null;
  stockSold?: number;
  demo?: boolean;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [contact, setContact] = useState<SellerContact | null>(null);

  const myOffer = useQuery({
    queryKey: ['my-offer', listingId, user?.id],
    enabled: !!supabase && !!user && offersEnabled,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('price_offers')
        .select('id,amount_cents,status')
        .eq('listing_id', listingId)
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MyOffer | null;
    },
  });

  const acceptedContact = useQuery({
    queryKey: ['offer-contact', myOffer.data?.id],
    enabled: !!supabase && myOffer.data?.status === 'accepted',
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_offer_counterparty', { p_offer: myOffer.data!.id });
      if (error) throw error;
      return data as { released: boolean; whatsapp: string | null };
    },
  });

  const left = stockQty != null ? Math.max(0, stockQty - (stockSold ?? 0)) : null;

  async function revealContact() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('get_seller_contact', { p_listing: listingId });
      if (error) throw error;
      setContact(data as SellerContact);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendOffer(cents: number) {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('make_price_offer', {
        p_listing: listingId,
        p_amount_cents: cents,
      });
      if (error) throw error;
      setOfferAmount('');
      await myOffer.refetch();
      await queryClient.invalidateQueries({ queryKey: ['my-offer', listingId] });
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (soldOut) {
    return (
      <div className="notice">
        <b>Item esgotado ou encerrado.</b>
      </div>
    );
  }
  if (demo) {
    return <div className="notice">Demonstração: contato do vendedor não é enviado.</div>;
  }
  if (!user) {
    return (
      <div className="notice">
        <Link className="btn primary" to="/entrar">
          Entre para falar com o vendedor
        </Link>
      </div>
    );
  }

  const whatsappHref = (number: string) =>
    `https://wa.me/${number}?text=${encodeURIComponent('Olá! Vi seu anúncio no MeuLance e tenho interesse.')}`;

  return (
    <div className="fixed-price-buybox">
      {left !== null && (
        <p className="muted" style={{ margin: '0 0 8px' }}>
          {left > 0 ? `${left} em estoque` : 'Última unidade reservada, confirme com o vendedor'}
        </p>
      )}
      {contact ? (
        contact.has_whatsapp && contact.whatsapp ? (
          <a
            className="btn whatsapp-btn wide"
            href={whatsappHref(contact.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} aria-hidden /> Chamar no WhatsApp
          </a>
        ) : (
          <p className="muted">O vendedor ainda não cadastrou um WhatsApp de contato.</p>
        )
      ) : (
        <button
          type="button"
          className="btn primary wide"
          disabled={busy}
          onClick={() => void revealContact()}
        >
          <MessageCircle size={18} aria-hidden />
          {busy ? 'Carregando…' : 'Falar com o vendedor'}
        </button>
      )}
      {offersEnabled && (
        <div className="offer-panel">
          {myOffer.data && myOffer.data.status !== 'declined' && myOffer.data.status !== 'expired' ? (
            <div className="notice">
              <b>
                Sua oferta de {formatBRL(myOffer.data.amount_cents)}:{' '}
                {myOffer.data.status === 'pending'
                  ? 'aguardando resposta do vendedor'
                  : myOffer.data.status === 'accepted'
                    ? 'aceita!'
                    : myOffer.data.status}
              </b>
              {myOffer.data.status === 'accepted' && acceptedContact.data?.whatsapp && (
                <a
                  className="btn whatsapp-btn"
                  style={{ marginTop: 8 }}
                  href={whatsappHref(acceptedContact.data.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={16} aria-hidden /> Combinar pagamento no WhatsApp
                </a>
              )}
            </div>
          ) : (
            <>
              <label>
                Fazer uma oferta (menor que {formatBRL(startPriceCents)})
                <input
                  inputMode="decimal"
                  placeholder="Ex.: 150,00"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || !offerAmount.trim()}
                onClick={() => {
                  try {
                    void sendOffer(parseBRLToCents(offerAmount));
                  } catch {
                    setMessage('Informe um valor válido.');
                  }
                }}
              >
                <Send size={15} aria-hidden />
                Enviar oferta
              </button>
            </>
          )}
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
