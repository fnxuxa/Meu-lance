import { FormEvent, useState } from 'react';
import { Bell, Heart, Menu, Search, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import { Link, useNavigate } from 'react-router-dom';
export function Header() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  function submit(e: FormEvent) {
    e.preventDefault();
    nav(`/buscar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  }
  return (
    <header>
      <div className="nav">
        <Logo />
        <form className="search" onSubmit={submit}>
          <Search size={18} />
          <input
            aria-label="Buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O que você está procurando?"
          />
        </form>
        <nav>
          <Link to="/buscar">Explorar</Link>
          <Link to="/como-funciona">Como funciona</Link>
          <Link className="sell-link" to="/vender/novo">
            Vender
          </Link>
        </nav>
        <div className="icons">
          <Link aria-label="Favoritos" to="/conta/favoritos">
            <Heart />
          </Link>
          <Link aria-label="Notificações" to="/conta/notificacoes">
            <Bell />
          </Link>
          <Link aria-label="Entrar ou acessar conta" to="/conta/configuracoes">
            <UserRound />
          </Link>
          <Link aria-label="Minha conta" to="/conta/lances">
            <Menu className="mobile-only" />
          </Link>
        </div>
      </div>
    </header>
  );
}
