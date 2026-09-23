import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ANATEL_IMEI_URL } from '../../lib/imei';

/**
 * IMEI do celular no pedido. O banco só libera para o vendedor e, depois do pagamento, para o comprador
 * (policy de listing_imeis); sem acesso, nada aparece.
 */
export function OrderImei({ listingId, isBuyer }: { listingId: string; isBuyer: boolean }) {
  const query = useQuery({
    queryKey: ['order-imei', listingId],
    enabled: !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('listing_imeis')
        .select('imei')
        .eq('listing_id', listingId)
        .maybeSingle();
      if (error) throw error;
      return (data?.imei as string | undefined) ?? null;
    },
  });
  if (!query.data) return null;
  return (
    <div className="fulfillment-card">
      <h2>
        <Smartphone size={18} aria-hidden /> IMEI do aparelho
      </h2>
      <p className="imei-value">{query.data}</p>
      {isBuyer ? (
        <p className="muted">
          Se quiser, consulte na Anatel se o aparelho tem restrição (roubo, perda ou irregularidade). Confira
          também se o IMEI do celular recebido (disque *#06#) é o mesmo.{' '}
          <a href={ANATEL_IMEI_URL} target="_blank" rel="noopener noreferrer">
            Consultar na Anatel <ExternalLink size={13} aria-hidden />
          </a>
        </p>
      ) : (
        <p className="muted">Informado por você no anúncio. O comprador vê este número depois de pagar.</p>
      )}
      <p className="muted small">Apagado automaticamente 20 dias após a conclusão do pedido.</p>
    </div>
  );
}
