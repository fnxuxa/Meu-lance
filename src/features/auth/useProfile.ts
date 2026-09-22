import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from './useSession';
export type Profile = {
  id: string;
  display_name: string;
  full_name: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  identity_verified_at: string | null;
  seller_status: string;
};
export function useProfile() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('profiles')
        .select('id,display_name,full_name,city,state,avatar_url,identity_verified_at,seller_status')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
  return query;
}
