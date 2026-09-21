import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
export function RecoveryCard() {
  const [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  return (
    <main className="page auth-page">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus('');
          if (!supabase) {
            setStatus('error');
            setMessage('Autenticação indisponível no modo demonstração.');
            return;
          }
          setBusy(true);
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: location.origin + '/conta/configuracoes?recovery=1',
            });
            if (error) throw error;
            setStatus('success');
            setMessage('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
          } catch (err) {
            setStatus('error');
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="auth-card-icon">
          <KeyRound size={22} />
        </span>
        <h1>Recuperar senha</h1>
        <p className="muted">Enviamos um link de redefinição para o e-mail cadastrado.</p>
        <label>
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar link'}
        </button>
        {message && (
          <p className={`auth-message ${status}`} role="status">
            {message}
          </p>
        )}
        <p className="auth-card-footer">
          <Link to="/entrar">Voltar para entrar</Link>
        </p>
      </form>
    </main>
  );
}
