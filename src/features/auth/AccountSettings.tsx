import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from './useSession';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
export function AccountSettings() {
  const { user, loading } = useSession();
  useDocumentMeta({ title: 'Minha conta', noindex: true });
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [busySignOut, setBusySignOut] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  if (loading)
    return (
      <main className="page simple">
        <p>Carregando conta…</p>
      </main>
    );
  if (!user)
    return (
      <main className="page simple">
        <h1>Minha conta</h1>
        <p>Entre na conta ou abra o link de recuperação enviado por e-mail.</p>
        <Link className="btn primary" to="/entrar">
          Entrar
        </Link>
      </main>
    );
  const initial = (user.email ?? '?').charAt(0).toUpperCase();
  return (
    <main className="page">
      <div className="account-settings-shell">
        <div className="account-card">
          <div className="account-identity">
            <span className="account-avatar">{initial}</span>
            <div>
              <h2 style={{ margin: 0 }}>Minha conta</h2>
              <p className="muted" style={{ margin: 0 }}>
                {user.email}
              </p>
            </div>
          </div>
        </div>
        <form
          className="account-card"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirmation) {
              setStatus('error');
              setMessage('As senhas não coincidem.');
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) throw error;
              setPassword('');
              setConfirmation('');
              setStatus('success');
              setMessage('Senha alterada com sucesso.');
            } catch (err) {
              setStatus('error');
              setMessage(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Segurança</h2>
          <p className="muted">Defina uma nova senha para sua conta.</p>
          <label>
            Nova senha
            <input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Repita a senha
            <input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            <ShieldCheck size={17} />
            {busy ? 'Salvando…' : 'Salvar senha'}
          </button>
          {message && (
            <p className={`auth-message ${status}`} role="status">
              {message}
            </p>
          )}
        </form>
        <div className="account-card danger">
          <div>
            <h2>Sair da conta</h2>
            <p style={{ margin: 0 }}>Encerra sua sessão neste dispositivo.</p>
          </div>
          <button
            type="button"
            className="btn ghost-danger"
            disabled={busySignOut}
            onClick={async () => {
              setBusySignOut(true);
              const { error } = await supabase!.auth.signOut();
              if (error) {
                setStatus('error');
                setMessage(errorMessage(error));
              }
              setBusySignOut(false);
            }}
          >
            <LogOut size={17} />
            {busySignOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
    </main>
  );
}
