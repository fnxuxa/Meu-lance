import { useMemo, useState } from 'react';
import { Routes, Route, Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Gavel,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
} from 'lucide-react';
import { OrdersPage, OrderPage } from '../features/orders/OrdersPage';
import { AccountSettings } from '../features/auth/AccountSettings';
import { FavoriteButton } from '../features/listings/FavoriteButton';
import { Header } from '../components/Header';
import { ListingCard } from '../components/ListingCard';
import { AuctionCountdown } from '../components/AuctionCountdown';
import { TrustBadges } from '../components/TrustBadges';
import { LiveBidStage } from '../features/bidding/LiveBidStage';
import { ProxyBidPanel } from '../features/bidding/ProxyBidPanel';
import { PublicQuestions } from '../features/listings/PublicQuestions';
import { MyAuctions } from '../features/account/MyAuctions';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { RecoveryCard } from '../features/auth/RecoveryCard';

import { useListings, useListing } from '../features/listings/useListings';
import { CreateListingPage } from '../features/listings/CreateListingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { NotificationSettings } from '../features/notifications/NotificationSettings';
import { formatBRL } from '../lib/money';
function Home() {
  const { data: listings, loading, error, demo } = useListings();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <Sparkles size={15} />O preço certo aparece quando as pessoas disputam.
          </div>
          <h1>
            Desapegue pelo <em>melhor lance.</em>
            <br />
            Encontre seu próximo achado.
          </h1>
          <p>
            Leilões de usados entre pessoas, com histórico transparente e uma experiência feita para
            acompanhar a disputa ao vivo.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/buscar">
              <Search />
              Quero comprar
            </Link>
            <Link className="btn secondary" to="/vender/novo">
              <Gavel />
              Quero vender
            </Link>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck />
              Pagamento indisponível nesta versão
            </span>
            <span>
              <CheckCircle2 />
              Histórico de lances
            </span>
            <span>
              <MapPin />
              Perto de você
            </span>
          </div>
        </div>
        {listings[0] && (
          <div className="hero-panel">
            <div className="live">
              <span />
              {demo ? 'DEMONSTRAÇÃO' : 'LEILÃO ATIVO'}
            </div>
            <img src={listings[0].image} alt={listings[0].title} />
            <div className="hero-auction">
              <small>{listings[0].title}</small>
              <strong>{formatBRL(listings[0].currentPriceCents)}</strong>
              <AuctionCountdown endsAt={listings[0].endsAt} />
              <Link className="btn primary wide" to={`/l/${listings[0].slug}`}>
                Acompanhar disputa <ArrowRight />
              </Link>
            </div>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">ACABANDO AGORA</span>
            <h2>Últimas chances</h2>
          </div>
          <Link to="/buscar">
            Ver todos <ChevronRight />
          </Link>
        </div>
        <p role="status">
          {demo
            ? 'Demonstração: anúncios ilustrativos, sem transações reais.'
            : loading
              ? 'Carregando…'
              : error || (!listings.length ? 'Ainda não há leilões ativos.' : '')}
        </p>
        <div className="grid">
          {listings.slice(0, 4).map((x) => (
            <ListingCard key={x.id} item={x} />
          ))}
        </div>
      </section>
      <section className="how">
        <div>
          <span className="kicker">SIMPLES E SEGURO</span>
          <h2>
            Você escolhe o lado.
            <br />A plataforma organiza o fluxo.
          </h2>
        </div>
        <div className="steps">
          <article>
            <b>01</b>
            <Gavel />
            <h3>Anuncie ou dê um lance</h3>
            <p>Crie seu leilão ou dispute itens que você quer.</p>
          </article>
          <article>
            <b>02</b>
            <WalletCards />
            <h3>Pague pelo provedor</h3>
            <p>Pagamentos reais ficam desativados até homologação do Mercado Pago.</p>
          </article>
          <article>
            <b>03</b>
            <Truck />
            <h3>Envie ou retire</h3>
            <p>Envio com rastreio ou retirada conforme o anúncio.</p>
          </article>
        </div>
      </section>
    </>
  );
}
function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { data: listingsData, loading, error, demo } = useListings();
  const q = params.get('q') ?? '';
  const setQ = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('q', value);
    setParams(next, { replace: true });
  };
  const [cat, setCat] = useState('Todos');
  const result = useMemo(
    () =>
      listingsData.filter(
        (x) =>
          (cat === 'Todos' || x.category === cat) &&
          `${x.title} ${x.category} ${x.city} ${x.state}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [q, cat, listingsData],
  );
  return (
    <main className="page">
      <div className="browse-head">
        <span className="kicker">LEILÕES ATIVOS</span>
        <h1>Encontre seu próximo achado</h1>
        <p>Busque por produto, categoria ou região.</p>
      </div>
      <div className="filterbar">
        <div>
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Produto, marca, cidade ou estado"
          />
        </div>
        <select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>Todos</option>
          {[...new Set(listingsData.map((x) => x.category))].sort().map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="results-count">
        {loading ? 'Carregando leilões…' : `${result.length} leilões encontrados`}
        {demo && ' · modo demonstração'}
      </p>
      {error && <p className="auth-message">{error}</p>}
      <div className="grid">
        {result.map((x) => (
          <ListingCard key={x.id} item={x} />
        ))}
      </div>
      {!loading && !error && !result.length && (
        <div className="empty-state">
          <Search />
          <h2>Nenhum leilão encontrado</h2>
          <p>Tente remover filtros ou buscar outro termo.</p>
        </div>
      )}
    </main>
  );
}
function Detail() {
  const { slug } = useParams();
  const { data: item, loading, error, demo, refresh } = useListing(slug);
  const [active, setActive] = useState(0);
  if (loading)
    return (
      <main className="page simple">
        <p>Carregando leilão…</p>
      </main>
    );
  if (error)
    return (
      <main className="page simple">
        <h1>Não foi possível carregar</h1>
        <p>{error}</p>
      </main>
    );
  if (!item) return <NotFound />;
  return (
    <main className="page detail">
      {demo && <p className="notice">Demonstração: anúncio ilustrativo. Lances não serão enviados.</p>}
      <div className="detail-grid">
        <div className="gallery">
          <img
            className="gallery-main"
            src={item.images[active] ?? item.image}
            alt={`${item.title} — foto ${active + 1}`}
          />
          <div className="gallery-thumbs">
            {item.images.map((img, i) => (
              <button className={i === active ? 'active' : ''} key={img} onClick={() => setActive(i)}>
                <img src={img} alt={`Foto ${i + 1}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="auction-box">
          <div className="eyebrow">
            {item.category} · {item.condition}
          </div>
          <h1>{item.title}</h1>
          <p className="location">
            <MapPin />
            {item.city}, {item.state} · {item.delivery}
          </p>
          <TrustBadges seller={item.seller} />
          <AuctionCountdown endsAt={item.endsAt} />
          <FavoriteButton key={item.id} listingId={item.id} />
          <LiveBidStage
            listingId={item.id}
            initialPrice={item.currentPriceCents}
            initialCount={item.bidCount}
            key={item.id}
            startCents={item.startPriceCents}
            minimumCents={item.minimumBidCents}
            disabled={demo || item.status !== 'active'}
            onSuccess={refresh}
          />
          <ProxyBidPanel
            key={item.id}
            listingId={item.id}
            currentCents={item.currentPriceCents}
            minimumCents={item.minimumBidCents}
            disabled={demo || item.status !== 'active'}
            onSuccess={refresh}
          />
          <div className="protected">
            <ShieldCheck />
            <div>
              <b>Lance é compromisso de compra.</b>
              <span>Use apenas uma conta e confira o valor antes de confirmar.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="detail-info">
        <span className="kicker">DESCRIÇÃO</span>
        <h2>Sobre este item</h2>
        <p>{item.description}</p>
        {item.defects && (
          <>
            <h3>Defeitos e marcas informados</h3>
            <p>{item.defects}</p>
          </>
        )}
        <h3>Vendedor</h3>
        <p>{item.seller?.display_name ?? (demo ? 'Perfil de demonstração' : 'Perfil indisponível')}</p>
        <TrustBadges seller={item.seller} />
      </div>
      <PublicQuestions key={item.id} listingId={item.id} sellerId={item.sellerId} />
    </main>
  );
}
function NotFound() {
  return (
    <main className="page simple">
      <span className="kicker">ERRO 404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço pode estar incorreto ou o anúncio não está mais disponível.</p>
      <Link className="btn primary" to="/buscar">
        Ver leilões ativos
      </Link>
    </main>
  );
}
function Simple({ title }: { title: string }) {
  return (
    <main className="page simple">
      <span className="kicker">MEULANCE</span>
      <h1>{title}</h1>
      <p>
        Esta página está em preparação. Pagamentos reais estão desativados. Termos e políticas ainda são
        rascunhos: REVISAR COM ADVOGADO.
      </p>
    </main>
  );
}
function Footer() {
  return (
    <footer>
      <div>
        <b>MeuLance</b>
        <span>Leilões entre pessoas.</span>
      </div>
      <div>
        <Link to="/como-funciona">Como funciona</Link>
        <Link to="/termos">Termos</Link>
        <Link to="/privacidade">Privacidade</Link>
        <Link to="/itens-proibidos">Itens proibidos</Link>
      </div>
      <small>© 2026 MeuLance · Brasil</small>
    </footer>
  );
}
export function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/buscar" element={<SearchPage />} />
        <Route path="/vender/novo" element={<CreateListingPage />} />
        <Route path="/l/:slug" element={<Detail />} />
        <Route path="/recuperar-senha" element={<RecoveryCard />} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/cadastrar" element={<AuthPage mode="signup" />} />
        <Route path="/conta/lances" element={<MyAuctions />} />
        <Route path="/conta/notificacoes" element={<NotificationSettings />} />
        <Route path="/conta/configuracoes" element={<AccountSettings />} />
        <Route path="/conta/favoritos" element={<MyAuctions favoritesOnly />} />
        <Route path="/conta/compras" element={<OrdersPage />} />
        <Route path="/conta/vendas" element={<OrdersPage sales />} />
        <Route path="/pedido/:id" element={<OrderPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        {['como-funciona', 'termos', 'privacidade', 'regras-de-leilao', 'itens-proibidos', 'ajuda'].map(
          (p) => (
            <Route
              key={p}
              path={`/${p}`}
              element={<Simple title={p.replaceAll('-', ' ').replaceAll('/', ' · ')} />}
            />
          ),
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  );
}
