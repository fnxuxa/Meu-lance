import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSession } from './useSession';
import { errorMessage } from '../../lib/errors';
export function AccountSettings() {
  const { user, loading } = useSession();
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
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
        <Link to="/entrar">Entrar</Link>
      </main>
    );
  return (
    <main className="page auth-page">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirmation) {
            setMessage('As senhas não coincidem.');
            return;
          }
          setBusy(true);
          try {
            const { error } = await supabase!.auth.updateUser({ password });
            if (error) throw error;
            setPassword('');
            setConfirmation('');
            setMessage('Senha alterada.');
          } catch (err) {
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Minha conta</h1>
        <p>{user.email}</p>
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
          Salvar senha
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const { error } = await supabase!.auth.signOut();
            if (error) setMessage(errorMessage(error));
          }}
        >
          Sair da conta
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
