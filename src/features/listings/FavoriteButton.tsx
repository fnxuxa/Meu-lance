import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
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
  return (
    <div>
      <button
        className="btn secondary"
        disabled={!user || !supabase || busy || query.isPending || !!query.error}
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
            setMessage('Favoritos atualizados.');
          } catch (e) {
            setMessage(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {query.data ? 'Remover dos favoritos' : 'Favoritar'}
      </button>
      {!user && <small>Entre para favoritar.</small>}
      {(message || query.error) && <p role="status">{message || errorMessage(query.error)}</p>}
    </div>
  );
}
