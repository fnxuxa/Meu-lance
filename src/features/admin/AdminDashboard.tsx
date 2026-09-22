import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
type Verification = {
  id: string;
  user_id: string;
  document_path: string;
  selfie_path: string;
  created_at: string;
  profiles: { display_name: string } | null;
};
function VerificationQueue({ isStaff }: { isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, { doc: string; selfie: string }>>({});
  const query = useQuery({
    queryKey: ['admin-verifications'],
    enabled: isStaff && !!supabase,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('identity_verifications')
        .select('id,user_id,document_path,selfie_path,created_at,profiles(display_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Verification[];
    },
  });
  async function reveal(v: Verification) {
    if (!supabase || urls[v.id]) return;
    const [doc, selfie] = await Promise.all([
      supabase.storage.from('identity-documents').createSignedUrl(v.document_path, 300),
      supabase.storage.from('identity-documents').createSignedUrl(v.selfie_path, 300),
    ]);
    setUrls((u) => ({
      ...u,
      [v.id]: { doc: doc.data?.signedUrl ?? '', selfie: selfie.data?.signedUrl ?? '' },
    }));
  }
  async function review(id: string, approve: boolean) {
    if (!supabase || busyId) return;
    setBusyId(id);
    try {
      const reason = approve ? null : window.prompt('Motivo da recusa (opcional):') ?? undefined;
      const { error } = await supabase.rpc('review_identity_verification', {
        p_id: id,
        p_approve: approve,
        p_reason: reason || null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  if (!isStaff) return null;
  return (
    <section className="admin-verifications">
      <h2>Verificações de identidade pendentes</h2>
      {!query.data?.length && <p className="muted">Nenhuma verificação pendente.</p>}
      <div className="verification-list">
        {query.data?.map((v) => (
          <article className="verification-card" key={v.id} onMouseEnter={() => void reveal(v)}>
            <div>
              <b>{v.profiles?.display_name ?? v.user_id.slice(0, 8)}</b>
              <span className="muted">
                {new Date(v.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            </div>
            <div className="verification-thumbs">
              {urls[v.id] ? (
                <>
                  <img src={urls[v.id].doc} alt="Documento" />
                  <img src={urls[v.id].selfie} alt="Selfie" />
                </>
              ) : (
                <span className="muted">Passe o mouse para carregar as fotos…</span>
              )}
            </div>
            <div className="verification-actions">
              <button
                className="btn primary"
                disabled={busyId === v.id}
                onClick={() => void review(v.id, true)}
              >
                <CheckCircle2 size={15} /> Aprovar
              </button>
              <button
                className="btn ghost-danger"
                disabled={busyId === v.id}
                onClick={() => void review(v.id, false)}
              >
                <XCircle size={15} /> Recusar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function AdminDashboard() {
  const { user, loading } = useSession();
  useDocumentMeta({ title: 'Painel administrativo', noindex: true });
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
      return { counts: results.map((r) => r.count ?? 0), role: profile.role };
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
                  <strong>{query.data?.counts[i]}</strong>
                </article>
              ),
            )}
          </div>
          <VerificationQueue isStaff={!!query.data} />
          <p>
            Este painel apresenta métricas. As ferramentas de moderação e resolução ainda estão em
            desenvolvimento.
          </p>
        </>
      )}
    </main>
  );
}
