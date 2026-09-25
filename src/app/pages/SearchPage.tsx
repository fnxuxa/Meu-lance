import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useListings } from '../../features/listings/useListings';
import { ListingGrid } from '../../components/ListingCard';
import { Breadcrumbs } from '../../components/Breadcrumbs';
import { CATEGORIES, categoryBySlug } from '../../lib/categories';
import { normalizeText, plural } from '../../lib/text';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import type { Listing } from '../../types/domain';
import NotFound from './NotFound';
import { SaveSearchButton } from '../../features/search/SavedSearches';

const SORTS = {
  encerrando: {
    label: 'Encerrando primeiro',
    fn: (a: Listing, b: Listing) => a.endsAt.localeCompare(b.endsAt),
  },
  'menor-preco': {
    label: 'Menor preço',
    fn: (a: Listing, b: Listing) => a.currentPriceCents - b.currentPriceCents,
  },
  'maior-preco': {
    label: 'Maior preço',
    fn: (a: Listing, b: Listing) => b.currentPriceCents - a.currentPriceCents,
  },
  'mais-lances': { label: 'Mais lances', fn: (a: Listing, b: Listing) => b.bidCount - a.bidCount },
} as const;
type SortKey = keyof typeof SORTS;
const DELIVERY = [
  { value: 'envio', label: 'Com envio', match: (l: Listing) => l.delivery !== 'Retirada' },
  { value: 'retirada', label: 'Retirada', match: (l: Listing) => l.delivery !== 'Envio' },
] as const;

export default function SearchPage() {
  const { categoria } = useParams();
  const category = categoria ? categoryBySlug(categoria) : undefined;
  const [params, setParams] = useSearchParams();
  const { data: listingsData, loading, error, demo } = useListings();
  const q = params.get('q') ?? '';
  const cat = category?.slug ?? params.get('cat') ?? '';
  const sort: SortKey =
    (params.get('ordem') as SortKey) in SORTS ? (params.get('ordem') as SortKey) : 'encerrando';
  const delivery = params.get('entrega') ?? '';
  const condition = params.get('condicao') ?? '';

  // efeitos do pai rodam depois dos do filho: sem este ramo, o <NotFound /> abaixo perderia o noindex
  useDocumentMeta(
    categoria && !category
      ? { title: 'Página não encontrada', noindex: true }
      : category
        ? {
            title: `${category.name} usados por lances`,
            description: `Compre ${category.name.toLowerCase()} usados por lances no Brasil: ${category.blurb} Dê seu lance e acompanhe a disputa ao vivo.`,
            canonicalPath: `/c/${category.slug}`,
          }
        : {
            title: q ? `${q} — resultados de busca` : 'Anúncios ativos de usados',
            description: 'Busque anúncios de usados por produto, categoria, cidade ou estado e dê seu lance.',
            canonicalPath: '/buscar',
            // páginas de resultado com termo livre não devem ser indexadas (conteúdo raso/duplicado)
            noindex: !!q,
          },
  );

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const conditions = useMemo(
    () => [...new Set(listingsData.map((x) => x.condition))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [listingsData],
  );
  const result = useMemo(() => {
    const terms = normalizeText(q).split(/\s+/).filter(Boolean);
    const del = DELIVERY.find((d) => d.value === delivery);
    return listingsData
      .filter((x) => {
        if (cat && x.categorySlug !== cat) return false;
        if (del && !del.match(x)) return false;
        if (condition && x.condition !== condition) return false;
        const hay = normalizeText(`${x.title} ${x.category} ${x.city} ${x.state} ${x.condition}`);
        return terms.every((t) => hay.includes(t));
      })
      .sort(SORTS[sort].fn);
  }, [q, cat, delivery, condition, sort, listingsData]);
  const activeFilters = [!category && cat, delivery, condition].filter(Boolean).length;

  if (categoria && !category) return <NotFound />;
  return (
    <main className="page">
      {category && (
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            { label: 'Anúncios', to: '/buscar' },
            { label: category.name, to: `/c/${category.slug}` },
          ]}
        />
      )}
      <div className="browse-head">
        <span className="kicker">{category ? 'CATEGORIA' : 'ANÚNCIOS ATIVOS'}</span>
        <h1>{category ? `${category.name} por lances` : 'Encontre seu próximo achado'}</h1>
        <p>{category ? category.blurb : 'Busque por produto, categoria ou região.'}</p>
      </div>
      <div className="filterbar">
        <div>
          <Search aria-hidden />
          <input
            type="search"
            aria-label="Buscar anúncios"
            value={q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Produto, marca, cidade ou estado"
          />
          {q && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Limpar busca"
              onClick={() => update('q', '')}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <select aria-label="Ordenar" value={sort} onChange={(e) => update('ordem', e.target.value)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-chips" role="group" aria-label="Filtros">
        <SlidersHorizontal size={16} aria-hidden />
        {!category && (
          <select aria-label="Categoria" value={cat} onChange={(e) => update('cat', e.target.value)}>
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {DELIVERY.map((d) => (
          <button
            type="button"
            key={d.value}
            className={'chip' + (delivery === d.value ? ' active' : '')}
            aria-pressed={delivery === d.value}
            onClick={() => update('entrega', delivery === d.value ? '' : d.value)}
          >
            {d.label}
          </button>
        ))}
        {conditions.length > 1 && (
          <select
            aria-label="Condição"
            value={condition}
            onChange={(e) => update('condicao', e.target.value)}
          >
            <option value="">Qualquer condição</option>
            {conditions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        {activeFilters > 0 && (
          <button
            type="button"
            className="chip clear"
            onClick={() => {
              const next = new URLSearchParams();
              if (q) next.set('q', q);
              setParams(next, { replace: true });
            }}
          >
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>
      <SaveSearchButton
        key={[q, cat, condition].join('|')}
        q={q}
        categorySlug={cat}
        conditionText={condition}
      />
      <p className="results-count" role="status">
        {loading
          ? 'Carregando anúncios…'
          : plural(result.length, 'anúncio encontrado', 'anúncios encontrados')}
      </p>
      {error && (
        <p className="auth-message" role="alert">
          {error}
        </p>
      )}
      <ListingGrid items={result} loading={loading} demo={demo} skeletons={8} />
      {!loading && !error && !result.length && (
        <div className="empty-state">
          <Search />
          <h2>Nenhum anúncio encontrado</h2>
          <p>Tente remover filtros ou buscar outro termo.</p>
          <Link className="btn secondary" to="/vender/novo">
            Tem um desses parado em casa? Anuncie
          </Link>
        </div>
      )}
      {category && (
        <nav className="related-categories" aria-label="Outras categorias">
          <span className="kicker">OUTRAS CATEGORIAS</span>
          <div>
            {CATEGORIES.filter((c) => c.slug !== category.slug).map((c) => (
              <Link key={c.slug} className="chip" to={`/c/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}
