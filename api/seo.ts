// Vercel serverless function: injeta metadados reais (título, descrição, imagem, canonical, JSON-LD) no
// index.html das páginas públicas indexáveis (/l/:slug e /c/:slug). Assim buscadores e prévias de link
// (WhatsApp, Facebook, X) enxergam o conteúdo do anúncio sem executar JavaScript. O SPA continua igual:
// ao carregar, o React assume a página e atualiza as mesmas tags.
// Só lê dados públicos com a anon key (RLS aplicada). Qualquer falha devolve o index.html original.

const CATEGORIES: Record<string, { name: string; blurb: string }> = {
  celulares: { name: 'Celulares', blurb: 'iPhone, Samsung, Motorola e mais.' },
  'pc-games': { name: 'PC & Games', blurb: 'Consoles, jogos, placas e periféricos.' },
  eletronicos: { name: 'Eletrônicos', blurb: 'TVs, monitores, áudio e câmeras.' },
  casa: { name: 'Casa', blurb: 'Móveis, eletrodomésticos e decoração.' },
  ferramentas: { name: 'Ferramentas', blurb: 'Elétricas, manuais e oficina.' },
  esportes: { name: 'Esportes', blurb: 'Bicicletas, fitness e aventura.' },
  instrumentos: { name: 'Instrumentos', blurb: 'Violões, teclados e equipamentos.' },
  colecionaveis: { name: 'Colecionáveis', blurb: 'Cards, miniaturas e raridades.' },
};

type ListingRow = {
  slug: string;
  title: string;
  description: string;
  condition: string;
  current_price_cents: number;
  bid_count: number;
  city: string;
  state: string;
  status: string;
  ends_at: string;
  categories: { name: string } | null;
  listing_images: { storage_path: string; sort_order: number }[];
};

type Meta = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type: string;
  noindex?: boolean;
  jsonLd?: unknown;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON dentro de <script>: impede fechar a tag com "</script>" vindo do texto do anúncio
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const CONDITION: Record<string, string> = {
  new: 'Novo',
  like_new: 'Como novo',
  good: 'Bom',
  fair: 'Regular',
  for_parts: 'Para peças',
};

async function listingMeta(slug: string, origin: string): Promise<Meta | null> {
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  const select =
    'slug,title,description,condition,current_price_cents,bid_count,city,state,status,ends_at,categories(name),listing_images(storage_path,sort_order)';
  const url = `${base}/rest/v1/listings?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&status=in.(active,ended_no_bids,ended_with_winner,cancelled)&limit=1`;
  const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const [row] = (await r.json()) as ListingRow[];
  if (!row) return null;
  const images = [...(row.listing_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (i) =>
        `${base}/storage/v1/object/public/listing-images/${i.storage_path.split('/').map(encodeURIComponent).join('/')}`,
    );
  const canonical = `${origin}/l/${row.slug}`;
  const condition = CONDITION[row.condition] ?? row.condition;
  const active = row.status === 'active';
  return {
    title: `${row.title} — ${row.city}/${row.state} · MeuLance`,
    description: clip(
      `${row.title}: ${row.bid_count ? 'lance atual' : 'lance inicial'} ${brl(row.current_price_cents)}, estado ${condition}, em ${row.city}/${row.state}. Dê seu lance no MeuLance.`,
      300,
    ),
    canonical,
    image: images[0],
    type: 'product',
    noindex: !active,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: row.title,
      description: clip(row.description, 5000),
      image: images,
      category: row.categories?.name,
      itemCondition:
        row.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      offers: {
        '@type': 'Offer',
        price: (row.current_price_cents / 100).toFixed(2),
        priceCurrency: 'BRL',
        priceValidUntil: row.ends_at.slice(0, 10),
        availability: active ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        url: canonical,
        areaServed: 'BR',
      },
    },
  };
}

function categoryMeta(slug: string, origin: string): Meta | null {
  const c = CATEGORIES[slug];
  if (!c) return null;
  return {
    title: `${c.name} usados em leilão · MeuLance`,
    description: `Leilões de ${c.name.toLowerCase()} usados no Brasil: ${c.blurb} Dê seu lance e acompanhe a disputa ao vivo.`,
    canonical: `${origin}/c/${slug}`,
    type: 'website',
  };
}

function inject(html: string, m: Meta): string {
  const tags = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<meta name="robots" content="${m.noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:url" content="${esc(m.canonical)}" />`,
    m.image ? `<meta property="og:image" content="${esc(m.image)}" />` : '',
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    m.image ? `<meta name="twitter:image" content="${esc(m.image)}" />` : '',
    m.jsonLd ? `<script type="application/ld+json" id="ld-product">${jsonForScript(m.jsonLd)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  // remove as versões genéricas do index.html para não duplicar tags
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:(title|description|type|image|url)"[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:(title|description|image)"[^>]*>/g, '');
  return cleaned.replace('</head>', `    ${tags}\n  </head>`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos do runtime Node da Vercel não estão instalados
export default async function handler(req: any, res: any) {
  const origin = `https://${req.headers.host}`;
  const kind = String(req.query.kind ?? '');
  const slug = String(req.query.slug ?? '').slice(0, 200);
  let html: string;
  try {
    const r = await fetch(`${origin}/index.html`);
    if (!r.ok) throw new Error(`index ${r.status}`);
    html = await r.text();
  } catch {
    // sem o shell não há o que servir; manda o navegador para a home
    res.setHeader('Location', '/');
    return res.status(302).end();
  }
  let status = 200;
  try {
    const meta =
      kind === 'l' ? await listingMeta(slug, origin) : kind === 'c' ? categoryMeta(slug, origin) : null;
    if (meta) html = inject(html, meta);
    else if (kind === 'c' || (kind === 'l' && process.env.VITE_SUPABASE_URL)) status = 404;
  } catch {
    // falha ao consultar o banco: entrega o shell padrão, o SPA busca os dados no navegador
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  return res.status(status).send(html);
}
