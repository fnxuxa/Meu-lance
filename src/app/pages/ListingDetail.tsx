import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Flag, MapPin, ShieldCheck } from 'lucide-react';
import { useListing } from '../../features/listings/useListings';
import { FavoriteButton } from '../../features/listings/FavoriteButton';
import { LiveBidStage } from '../../features/bidding/LiveBidStage';
import { ProxyBidPanel } from '../../features/bidding/ProxyBidPanel';
import { BidHistoryChart } from '../../features/bidding/BidHistoryChart';
import { PublicQuestions } from '../../features/listings/PublicQuestions';
import { ConditionReport } from '../../features/listings/ConditionReport';
import { AsIsGate } from '../../features/bidding/AsIsGate';
import { useAppConfig } from '../../lib/useAppConfig';
import { ReportListingButton } from '../../features/listings/ReportListingButton';
import { AuctionCountdown } from '../../components/AuctionCountdown';
import { TrustBadges } from '../../components/TrustBadges';
import { BackButton } from '../../components/BackButton';
import { Gallery } from '../../components/Gallery';
import { ShareButton } from '../../components/ShareButton';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { formatBRL } from '../../lib/money';
import { useIsPast } from '../../lib/time';
import { absoluteUrl, useDocumentMeta, useJsonLd } from '../../lib/useDocumentMeta';
import NotFound from './NotFound';

const STATUS_LABEL: Record<string, string> = {
  ended_with_winner: 'Prazo de lances encerrado — item vendido.',
  ended_no_bids: 'Prazo de lances encerrado sem lances.',
  cancelled: 'Este anúncio foi cancelado pelo vendedor.',
};

export default function ListingDetail() {
  const { slug } = useParams();
  const { data: item, loading, error, demo, refresh } = useListing(slug);
  const pastEnd = useIsPast(item?.endsAt);
  const { buyerFeeBps } = useAppConfig();
  const canonicalPath = slug ? `/l/${slug}` : undefined;
  const missing = !loading && !error && !item;
  // efeitos do pai rodam depois dos do filho: o <NotFound /> abaixo depende deste noindex
  useDocumentMeta({
    title: item
      ? `${item.title} — ${item.city}/${item.state}`
      : missing
        ? 'Página não encontrada'
        : 'Anúncio',
    description: item
      ? `${item.title}: ${item.bidCount ? 'maior lance' : 'lance inicial'} ${formatBRL(item.currentPriceCents)}, estado ${item.condition}, em ${item.city}/${item.state}. Dê seu lance no MeuLance.`
      : undefined,
    canonicalPath,
    image: item?.image,
    type: 'product',
    noindex: missing || (!!item && item.status !== 'active'),
  });
  const productLd = useMemo(
    () =>
      item && {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: item.title,
        description: item.description,
        image: item.images.map(absoluteUrl),
        category: item.category,
        itemCondition:
          item.condition === 'Novo' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
        offers: {
          '@type': 'Offer',
          price: (item.currentPriceCents / 100).toFixed(2),
          priceCurrency: 'BRL',
          priceValidUntil: item.endsAt.slice(0, 10),
          availability:
            item.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          url: absoluteUrl(`/l/${item.slug}`),
          areaServed: 'BR',
        },
      },
    [item],
  );
  useJsonLd('ld-product', productLd);

  if (loading)
    return (
      <main className="page detail" aria-busy>
        <div className="detail-grid">
          <div className="skeleton detail-skeleton-img" />
          <div className="auction-box">
            <div className="skeleton line short" />
            <div className="skeleton line title" />
            <div className="skeleton line" />
            <div className="skeleton line price" />
          </div>
        </div>
      </main>
    );
  if (error)
    return (
      <main className="page simple">
        <h1>Não foi possível carregar</h1>
        <p>{error}</p>
        <button type="button" className="btn primary" onClick={refresh}>
          Tentar novamente
        </button>
      </main>
    );
  if (!item) return <NotFound />;
  const ended = item.status !== 'active' || pastEnd;
  const endedLabel = STATUS_LABEL[item.status ?? ''] ?? 'Prazo encerrado. Aguardando apuração do vencedor.';
  return (
    <main className="page detail">
      <div className="detail-top">
        <BackButton fallback="/buscar" />
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            item.categorySlug
              ? { label: item.category, to: `/c/${item.categorySlug}` }
              : { label: 'Anúncios', to: '/buscar' },
            { label: item.title },
          ]}
        />
      </div>
      {demo && <p className="notice">Demonstração: anúncio ilustrativo. Lances não serão enviados.</p>}
      <div className="detail-grid">
        <Gallery key={item.id} images={item.images.length ? item.images : [item.image]} title={item.title} />
        <div className="auction-box">
          <div className="eyebrow">
            {item.category} · {item.condition}
          </div>
          <h1>{item.title}</h1>
          <p className="location">
            <MapPin aria-hidden />
            {item.city}, {item.state} · {item.delivery}
          </p>
          <TrustBadges seller={item.seller} />
          {ended ? (
            <div className="ended-banner" role="status">
              <b>{endedLabel}</b>
              <span>
                {item.bidCount ? 'Valor final' : 'Lance inicial'}: {formatBRL(item.currentPriceCents)}
              </span>
              <Link to={item.categorySlug ? `/c/${item.categorySlug}` : '/buscar'}>
                Ver anúncios parecidos
              </Link>
            </div>
          ) : (
            <AuctionCountdown endsAt={item.endsAt} />
          )}
          <div className="detail-actions">
            <FavoriteButton key={'fav-' + item.id} listingId={item.id} />
            <ShareButton title={item.title} url={absoluteUrl(`/l/${item.slug}`)} />
          </div>
          <AsIsGate
            key={'as-is-' + item.id}
            listingId={item.id}
            active={item.conditionCode === 'for_parts' && !ended && !demo}
          >
            {(blocked) => (
              <>
                <LiveBidStage
                  listingId={item.id}
                  initialPrice={item.currentPriceCents}
                  initialCount={item.bidCount}
                  key={'live-' + item.id}
                  startCents={item.startPriceCents}
                  minimumCents={item.minimumBidCents}
                  disabled={demo || ended || blocked}
                  buyerFeeBps={buyerFeeBps}
                  onSuccess={refresh}
                />
                {!ended && (
                  <ProxyBidPanel
                    key={'proxy-' + item.id}
                    listingId={item.id}
                    currentCents={item.currentPriceCents}
                    minimumCents={item.minimumBidCents}
                    disabled={demo || blocked}
                    onSuccess={refresh}
                  />
                )}
              </>
            )}
          </AsIsGate>
          <div className="protected">
            <ShieldCheck aria-hidden />
            <div>
              <b>Lance é compromisso de compra.</b>
              <span>
                Quem vence paga o lance + {(buyerFeeBps / 100).toLocaleString('pt-BR')}% de taxa de proteção.
                {item.secondChance && ' Se o vencedor não pagar, o 2º colocado recebe uma oferta.'}
                Veja as <Link to="/regras-de-leilao">regras da venda por lances</Link>.
              </span>
            </div>
          </div>
        </div>
      </div>
      <BidHistoryChart listingId={item.id} startPriceCents={item.startPriceCents} />
      <div className="detail-info">
        <span className="kicker">DESCRIÇÃO</span>
        <h2>Sobre este item</h2>
        <p className="prewrap">{item.description}</p>
        <ConditionReport item={item} />
        <h3>Vendedor</h3>
        {item.seller && !demo ? (
          <p>
            <Link to={`/vendedor/${item.sellerId}`}>{item.seller.display_name}</Link>
          </p>
        ) : (
          <p>{demo ? 'Perfil de demonstração' : 'Perfil indisponível'}</p>
        )}
        <TrustBadges seller={item.seller} />
        {!demo ? (
          <ReportListingButton listingId={item.id} sellerId={item.sellerId} />
        ) : (
          <p className="muted">
            <Flag size={13} aria-hidden /> Denúncias ficam disponíveis em anúncios reais.
          </p>
        )}
      </div>
      <PublicQuestions key={item.id} listingId={item.id} sellerId={item.sellerId} />
    </main>
  );
}
