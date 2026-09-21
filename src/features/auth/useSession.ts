import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
export function useSession() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true,
      changed = false;
    const sb = supabase;
    const { data } = sb.auth.onAuthStateChange((_event, s) => {
      changed = true;
      if (active) {
        setSession(s);
        setLoading(false);
      }
    });
    void sb.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !changed) {
          setSession(error ? null : data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, user: session?.user, loading, configured: Boolean(supabase) };
}
