import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { feeCents, formatBRL } from '../../lib/money';
import { useAppConfig } from '../../lib/useAppConfig';

type Offer = {
  id: string;
  amount_cents: number;
  expires_at: string;
  listings: { title: string; slug: string } | null;
};

/** Ofertas ao 2º colocado ainda abertas para o usuário (Meus pedidos). */
export function SecondChanceOffers({ userId }: { userId: string }) {
  const nav = useNavigate();
  const { buyerFeeBps } = useAppConfig();
  const [busyId, setBusyId] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['second-chance', userId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('second_chance_offers')
        .select('id,amount_cents,expires_at,listings(title,slug)')
        .eq('bidder_id', userId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return data as unknown as Offer[];
    },
  });
  // erro aqui não deve esconder a lista de pedidos; a seção simplesmente não aparece
  if (!query.data?.length) return null;
  async function respond(id: string, accept: boolean) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc(accept ? 'accept_second_chance' : 'decline_second_chance', {
        p_offer: id,
      });
      if (error) throw error;
      if (accept && data) nav('/pedido/' + data);
      else await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section className="offer-list" aria-label="Ofertas de segunda chance">
      {query.data.map((o) => (
        <div className="offer-card" key={o.id}>
          <Gift aria-hidden />
          <div>
            <b>O vencedor não pagou: o item pode ser seu</b>
            <span>
              {o.listings ? <Link to={'/l/' + o.listings.slug}>{o.listings.title}</Link> : 'Item'} pelo seu
              maior lance, {formatBRL(o.amount_cents)} + {formatBRL(feeCents(o.amount_cents, buyerFeeBps))} de
              taxa de proteção. Responda até{' '}
              {new Date(o.expires_at).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              . Aceitar é opcional.
            </span>
            <div className="offer-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busyId === o.id}
                onClick={() => void respond(o.id, true)}
              >
                Quero comprar
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busyId === o.id}
                onClick={() => void respond(o.id, false)}
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      ))}
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
    </section>
  );
}
