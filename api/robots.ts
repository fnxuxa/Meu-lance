// Vercel serverless function: robots.txt com URL absoluta do sitemap (a especificação exige URL completa;
// "Sitemap: /sitemap.xml" relativo é ignorado pelos buscadores).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos do runtime Node da Vercel não estão instalados
export default function handler(req: any, res: any) {
  const origin = `https://${req.headers.host}`;
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /conta/',
    'Disallow: /pedido/',
    'Disallow: /admin',
    'Disallow: /vender/',
    'Disallow: /entrar',
    'Disallow: /cadastrar',
    'Disallow: /recuperar-senha',
    'Disallow: /buscar?q=',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).send(body);
}
