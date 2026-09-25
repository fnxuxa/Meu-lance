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
// Segue automaticamente o anúncio ao dar lance, para aparecer em "Favoritos" sem passo extra.
// Best-effort: um erro aqui não deve invalidar um lance já registrado.
export async function autoWatch(listingId: string) {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from('watchlist')
      .upsert(
        { user_id: data.user.id, listing_id: listingId },
        { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
      );
  } catch {
    // silencioso: favoritar é um extra, não deve quebrar o fluxo de lance
  }
}
