import { supabase } from '../../lib/supabase';
export async function placeBid(listingId: string, amountCents: number, idempotencyKey: string) {
  if (!supabase) throw new Error('Modo demonstração: lances indisponíveis.');
  const { data, error } = await supabase.rpc('place_bid', {
    p_listing: listingId,
    p_amount: amountCents,
    p_idempotency: idempotencyKey,
  });
  if (error) throw error;
  return data;
}
