import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Gavel,
  MapPin,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
} from 'lucide-react';
import { useListings } from '../../features/listings/useListings';
import { ListingGrid } from '../../components/ListingCard';
import { AuctionCountdown } from '../../components/AuctionCountdown';
import { Reveal } from '../../components/Reveal';
import { HammerLink } from '../../components/HammerLink';
import { formatBRL } from '../../lib/money';
import { CATEGORIES } from '../../lib/categories';
import { plural } from '../../lib/text';
import { useDocumentMeta, useJsonLd, ORIGIN } from '../../lib/useDocumentMeta';

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MeuLance',
  url: ORIGIN,
  logo: ORIGIN + '/logo.png',
  description: 'Marketplace de leilões online de itens usados entre pessoas no Brasil.',
};
const SITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MeuLance',
  url: ORIGIN,
  inLanguage: 'pt-BR',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${ORIGIN}/buscar?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function Home() {
  const { data: listings, loading, error, demo } = useListings();
  useDocumentMeta({
    title: 'MeuLance — leilões online de usados com o melhor lance',
    description:
      'Compre e venda usados em leilões online no Brasil. Anuncie de graça, deixe o preço subir com a disputa e feche negócio com histórico de lances transparente.',
    canonicalPath: '/',
  });
  useJsonLd('ld-org', ORG_LD);
  useJsonLd('ld-site', SITE_LD);
  const featured = listings[0];
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) if (l.categorySlug) m.set(l.categorySlug, (m.get(l.categorySlug) ?? 0) + 1);
    return m;
  }, [listings]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill hero-enter" style={{ animationDelay: '0ms' }}>
            <Sparkles size={15} />O preço certo aparece quando as pessoas disputam.
          </div>
          <h1 className="hero-enter" style={{ animationDelay: '80ms' }}>
            Desapegue pelo <em>melhor lance.</em>
            <br />
            Encontre seu próximo achado.
          </h1>
          <p className="hero-enter" style={{ animationDelay: '160ms' }}>
            Leilões de usados entre pessoas, com histórico transparente e uma experiência feita para
            acompanhar a disputa ao vivo.
          </p>
          <div className="hero-actions hero-enter" style={{ animationDelay: '240ms' }}>
            <Link className="btn primary" to="/buscar">
              <Search />
              Quero comprar
            </Link>
            <HammerLink className="btn secondary" to="/vender/novo">
              <Gavel />
              Quero vender
            </HammerLink>
          </div>
          <div className="trust-row hero-enter" style={{ animationDelay: '320ms' }}>
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
        {featured && !demo ? (
          <div className="hero-panel">
            <div className="live">
              <span />
              LEILÃO ATIVO
            </div>
            <img src={featured.image} alt={featured.title} width={600} height={420} fetchPriority="high" />
            <div className="hero-auction">
              <small>{featured.title}</small>
              <strong>{formatBRL(featured.currentPriceCents)}</strong>
              <AuctionCountdown endsAt={featured.endsAt} />
              <Link className="btn primary wide" to={`/l/${featured.slug}`}>
                Acompanhar disputa <ArrowRight />
              </Link>
            </div>
          </div>
        ) : (
          <div className="hero-panel hero-panel-static">
            <img
              src="/landing.jpg"
              alt="MeuLance — leilão na palma da mão"
              width={600}
              height={600}
              fetchPriority="high"
            />
          </div>
        )}
      </section>
      <Reveal>
        <section className="section">
          <div className="section-head">
            <div>
              <span className="kicker">ACABANDO AGORA</span>
              <h2>Últimas chances</h2>
            </div>
            <Link to="/buscar?ordem=encerrando">
              Ver todos <ChevronRight />
            </Link>
          </div>
          {demo && <p className="notice">Demonstração: anúncio ilustrativo, sem transações reais.</p>}
          {error && (
            <p className="auth-message" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && !listings.length ? (
            <div className="empty-state home-empty">
              <PackageOpen />
              <h3>Nenhum leilão ativo agora</h3>
              <p>Que tal inaugurar a vitrine? Anunciar é grátis e leva poucos minutos.</p>
              <HammerLink className="btn primary" to="/vender/novo">
                <Gavel /> Anunciar o primeiro item
              </HammerLink>
            </div>
          ) : (
            <ListingGrid items={listings.slice(0, 8)} loading={loading} demo={demo} />
          )}
        </section>
      </Reveal>
      <Reveal>
        <section className="section section-tight">
          <div className="section-head">
            <div>
              <span className="kicker">CATEGORIAS</span>
              <h2>O que você procura?</h2>
            </div>
          </div>
          <div className="category-grid">
            {CATEGORIES.map(({ slug, name, Icon, blurb }) => (
              <Link key={slug} className="category-tile" to={`/c/${slug}`}>
                <span className="category-icon">
                  <Icon aria-hidden />
                </span>
                <b>{name}</b>
                <small>
                  {counts.get(slug) ? plural(counts.get(slug)!, 'leilão ativo', 'leilões ativos') : blurb}
                </small>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="how">
          <div>
            <span className="kicker">SIMPLES E SEGURO</span>
            <h2>
              Você escolhe o lado.
              <br />A plataforma organiza o fluxo.
            </h2>
            <Link className="how-link" to="/como-funciona">
              Entenda o passo a passo <ArrowRight size={16} />
            </Link>
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
      </Reveal>
      <Reveal>
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
                <li>
                  Você chuta um valor e torce: alto demais, ninguém compra; baixo demais, você perde dinheiro.
                </li>
                <li>Sem prazo, sem urgência — o anúncio junta poeira por semanas.</li>
                <li>Cada comprador tenta pechinchar no particular, um de cada vez.</li>
              </ul>
            </div>
            <div className="compare-card highlight">
              <span className="compare-tag">Leilão progressivo no MeuLance</span>
              <ul>
                <li>
                  Vários interessados disputam ao mesmo tempo e o preço sobe até o valor justo de mercado.
                </li>
                <li>Contagem regressiva pública cria urgência real — as disputas acirram no fim.</li>
                <li>Histórico de lances transparente dá segurança para o comprador pagar mais.</li>
              </ul>
            </div>
          </div>
        </section>
      </Reveal>
      <Reveal>
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
      </Reveal>
    </>
  );
}
