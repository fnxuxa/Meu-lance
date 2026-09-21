import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
export function AdminDashboard() {
  const { user, loading } = useSession();
  const query = useQuery({
    queryKey: ['admin', user?.id],
    enabled: !!user && !!supabase,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: profile, error } = await supabase!
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      if (!['admin', 'moderator'].includes(profile.role))
        throw new Error('Acesso restrito à equipe autorizada.');
      const results = await Promise.all([
        supabase!.from('profiles').select('id', { count: 'exact', head: true }),
        supabase!.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase!.from('orders').select('id', { count: 'exact', head: true }),
        supabase!.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase!
          .from('disputes')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'seller_response', 'under_review']),
      ]);
      for (const r of results) if (r.error) throw r.error;
      return results.map((r) => r.count ?? 0);
    },
  });
  return (
    <main className="admin-shell">
      <h1>Painel administrativo</h1>
      {loading || (user && query.isPending) ? (
        <p>Verificando acesso…</p>
      ) : !user ? (
        <p>Entre com uma conta autorizada.</p>
      ) : query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <>
          <div className="admin-stats">
            {['Usuários', 'Leilões ativos', 'Pedidos', 'Denúncias abertas', 'Disputas em andamento'].map(
              (label, i) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{query.data?.[i]}</strong>
                </article>
              ),
            )}
          </div>
          <p>
            Este painel apresenta métricas. As ferramentas de moderação e resolução ainda estão em
            desenvolvimento.
          </p>
        </>
      )}
    </main>
  );
}
