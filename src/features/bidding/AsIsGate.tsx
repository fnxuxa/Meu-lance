import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';

/**
 * Item vendido "no estado": o servidor recusa lance (AS_IS_ACK_REQUIRED) até o usuário aceitar.
 * Mostra o aceite uma vez por anúncio e libera os painéis de lance em seguida.
 */
export function AsIsGate({
  listingId,
  active,
  children,
}: {
  listingId: string;
  active: boolean;
  children: (blocked: boolean) => ReactNode;
}) {
  const { user } = useSession();
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['as-is-ack', user?.id, listingId],
    enabled: active && !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('as_is_acknowledgments')
        .select('listing_id')
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  // Sem login, o próprio painel de lance pede para entrar.
  if (!active || !user || !supabase) return <>{children(false)}</>;
  const accepted = query.data === true;
  async function accept() {
    if (!supabase || !checked || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('acknowledge_as_is', { p_listing: listingId });
      if (error) throw error;
      await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!accepted && (
        <section className="as-is-gate">
          <AlertTriangle aria-hidden />
          <label className="setting-row">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy || query.isPending}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Entendo que este item é vendido <b>no estado</b>, pode não funcionar e não tem garantia de
              funcionamento (<Link to="/termos#no-estado">Termos, §10</Link>).
            </span>
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={!checked || busy}
            onClick={() => void accept()}
          >
            {busy ? 'Registrando…' : 'Aceitar e liberar lances'}
          </button>
          {(message || query.error) && <p role="alert">{message || errorMessage(query.error)}</p>}
        </section>
      )}
      {children(!accepted)}
    </>
  );
}
