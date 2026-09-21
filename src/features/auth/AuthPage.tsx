import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState<'error' | 'success' | ''>('');
  const nav = useNavigate();
  useDocumentMeta({
    title: mode === 'login' ? 'Entrar' : 'Criar conta',
    noindex: true,
    canonicalPath: mode === 'login' ? '/entrar' : '/cadastrar',
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setStatus('error');
      setMessage('Configure o Supabase para usar autenticação.');
      return;
    }
    setBusy(true);
    setMessage('');
    setStatus('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, display_name: name.trim().slice(0, 40) } },
        });
        if (error) throw new Error(error.message);
        setStatus('success');
        setMessage('Cadastro criado. Confira seu e-mail para confirmar a conta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav('/conta/lances');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-card-icon">
          <Gavel size={22} />
        </span>
        <h1>{mode === 'login' ? 'Entre no MeuLance' : 'Comece a comprar e vender'}</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Acompanhe seus lances e leilões favoritos.'
            : 'Crie sua conta gratuita em menos de um minuto.'}
        </p>
        <div className="auth-tabs">
          <Link to="/entrar" className={mode === 'login' ? 'active' : ''}>
            Entrar
          </Link>
          <Link to="/cadastrar" className={mode === 'signup' ? 'active' : ''}>
            Criar conta
          </Link>
        </div>
        {mode === 'signup' && (
          <label>
            Nome
            <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          E-mail
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            required
            minLength={8}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        {message && (
          <p className={`auth-message ${status}`} role="status">
            {message}
          </p>
        )}
        {mode === 'login' && (
          <p className="auth-card-footer">
            <Link to="/recuperar-senha">Esqueci minha senha</Link>
          </p>
        )}
        <div className="auth-trust">
          <ShieldCheck />
          Sua senha é processada com segurança pelo Supabase Auth.
        </div>
      </form>
    </main>
  );
}
