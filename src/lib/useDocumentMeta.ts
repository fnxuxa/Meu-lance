import { useEffect } from 'react';

type MetaInput = {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
};

const SITE = 'MeuLance';
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://meulance.app';

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

export function useDocumentMeta({ title, description, canonicalPath, noindex }: MetaInput) {
  useEffect(() => {
    const fullTitle = title === SITE ? title : `${title} · ${SITE}`;
    document.title = fullTitle;
    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, 'property');
    }
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    const canonical = ORIGIN + (canonicalPath ?? window.location.pathname);
    setLink('canonical', canonical);
    setMeta('og:url', canonical, 'property');
  }, [title, description, canonicalPath, noindex]);
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
