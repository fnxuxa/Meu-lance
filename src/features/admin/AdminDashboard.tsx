import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../../lib/errors';
import { formatBRL } from '../../lib/money';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
const REPORT_REASON_LABEL: Record<string, string> = {
  suspected_stolen: 'Suspeito de item roubado',
  prohibited_item: 'Item proibido',
  misleading: 'Anúncio enganoso',
  other: 'Outro motivo',
};
type Report = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  listing_id: string | null;
  listings: { title: string; slug: string } | null;
  profiles: { display_name: string } | null;
};
function ReportQueue({ isStaff }: { isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin-reports'],
    enabled: isStaff && !!supabase,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('reports')
        .select(
          'id,reason,details,created_at,listing_id,listings(title,slug),profiles!reports_reporter_id_fkey(display_name)',
        )
        .eq('status', 'open')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Report[];
    },
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  }
  async function resolve(id: string, status: 'resolved' | 'dismissed') {
    if (!supabase || busyId) return;
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('resolve_report', { p_id: id, p_status: status });
      if (error) throw error;
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  async function removeListing(r: Report) {
    if (!supabase || busyId || !r.listing_id) return;
    if (!window.confirm(`Remover o anúncio "${r.listings?.title}"? Essa ação avisa o vendedor.`)) return;
    setBusyId(r.id);
    try {
      const { error } = await supabase.rpc('staff_remove_listing', {
        p_listing: r.listing_id,
        p_reason: REPORT_REASON_LABEL[r.reason] ?? r.reason,
      });
      if (error) throw error;
      await supabase.rpc('resolve_report', { p_id: r.id, p_status: 'resolved' });
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  if (!isStaff) return null;
  return (
    <section className="admin-verifications">
      <h2>Denúncias abertas</h2>
      {query.error && <p className="auth-message error">{errorMessage(query.error)}</p>}
      {!query.error && !query.data?.length && <p className="muted">Nenhuma denúncia aberta.</p>}
      <div className="verification-list">
        {query.data?.map((r) => (
          <article className="verification-card" key={r.id}>
            <div>
              <b>{REPORT_REASON_LABEL[r.reason] ?? r.reason}</b>
              <span className="muted">
                {new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Denunciado por {r.profiles?.display_name ?? 'usuário'}
              {r.listings && (
                <>
                  {' · '}
                  <Link to={`/l/${r.listings.slug}`} target="_blank" rel="noopener">
                    {r.listings.title}
                  </Link>
                </>
              )}
            </p>
            {r.details && <p style={{ margin: 0 }}>{r.details}</p>}
            <div className="verification-actions">
              {r.listing_id && (
                <button
                  className="btn ghost-danger"
                  disabled={busyId === r.id}
                  onClick={() => void removeListing(r)}
                >
                  <Trash2 size={15} /> Remover anúncio
                </button>
              )}
              <button
                className="btn secondary"
                disabled={busyId === r.id}
                onClick={() => void resolve(r.id, 'resolved')}
              >
                <CheckCircle2 size={15} /> Marcar resolvida
              </button>
              <button
                className="btn secondary"
                disabled={busyId === r.id}
                onClick={() => void resolve(r.id, 'dismissed')}
              >
                <XCircle size={15} /> Descartar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
type InterestSignal = {
  id: string;
  amount_cents: number;
  buyer_whatsapp: string | null;
  buyer_confirmed_interest_at: string;
  listings: { title: string } | null;
  profiles: { display_name: string } | null;
};
function BuyerInterestQueue({ isStaff }: { isStaff: boolean }) {
  const query = useQuery({
    queryKey: ['admin-buyer-interest'],
    enabled: isStaff && !!supabase,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('orders')
        .select(
          'id,amount_cents,buyer_whatsapp,buyer_confirmed_interest_at,listings(title),profiles!orders_buyer_id_fkey(display_name)',
        )
        .not('buyer_confirmed_interest_at', 'is', null)
        .order('buyer_confirmed_interest_at', { ascending: false });
      if (error) throw error;
      return data as unknown as InterestSignal[];
    },
  });
  if (!isStaff) return null;
  return (
    <section className="admin-verifications">
      <h2>Sinal de demanda: compradores que confirmaram interesse</h2>
      <p className="muted">
        Fase de validação — sem pagamento ativo. Use o WhatsApp abaixo para combinar manualmente com quem
        confirmou.
      </p>
      {query.error && <p className="auth-message error">{errorMessage(query.error)}</p>}
      {!query.error && !query.data?.length && <p className="muted">Ninguém confirmou interesse ainda.</p>}
      <div className="verification-list">
        {query.data?.map((o) => (
          <article className="verification-card" key={o.id}>
            <div>
              <b>{o.listings?.title ?? 'Item'}</b>
              <span className="muted">
                {new Date(o.buyer_confirmed_interest_at).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {o.profiles?.display_name ?? 'comprador'} · {formatBRL(o.amount_cents)} · WhatsApp:{' '}
              <b>{o.buyer_whatsapp ?? '—'}</b>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
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
        .select(
          'id,user_id,document_path,selfie_path,created_at,profiles!identity_verifications_user_id_fkey(display_name)',
        )
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
      const reason = approve ? null : (window.prompt('Motivo da recusa (opcional):') ?? undefined);
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
      {query.error && <p className="auth-message error">{errorMessage(query.error)}</p>}
      {!query.error && !query.data?.length && <p className="muted">Nenhuma verificação pendente.</p>}
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
          <BuyerInterestQueue isStaff={!!query.data} />
          <ReportQueue isStaff={!!query.data} />
          <VerificationQueue isStaff={!!query.data} />
          <p className="muted">Disputas de pedidos ainda são resolvidas fora deste painel.</p>
        </>
      )}
    </main>
  );
}
