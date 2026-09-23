import { useEffect } from 'react';

type MetaInput = {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  /** URL absoluta ou caminho do site; padrão é a arte de divulgação. */
  image?: string;
  type?: 'website' | 'product' | 'article';
};

const SITE = 'MeuLance';
const DEFAULT_DESCRIPTION =
  'Compre e venda usados em leilões online no Brasil, com histórico de lances transparente.';
export const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://meulance.app';
const DEFAULT_IMAGE = '/landing.png';

export const absoluteUrl = (pathOrUrl: string) =>
  /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : ORIGIN + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl;

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta({
  title,
  description,
  canonicalPath,
  noindex,
  image,
  type = 'website',
}: MetaInput) {
  useEffect(() => {
    const fullTitle = title === SITE ? title : `${title} · ${SITE}`;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const img = absoluteUrl(image ?? DEFAULT_IMAGE);
    const canonical = ORIGIN + (canonicalPath ?? window.location.pathname);
    document.title = fullTitle;
    setMeta('description', desc);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('og:site_name', SITE, 'property');
    setMeta('og:locale', 'pt_BR', 'property');
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', desc, 'property');
    setMeta('og:type', type, 'property');
    setMeta('og:image', img, 'property');
    setMeta('og:url', canonical, 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);
    setLink('canonical', canonical);
  }, [title, description, canonicalPath, noindex, image, type]);
}

export function setJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

/** JSON-LD enquanto o componente estiver montado. `data` deve ser estável (useMemo) ou nulo. */
export function useJsonLd(id: string, data: unknown) {
  useEffect(() => {
    if (!data) return;
    setJsonLd(id, data);
    return () => removeJsonLd(id);
  }, [id, data]);
}
