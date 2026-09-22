import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
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
import { useDocumentMeta, setJsonLd, removeJsonLd } from '../lib/useDocumentMeta';
function Home() {
  const { data: listings, loading, error, demo } = useListings();
  useDocumentMeta({
    title: 'MeuLance — leilões online de usados com o melhor lance',
    description:
      'Compre e venda usados em leilões online no Brasil. Anuncie de graça, deixe o preço subir com a disputa e feche negócio com histórico de lances transparente.',
    canonicalPath: '/',
  });
  useEffect(() => {
    setJsonLd('ld-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'MeuLance',
      url: window.location.origin,
      logo: window.location.origin + '/icon.svg',
      description: 'Marketplace de leilões online de itens usados entre pessoas físicas no Brasil.',
    });
    setJsonLd('ld-site', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'MeuLance',
      url: window.location.origin,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${window.location.origin}/buscar?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
    return () => {
      removeJsonLd('ld-org');
      removeJsonLd('ld-site');
    };
  }, []);
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
              Anuncie grátis, só paga se vender
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
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">POR QUE LEILÃO</span>
            <h2>
              Preço fixo trava seu anúncio num chute.
              <br />O lance encontra o valor real.
            </h2>
          </div>
        </div>
        <div className="compare-grid">
          <div className="compare-card">
            <span className="compare-tag">Anúncio de preço fixo</span>
            <ul>
              <li>Você chuta um valor e torce: alto demais, ninguém compra; baixo demais, você perde dinheiro.</li>
              <li>Sem prazo, sem urgência — o anúncio junta poeira por semanas.</li>
              <li>Cada comprador tenta pechinchar no particular, um de cada vez.</li>
            </ul>
          </div>
          <div className="compare-card highlight">
            <span className="compare-tag">Leilão progressivo no MeuLance</span>
            <ul>
              <li>Vários interessados disputam ao mesmo tempo e o preço sobe até o valor justo de mercado.</li>
              <li>Contagem regressiva pública cria urgência real — as disputas acirram no fim.</li>
              <li>Histórico de lances transparente dá segurança para o comprador pagar mais.</li>
            </ul>
          </div>
        </div>
      </section>
      <div className="cta">
        <div>
          <span className="kicker">TEM ALGO PARADO EM CASA?</span>
          <h2>Publique em minutos e deixe o mercado decidir o preço.</h2>
          <p>Anúncio grátis. Você só paga uma pequena comissão quando o item é vendido.</p>
        </div>
        <Link className="btn light" to="/vender/novo">
          Anunciar agora <ArrowRight />
        </Link>
      </div>
    </>
  );
}
function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { data: listingsData, loading, error, demo } = useListings();
  const q = params.get('q') ?? '';
  useDocumentMeta({
    title: q ? `${q} — resultados de leilão` : 'Leilões ativos de usados',
    description: 'Busque leilões de usados por produto, categoria, cidade ou estado e dê seu lance.',
    canonicalPath: '/buscar',
  });
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
  useDocumentMeta({
    title: item ? `${item.title} — ${item.city}/${item.state}` : 'Leilão',
    description: item
      ? `${item.title}: lance atual ${formatBRL(item.currentPriceCents)}, estado ${item.condition}, em ${item.city}/${item.state}. Dê seu lance no MeuLance.`
      : undefined,
    canonicalPath: slug ? `/l/${slug}` : undefined,
  });
  useEffect(() => {
    if (!item) return;
    setJsonLd('ld-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: item.title,
      description: item.description,
      image: item.images,
      category: item.category,
      itemCondition:
        item.condition === 'Novo'
          ? 'https://schema.org/NewCondition'
          : 'https://schema.org/UsedCondition',
      offers: {
        '@type': 'Offer',
        price: (item.currentPriceCents / 100).toFixed(2),
        priceCurrency: 'BRL',
        availability: item.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        url: window.location.href,
      },
    });
    return () => removeJsonLd('ld-product');
  }, [item]);
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
function HowItWorks() {
  useDocumentMeta({
    title: 'Como funciona — venda por leilão progressivo',
    description:
      'Entenda como funciona vender e comprar usados em leilão no MeuLance: anuncie grátis, receba lances progressivos e feche pelo valor real de mercado.',
    canonicalPath: '/como-funciona',
  });
  useEffect(() => {
    setJsonLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Quanto custa anunciar no MeuLance?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Anunciar é grátis. O MeuLance cobra uma pequena comissão apenas sobre vendas concluídas.',
          },
        },
        {
          '@type': 'Question',
          name: 'Por que vender em leilão em vez de preço fixo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Em um leilão, vários compradores disputam o mesmo item ao mesmo tempo, o que tende a levar o preço final até o valor real de mercado — em vez de você chutar um preço fixo e torcer.',
          },
        },
        {
          '@type': 'Question',
          name: 'O que acontece quando o leilão termina?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'O maior lance vence, um pedido é criado automaticamente e comprador e vendedor combinam pagamento e entrega pelo chat do pedido.',
          },
        },
      ],
    });
    return () => removeJsonLd('ld-faq');
  }, []);
  return (
    <main className="page">
      <div className="form-intro">
        <span className="kicker">COMO FUNCIONA</span>
        <h1>Seu preço não é um chute. É o que o mercado paga.</h1>
        <p>
          Anúncio de preço fixo trava seu item num número — alto demais e ninguém compra, baixo demais e
          você perde dinheiro. No leilão progressivo do MeuLance, quem decide o preço são as pessoas que
          realmente querem seu item, disputando lance a lance até o valor justo.
        </p>
      </div>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="kicker">PARA QUEM VENDE</span>
            <h2>Do anúncio ao dinheiro na conta, em 3 passos</h2>
          </div>
        </div>
        <div className="steps steps-light">
          <article>
            <b>01</b>
            <Gavel />
            <h3>Anuncie de graça</h3>
            <p>
              Fotos, descrição e um preço inicial baixo — leilões com lance inicial atrativo atraem mais
              disputa e terminam em valores mais altos.
            </p>
          </article>
          <article>
            <b>02</b>
            <Sparkles />
            <h3>Acompanhe os lances subirem</h3>
            <p>Interessados disputam ao vivo, com contagem regressiva e histórico público de lances.</p>
          </article>
          <article>
            <b>03</b>
            <WalletCards />
            <h3>Combine entrega e receba</h3>
            <p>
              O maior lance vence, um pedido é criado automaticamente e você combina envio ou retirada pelo
              chat do pedido.
            </p>
          </article>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">A DIFERENÇA NA PRÁTICA</span>
            <h2>Leilão progressivo vs. anúncio de preço fixo</h2>
          </div>
        </div>
        <div className="compare-grid">
          <div className="compare-card">
            <span className="compare-tag">Preço fixo</span>
            <ul>
              <li>Você define um número e espera — sem saber se é alto ou baixo demais.</li>
              <li>Compradores pechincham no particular, um de cada vez, sem pressão de tempo.</li>
              <li>Anúncios ficam parados por semanas sem gerar urgência.</li>
            </ul>
          </div>
          <div className="compare-card highlight">
            <span className="compare-tag">Leilão MeuLance</span>
            <ul>
              <li>O preço sobe conforme o interesse real — quem mais quer, mais paga.</li>
              <li>Prazo com contagem regressiva pública cria urgência genuína no fim do leilão.</li>
              <li>Histórico de lances transparente aumenta a confiança de quem está comprando.</li>
            </ul>
          </div>
        </div>
      </section>
      <div className="cta">
        <div>
          <span className="kicker">PRONTO PARA COMEÇAR?</span>
          <h2>Anuncie seu primeiro item agora mesmo.</h2>
          <p>Leva menos de 5 minutos e você não paga nada até vender.</p>
        </div>
        <Link className="btn light" to="/vender/novo">
          Quero vender <ArrowRight />
        </Link>
      </div>
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
        <Route path="/conta/favoritos" element={<Navigate to="/conta/lances" replace />} />
        <Route path="/conta/compras" element={<OrdersPage />} />
        <Route path="/conta/vendas" element={<OrdersPage sales />} />
        <Route path="/pedido/:id" element={<OrderPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/como-funciona" element={<HowItWorks />} />
        {['termos', 'privacidade', 'regras-de-leilao', 'itens-proibidos', 'ajuda'].map(
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
