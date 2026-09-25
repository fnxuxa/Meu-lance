import { lazy, Suspense, useLayoutEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// Home fica no bundle inicial; o resto é carregado sob demanda para reduzir o JS da primeira visita.
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const info = () => import('./pages/InfoPages');
const HowItWorks = lazy(() => info().then((m) => ({ default: m.HowItWorks })));
const TermsPage = lazy(() => info().then((m) => ({ default: m.TermsPage })));
const ProhibitedItemsPage = lazy(() => info().then((m) => ({ default: m.ProhibitedItemsPage })));
const AuctionRulesPage = lazy(() => info().then((m) => ({ default: m.AuctionRulesPage })));
const HelpPage = lazy(() => info().then((m) => ({ default: m.HelpPage })));
const PrivacyPage = lazy(() => info().then((m) => ({ default: m.PrivacyPage })));
const CreateListingPage = lazy(() =>
  import('../features/listings/CreateListingPage').then((m) => ({ default: m.CreateListingPage })),
);
const MyListings = lazy(() =>
  import('../features/listings/MyListings').then((m) => ({ default: m.MyListings })),
);
const SellerProfile = lazy(() =>
  import('../features/listings/SellerProfile').then((m) => ({ default: m.SellerProfile })),
);
const RecoveryCard = lazy(() =>
  import('../features/auth/RecoveryCard').then((m) => ({ default: m.RecoveryCard })),
);
const AuthPage = lazy(() => import('../features/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const AuthCallback = lazy(() =>
  import('../features/auth/AuthCallback').then((m) => ({ default: m.AuthCallback })),
);
const AccountSettings = lazy(() =>
  import('../features/auth/AccountSettings').then((m) => ({ default: m.AccountSettings })),
);
const IdentityVerification = lazy(() =>
  import('../features/auth/IdentityVerification').then((m) => ({ default: m.IdentityVerification })),
);
const MyAuctions = lazy(() =>
  import('../features/account/MyAuctions').then((m) => ({ default: m.MyAuctions })),
);
const NotificationSettings = lazy(() =>
  import('../features/notifications/NotificationSettings').then((m) => ({ default: m.NotificationSettings })),
);
const SavedSearchesPage = lazy(() =>
  import('../features/search/SavedSearches').then((m) => ({ default: m.SavedSearchesPage })),
);
const orders = () => import('../features/orders/OrdersPage');
const OrdersPage = lazy(() => orders().then((m) => ({ default: m.OrdersPage })));
const OrderPage = lazy(() => orders().then((m) => ({ default: m.OrderPage })));
const AdminDashboard = lazy(() =>
  import('../features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);

/** Volta ao topo a cada troca de página (sem isso a nova rota abria no meio, na posição da anterior). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function PageFallback() {
  return (
    <main className="page page-loading" aria-busy>
      <span className="spinner" aria-label="Carregando" />
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <b>MeuLance</b>
        <span>Compre e venda usados por lances entre pessoas.</span>
        <small>© {new Date().getFullYear()} MeuLance · Brasil</small>
      </div>
      <nav aria-label="Comprar e vender">
        <h2>Anúncios</h2>
        <Link to="/buscar">Explorar</Link>
        <Link to="/buscar?ordem=encerrando">Terminando em breve</Link>
        <Link to="/vender/novo">Anunciar um item</Link>
        <Link to="/como-funciona">Como funciona</Link>
      </nav>
      <nav aria-label="Ajuda">
        <h2>Ajuda</h2>
        <Link to="/ajuda">Perguntas frequentes</Link>
        <Link to="/regras-de-lance">Regras da venda por lances</Link>
        <Link to="/itens-proibidos">Itens proibidos</Link>
      </nav>
      <nav aria-label="Legal">
        <h2>Legal</h2>
        <Link to="/termos">Termos de uso</Link>
        <Link to="/privacidade">Privacidade</Link>
      </nav>
    </footer>
  );
}

export function App() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <ScrollToTop />
      <Header />
      <div id="conteudo" tabIndex={-1} className="route-view">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/buscar" element={<SearchPage />} />
            <Route path="/c/:categoria" element={<SearchPage />} />
            <Route path="/vender/novo" element={<CreateListingPage />} />
            <Route path="/l/:slug" element={<ListingDetail />} />
            <Route path="/vendedor/:id" element={<SellerProfile />} />
            <Route path="/u/:id" element={<SellerProfile />} />
            <Route path="/recuperar-senha" element={<RecoveryCard />} />
            <Route path="/entrar" element={<AuthPage mode="login" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/cadastrar" element={<AuthPage mode="signup" />} />
            <Route path="/conta/lances" element={<MyAuctions />} />
            <Route path="/conta/notificacoes" element={<NotificationSettings />} />
            <Route path="/conta/buscas" element={<SavedSearchesPage />} />
            <Route path="/conta/configuracoes" element={<AccountSettings />} />
            <Route path="/conta/favoritos" element={<Navigate to="/conta/lances" replace />} />
            <Route path="/conta/compras" element={<OrdersPage />} />
            <Route path="/conta/vendas" element={<OrdersPage sales />} />
            <Route path="/conta/anuncios" element={<MyListings />} />
            <Route path="/conta/verificacao" element={<IdentityVerification />} />
            <Route path="/pedido/:id" element={<OrderPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/como-funciona" element={<HowItWorks />} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/regras-de-lance" element={<AuctionRulesPage />} />
            <Route path="/regras-de-leilao" element={<Navigate to="/regras-de-lance" replace />} />
            <Route path="/ajuda" element={<HelpPage />} />
            <Route path="/itens-proibidos" element={<ProhibitedItemsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
      <Footer />
    </>
  );
}
