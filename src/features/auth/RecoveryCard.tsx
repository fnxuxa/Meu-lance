import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
export function RecoveryCard() {
  const [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <main className="page auth-page">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase) {
            setMessage('Autenticação indisponível no modo demonstração.');
            return;
          }
          setBusy(true);
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: location.origin + '/conta/configuracoes?recovery=1',
            });
            if (error) throw error;
            setMessage('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
          } catch (err) {
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Recuperar senha</h1>
        <label>
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar link'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
