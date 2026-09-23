import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { absoluteUrl, useJsonLd } from '../lib/useDocumentMeta';

export type Crumb = { label: string; to?: string };

/** Trilha de navegação visível + BreadcrumbList para buscadores. O último item é a página atual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const key = JSON.stringify(items);
  const ld = useMemo(() => {
    const crumbs = JSON.parse(key) as Crumb[];
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        ...(c.to ? { item: absoluteUrl(c.to) } : {}),
      })),
    };
  }, [key]);
  useJsonLd('ld-breadcrumbs', ld);
  return (
    <nav className="breadcrumbs" aria-label="Você está em">
      <ol>
        {items.map((c, i) => (
          <li key={c.label + i}>
            {c.to && i < items.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
            {i < items.length - 1 && <ChevronRight size={13} aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
