import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { DEFAULT_CHECKLISTS, type ChecklistConfig } from './condition';

/** Valores usados só para exibição quando o banco não está configurado (modo demonstração). */
export const DEFAULT_BUYER_FEE_BPS = 300;
export const DEFAULT_IMEI_CATEGORIES = ['celulares'];

type AppConfig = { buyerFeeBps: number; checklists?: ChecklistConfig; imeiCategories?: string[] };

/** Configuração pública (app_config). O servidor sempre recalcula taxas e valida o checklist. */
export function useAppConfig() {
  const query = useQuery({
    queryKey: ['app-config'],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<AppConfig> => {
      const { data, error } = await supabase!
        .from('app_config')
        .select('key,value')
        .in('key', ['buyer_fee_bps', 'condition_checklists', 'imei_required_categories']);
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
      const bps = Number(map.get('buyer_fee_bps'));
      return {
        buyerFeeBps: Number.isInteger(bps) && bps >= 0 && bps <= 10000 ? bps : DEFAULT_BUYER_FEE_BPS,
        checklists: map.get('condition_checklists') as ChecklistConfig | undefined,
        imeiCategories: map.get('imei_required_categories') as string[] | undefined,
      };
    },
  });
  return {
    buyerFeeBps: query.data?.buyerFeeBps ?? DEFAULT_BUYER_FEE_BPS,
    // sem a configuração do banco (ou com erro), usa as perguntas padrão em vez de travar o formulário
    checklists: query.data?.checklists ?? DEFAULT_CHECKLISTS,
    imeiCategories: query.data?.imeiCategories ?? DEFAULT_IMEI_CATEGORIES,
    loading: !!supabase && query.isPending,
    error: query.error,
  };
}
