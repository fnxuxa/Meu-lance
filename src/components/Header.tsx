import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Gavel,
  ListOrdered,
  Menu,
  PackageSearch,
  Search,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../features/auth/useSession';
import { useProfile } from '../features/auth/useProfile';
export function Header() {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const profile = useProfile();
  const needsVerification = !!user && !profile.data?.identity_verified_at;
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [accountOpen]);
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
          <div className="account-menu" ref={accountRef}>
            <button
              type="button"
              aria-label="Minha conta"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
            >
              <UserRound />
            </button>
            {accountOpen && (
              <div className="account-dropdown">
                {user ? (
                  <>
                    <Link to="/conta/configuracoes">Minha conta</Link>
                    <Link to="/conta/lances">
                      <Star size={15} /> Meus leilões
                    </Link>
                    <Link to="/conta/anuncios">
                      <Tags size={15} /> Meus anúncios
                    </Link>
                    <Link to="/conta/vendas">
                      <ListOrdered size={15} /> Minhas vendas
                    </Link>
                    <Link to="/conta/compras">
                      <PackageSearch size={15} /> Meus pedidos
                    </Link>
                    <Link to="/conta/notificacoes">Notificações</Link>
                    {needsVerification && (
                      <Link to="/conta/verificacao" className="verify-link">
                        <ShieldCheck size={15} /> Verificar identidade
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link to="/entrar">Entrar</Link>
                    <Link to="/cadastrar">Criar conta</Link>
                  </>
                )}
              </div>
            )}
          </div>
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
            <Link to="/conta/anuncios">Meus anúncios</Link>
            <Link to="/conta/vendas">Minhas vendas</Link>
            <Link to="/conta/compras">Meus pedidos</Link>
            <Link to="/conta/notificacoes">Notificações</Link>
            <Link to="/conta/configuracoes">{user ? 'Minha conta' : 'Entrar'}</Link>
            {needsVerification && (
              <Link to="/conta/verificacao" className="verify-link">
                Verificar identidade
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
