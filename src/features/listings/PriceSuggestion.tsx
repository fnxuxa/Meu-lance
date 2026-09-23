import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBRL } from '../../lib/money';

type Suggestion = {
  basis: 'similar' | 'category';
  sample: number;
  median_cents: number;
  low_cents: number;
  high_cents: number;
  suggested_start_cents: number;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Dica de valor inicial com base em vendas concluídas (public.suggest_start_price). Só orienta. */
export function PriceSuggestion({
  categoryId,
  title,
  onUse,
}: {
  categoryId: string;
  title: string;
  onUse: (priceText: string) => void;
}) {
  const debouncedTitle = useDebounced(title.trim(), 700);
  const query = useQuery({
    queryKey: ['price-suggestion', categoryId, debouncedTitle],
    enabled: !!supabase && !!categoryId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('suggest_start_price', {
        p_category: categoryId,
        p_title: debouncedTitle || null,
      });
      if (error) throw error;
      return (data ?? null) as Suggestion | null;
    },
  });
  const s = query.data;
  if (!s) return null;
  return (
    <div className="price-hint" role="note">
      <Lightbulb aria-hidden />
      <div>
        <b>
          {s.basis === 'similar' ? 'Itens parecidos' : 'Itens desta categoria'} venderam por cerca de{' '}
          {formatBRL(s.median_cents)}
        </b>
        <span>
          Metade das vendas ficou entre {formatBRL(s.low_cents)} e {formatBRL(s.high_cents)} ({s.sample}{' '}
          vendas). Começar mais baixo atrai os primeiros lances; o leilão sobe até o preço de mercado.
        </span>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => onUse((s.suggested_start_cents / 100).toFixed(2).replace('.', ','))}
        >
          Usar {formatBRL(s.suggested_start_cents)} como valor inicial
        </button>
      </div>
    </div>
  );
}
