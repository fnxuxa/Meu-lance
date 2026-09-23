import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { listings as demo } from './mock';
import type { Listing } from '../../types/domain';
import { errorMessage } from '../../lib/errors';
import { syncServerClock } from '../../lib/clock';
import { minimumBid } from '../../lib/auction';
import { conditionLabel, type Checklist } from '../../lib/condition';
const selection =
  'id,slug,seller_id,title,condition,city,state,current_price_cents,start_price_cents,ends_at,bid_count,status,delivery_mode,description,defects_declared,condition_checklist,second_chance_enabled,categories(name,slug),listing_images(storage_path,sort_order,is_defect)';
type Row = {
  id: string;
  slug: string;
  seller_id: string;
  title: string;
  condition: string;
  city: string;
  state: string;
  current_price_cents: number;
  start_price_cents: number;
  ends_at: string;
  bid_count: number;
  status: string;
  delivery_mode: string;
  description: string;
  defects_declared: string | null;
  condition_checklist: Checklist | null;
  second_chance_enabled?: boolean;
  categories: { name: string; slug: string } | null;
  listing_images: { storage_path: string; sort_order: number; is_defect?: boolean }[];
};
export function mapListing(r: Row): Listing {
  const publicUrl = (path: string) =>
    supabase!.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
  const sorted = [...(r.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const urls = sorted.map((x) => publicUrl(x.storage_path));
  return {
    id: r.id,
    slug: r.slug,
    sellerId: r.seller_id,
    title: r.title,
    category: r.categories?.name ?? 'Outros',
    categorySlug: r.categories?.slug,
    condition: conditionLabel(r.condition),
    conditionCode: r.condition,
    checklist: r.condition_checklist ?? undefined,
    secondChance: !!r.second_chance_enabled,
    city: r.city,
    state: r.state,
    currentPriceCents: r.current_price_cents,
    startPriceCents: r.start_price_cents,
    endsAt: r.ends_at,
    bidCount: r.bid_count,
    status: r.status,
    image: urls[0] ?? '/icon.svg',
    images: urls.length ? urls : ['/icon.svg'],
    delivery: r.delivery_mode === 'pickup' ? 'Retirada' : r.delivery_mode === 'shipping' ? 'Envio' : 'Ambos',
    description: r.description,
    defects: r.defects_declared ?? undefined,
    defectImages: sorted.filter((x) => x.is_defect).map((x) => publicUrl(x.storage_path)),
  };
}
export function useListings() {
  const query = useQuery({
    queryKey: ['listings'],
    enabled: !!supabase,
    queryFn: async () => {
      await syncServerClock();
      const { data, error } = await supabase!
        .from('listings')
        .select(selection)
        .eq('status', 'active')
        .order('ends_at');
      if (error) throw error;
      return (data as unknown as Row[]).map(mapListing);
    },
    refetchInterval: 30000,
  });
  return {
    data: supabase ? (query.data ?? []) : demo,
    loading: !!supabase && query.isPending,
    error: query.error ? errorMessage(query.error) : '',
    demo: !supabase,
  };
}
export function useListing(slug?: string) {
  const query = useQuery({
    queryKey: ['listing', slug],
    enabled: !!supabase && !!slug,
    queryFn: async () => {
      await syncServerClock();
      const { data, error } = await supabase!
        .from('listings')
        .select(selection)
        .eq('slug', slug!)
        .in('status', ['active', 'ended_no_bids', 'ended_with_winner', 'cancelled'])
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const item = mapListing(data as unknown as Row);
      const [{ data: profile, error: pe }, { data: inc, error: ie }] = await Promise.all([
        supabase!
          .from('public_profiles')
          .select('display_name,email_verified,phone_verified,identity_verified,rating_avg,rating_count')
          .eq('id', item.sellerId!)
          .maybeSingle(),
        supabase!.rpc('bid_increment', { p: item.currentPriceCents }),
      ]);
      if (pe || ie) throw pe ?? ie;
      return {
        ...item,
        seller: profile,
        minimumBidCents: item.bidCount === 0 ? item.startPriceCents : item.currentPriceCents + Number(inc),
      };
    },
    refetchInterval: 15000,
  });
  const id = query.data?.id,
    refresh = query.refetch;
  useEffect(() => {
    if (!supabase || !id) return;
    const sb = supabase;
    const c = sb
      .channel('detail:' + id)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'listings', filter: 'id=eq.' + id },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(c);
    };
  }, [id, refresh]);
  const mock = demo.find((x) => x.slug === slug);
  return {
    data: supabase
      ? query.data
      : mock
        ? {
            ...mock,
            status: 'active',
            minimumBidCents: minimumBid(mock.currentPriceCents, mock.bidCount, mock.startPriceCents),
          }
        : undefined,
    loading: !!supabase && query.isPending,
    error: query.error ? errorMessage(query.error) : '',
    demo: !supabase,
    refresh: () => {
      void refresh();
    },
  };
}
