import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { plural } from '../../lib/text';
export function FavoriteButton({ listingId }: { listingId: string }) {
  const { user } = useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['favorite', user?.id, listingId],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('watchlist')
        .select('listing_id')
        .eq('user_id', user!.id)
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const countQuery = useQuery({
    queryKey: ['favorite-count', listingId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_listing_favorite_count', { p_listing: listingId });
      if (error) throw error;
      return data as number;
    },
  });
  return (
    <div>
      <button
        className={'btn secondary star-btn' + (query.data ? ' active' : '')}
        disabled={!user || !supabase || busy || query.isPending || !!query.error}
        aria-pressed={!!query.data}
        onClick={async () => {
          if (!user || !supabase) return;
          setBusy(true);
          try {
            const { error } = query.data
              ? await supabase.from('watchlist').delete().eq('user_id', user.id).eq('listing_id', listingId)
              : await supabase.from('watchlist').insert({ user_id: user.id, listing_id: listingId });
            if (error) throw error;
            await query.refetch();
            await client.invalidateQueries({ queryKey: ['my-auctions', user.id] });
            await client.invalidateQueries({ queryKey: ['favorite-count', listingId] });
            setMessage(
              query.data ? 'Removido de "Acompanhando".' : 'Adicionado a "Acompanhando" em Meus lances.',
            );
          } catch (e) {
            setMessage(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Star size={16} fill={query.data ? 'currentColor' : 'none'} />
        {query.data ? 'Seguindo' : 'Seguir anúncio'}
      </button>
      {!!countQuery.data && (
        <small className="favorite-count">
          {plural(countQuery.data, 'pessoa de olho', 'pessoas de olho')}
        </small>
      )}
      {!user && <small>Entre para seguir este anúncio com uma estrela.</small>}
      {(message || query.error) && <p role="status">{message || errorMessage(query.error)}</p>}
    </div>
  );
}
