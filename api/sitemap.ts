// Vercel serverless function: gera o sitemap.xml dinamicamente a partir dos leilões ativos.
// Não faz parte do bundle Vite (fora de src/), roda em Node no servidor.
export default async function handler(req: any, res: any) {
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const origin = `https://${req.headers.host}`;
  const staticPaths = [
    '/',
    '/buscar',
    '/como-funciona',
    '/termos',
    '/privacidade',
    '/regras-de-leilao',
    '/itens-proibidos',
    '/ajuda',
  ];
  let listings: { slug: string; created_at: string }[] = [];
  if (base && key) {
    try {
      const r = await fetch(
        `${base}/rest/v1/listings?select=slug,created_at&status=eq.active&order=created_at.desc&limit=2000`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (r.ok) listings = await r.json();
    } catch {
      listings = [];
    }
  }
  const escape = (s: string) => s.replace(/&/g, '&amp;');
  const urls = [
    ...staticPaths.map((p) => `<url><loc>${escape(origin + p)}</loc><changefreq>daily</changefreq></url>`),
    ...listings.map(
      (l) =>
        `<url><loc>${escape(`${origin}/l/${l.slug}`)}</loc><lastmod>${new Date(l.created_at).toISOString()}</lastmod><changefreq>hourly</changefreq></url>`,
    ),
  ];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res
    .status(200)
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    );
}
