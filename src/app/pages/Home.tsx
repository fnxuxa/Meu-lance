import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Handshake,
  MapPin,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Truck,
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
  description: 'Marketplace de compra e venda de itens usados por lances entre pessoas no Brasil.',
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
  const { data: listings, loading, demo } = useListings();
  useDocumentMeta({
    title: 'MeuLance — leilão, preço fixo e vitrine de usados',
    description:
      'Compre e venda usados no Brasil: dispute por lance, publique com preço fixo ou monte sua vitrine com vários produtos. Anuncie de graça.',
    canonicalPath: '/',
  });
  useJsonLd('ld-org', ORG_LD);
  useJsonLd('ld-site', SITE_LD);
  const featured = listings.find((l) => l.saleType === 'auction');
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
            <Sparkles size={15} />
            Leilão, preço fixo ou sua vitrine própria — você escolhe como vender.
          </div>
          <h1 className="hero-enter" style={{ animationDelay: '80ms' }}>
            Desapegue do seu jeito.
            <br />
            Encontre seu próximo <em>achado.</em>
          </h1>
          <p className="hero-enter" style={{ animationDelay: '160ms' }}>
            Dispute por lance quando o valor é incerto, venda direto com preço fixo, ou monte sua vitrine com
            vários produtos. Tudo num só lugar, com anúncio grátis.
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
              EM DISPUTA
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
              src="/landing.webp"
              srcSet="/landing-600.webp 600w, /landing.webp 900w"
              sizes="(max-width: 850px) 100vw, 600px"
              alt="MeuLance — oportunidades na palma da mão"
              width={600}
              height={600}
              fetchPriority="high"
            />
          </div>
        )}
      </section>
      <Reveal>
        <section className="section section-tight">
          <div className="section-head">
            <div>
              <span className="kicker">TRÊS FORMAS DE VENDER</span>
              <h2>Escolha o que combina com o seu item.</h2>
            </div>
          </div>
          <div className="compare-grid compare-grid-3">
            <div className="compare-card compare-card-hover">
              <span className="compare-tag">
                <Gavel size={14} /> Leilão
              </span>
              <p className="compare-lede">
                Ideal pra relíquia, colecionável ou item raro — quando você não sabe quanto vale.
              </p>
              <ul>
                <li>
                  Vários interessados disputam ao mesmo tempo e o preço encontra o valor real de mercado.
                </li>
                <li>Contagem regressiva pública cria urgência real nos minutos finais.</li>
              </ul>
            </div>
            <div className="compare-card compare-card-hover">
              <span className="compare-tag">
                <Tag size={14} /> Preço fixo
              </span>
              <p className="compare-lede">
                Pra quando você já sabe o preço e quer vender rápido, sem esperar disputa.
              </p>
              <ul>
                <li>Publica o valor (ou aceita ofertas) e negocia direto com quem se interessar.</li>
                <li>Sem prazo de leilão — o anúncio fica até vender ou você pausar.</li>
              </ul>
            </div>
            <div className="compare-card compare-card-hover">
              <span className="compare-tag">
                <Store size={14} /> Vitrine
              </span>
              <p className="compare-lede">
                Pra quem tem várias peças ou já vende por conta própria e quer um lugar só pra tudo.
              </p>
              <ul>
                <li>Página própria com todos os seus produtos, leilão e preço fixo juntos.</li>
                <li>Link pra compartilhar no WhatsApp e nas redes.</li>
              </ul>
              <HammerLink className="compare-cta" to="/vender/novo">
                Começar minha vitrine <ArrowRight size={15} />
              </HammerLink>
            </div>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="section">
          <div className="section-head">
            <div>
              <span className="kicker">NA VITRINE</span>
              <h2>Recém-publicados</h2>
            </div>
            <Link to="/buscar">
              Ver todos <ChevronRight />
            </Link>
          </div>
          {demo && <p className="notice">Demonstração: anúncio ilustrativo, sem transações reais.</p>}
          {!loading && !listings.length ? (
            <div className="empty-state home-empty">
              <PackageOpen />
              <h3>Nenhum anúncio ativo agora</h3>
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
                  {counts.get(slug) ? plural(counts.get(slug)!, 'anúncio ativo', 'anúncios ativos') : blurb}
                </small>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="how how-light">
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
          <div className="steps steps-light">
            <article>
              <b>01</b>
              <Gavel />
              <h3>Anuncie ou dê um lance</h3>
              <p>Anuncie seu produto ou dispute itens que você quer.</p>
            </article>
            <article>
              <b>02</b>
              <Handshake />
              <h3>Combine o pagamento</h3>
              <p>
                Por enquanto, comprador e vendedor combinam o pagamento direto. Pagamento protegido pela
                plataforma está a caminho.
              </p>
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
        <div className="cta">
          <div>
            <span className="kicker">TEM ALGO PARADO EM CASA?</span>
            <h2>Publique em minutos, do jeito que fizer mais sentido pra você.</h2>
            <p>
              Leilão, preço fixo ou vitrine com várias peças — anúncio grátis, você só paga uma pequena
              comissão quando o item é vendido.
            </p>
          </div>
          <HammerLink className="btn light" to="/vender/novo">
            Anunciar agora <ArrowRight />
          </HammerLink>
        </div>
      </Reveal>
    </>
  );
}
