import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { useSession } from './useSession';

// O supabase-js troca o retorno do OAuth (hash/código na URL) por sessão ao iniciar.
// Aqui só esperamos a sessão existir e seguimos; erro do provedor vem na URL.
export function AuthCallback() {
  useDocumentMeta({ title: 'Entrando…', noindex: true, canonicalPath: '/auth/callback' });
  const nav = useNavigate();
  const { user, loading } = useSession();
  const [failed, setFailed] = useState(() => {
    const p = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
    return p.has('error') || p.has('error_description');
  });

  useEffect(() => {
    if (user) nav('/conta/lances', { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (user || failed) return;
    // Sem sessão após alguns segundos: link inválido/expirado ou provedor sem configuração.
    const t = window.setTimeout(() => setFailed(true), 8000);
    return () => window.clearTimeout(t);
  }, [user, failed]);

  if (!supabase) return <main className="page auth-page">Configure o Supabase para usar autenticação.</main>;
  return (
    <main className="page auth-page">
      <div className="auth-card" role="status">
        {failed && !user && !loading ? (
          <>
            <h1>Não foi possível entrar</h1>
            <p className="muted">O login com Google não foi concluído. Tente novamente.</p>
            <Link className="btn primary wide" to="/entrar" replace>
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <h1>Entrando…</h1>
            <p className="muted">Concluindo seu login com o Google.</p>
          </>
        )}
      </div>
    </main>
  );
}
