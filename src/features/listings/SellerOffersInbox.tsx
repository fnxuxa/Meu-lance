import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { formatBRL } from '../../lib/money';

type OfferRow = {
  id: string;
  amount_cents: number;
  created_at: string;
  listings: { title: string; slug: string; seller_id: string } | null;
};

/** Ofertas pendentes recebidas em anúncios de "preço fixo com ofertas" do próprio vendedor. */
export function SellerOffersInbox() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['seller-offers', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('price_offers')
        .select('id,amount_cents,created_at,listings!inner(title,slug,seller_id)')
        .eq('listings.seller_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as OfferRow[];
    },
  });
  async function respond(id: string, accept: boolean) {
    if (!supabase || busyId) return;
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('respond_price_offer', { p_offer: id, p_accept: accept });
      if (error) throw error;
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ['my-offer'] });
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  if (!query.data?.length) return null;
  return (
    <section className="account-card" aria-label="Ofertas recebidas">
      <h2>Ofertas recebidas</h2>
      {message && (
        <p role="alert" className="auth-message error">
          {message}
        </p>
      )}
      <div className="offer-panel" style={{ gap: 12 }}>
        {query.data.map((o) => (
          <div
            key={o.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <Link to={'/l/' + o.listings?.slug}>{o.listings?.title}</Link>
              <div>
                <strong>{formatBRL(o.amount_cents)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn primary"
                disabled={busyId === o.id}
                onClick={() => void respond(o.id, true)}
              >
                <Check size={15} /> Aceitar
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busyId === o.id}
                onClick={() => void respond(o.id, false)}
              >
                <X size={15} /> Recusar
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
