import { FormEvent, useEffect, useState } from 'react';
import { Bell, Gavel, Menu, Search, Star, UserRound, X } from 'lucide-react';
import { Logo } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../features/auth/useSession';
export function Header() {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);
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
          <Link aria-label="Meus leilões" to="/conta/lances">
            <Star />
          </Link>
          <Link aria-label="Notificações" to="/conta/notificacoes">
            <Bell />
          </Link>
          <Link aria-label="Entrar ou acessar conta" to="/conta/configuracoes">
            <UserRound />
          </Link>
          <button
            type="button"
            className="mobile-only mobile-menu-toggle"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="mobile-menu">
          <form
            className="mobile-menu-search"
            onSubmit={(e) => {
              submit(e);
              setMenuOpen(false);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Buscar"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="O que você está procurando?"
            />
          </form>
          <nav className="mobile-menu-links">
            <Link to="/buscar">Explorar leilões</Link>
            <Link to="/como-funciona">Como funciona</Link>
            <Link className="sell-link" to="/vender/novo">
              <Gavel size={16} /> Vender
            </Link>
          </nav>
          <div className="mobile-menu-divider" />
          <nav className="mobile-menu-links">
            <Link to="/conta/lances">Meus leilões</Link>
            <Link to="/conta/notificacoes">Notificações</Link>
            <Link to="/conta/configuracoes">{user ? 'Minha conta' : 'Entrar'}</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
