import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setMessage('Configure o Supabase para usar autenticação.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, display_name: name.trim().slice(0, 40) } },
        });
        if (error) throw new Error(error.message);
        setMessage('Cadastro criado. Confira seu e-mail para confirmar a conta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav('/conta/lances');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="kicker">{mode === 'login' ? 'BEM-VINDO DE VOLTA' : 'CRIAR CONTA'}</span>
        <h1>{mode === 'login' ? 'Entre no MeuLance' : 'Comece a comprar e vender'}</h1>
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
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
        <div className="auth-trust">
          <ShieldCheck />
          Sua senha é processada pelo Supabase Auth.
        </div>
        {mode === 'login' ? (
          <>
            <Link to="/recuperar-senha">Esqueci minha senha</Link>
            <p>
              Ainda não tem conta? <Link to="/cadastrar">Cadastre-se</Link>
            </p>
          </>
        ) : (
          <p>
            Já tem conta? <Link to="/entrar">Entrar</Link>
          </p>
        )}
      </form>
    </main>
  );
}
