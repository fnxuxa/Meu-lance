import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
export function useAuctionRealtime(id: string, onChange: () => void) {
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const c = sb
      .channel(`auction:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings', filter: `id=eq.${id}` },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${id}` },
        onChange,
      )
      .subscribe();
    return () => {
      void sb.removeChannel(c);
    };
  }, [id, onChange]);
}
