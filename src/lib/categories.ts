import type { LucideIcon } from 'lucide-react';
import { Dumbbell, Gamepad2, Gem, Guitar, Hammer, Home, Smartphone, Tv } from 'lucide-react';

/**
 * Espelha o seed de `public.categories` (migration 20260921223000_seed_categories.sql).
 * Serve para navegação e SEO (/c/:slug); o banco continua sendo a fonte de verdade da categoria de cada anúncio.
 */
export type CategoryInfo = { slug: string; name: string; Icon: LucideIcon; blurb: string };

export const CATEGORIES: readonly CategoryInfo[] = [
  { slug: 'celulares', name: 'Celulares', Icon: Smartphone, blurb: 'iPhone, Samsung, Motorola e mais.' },
  { slug: 'pc-games', name: 'PC & Games', Icon: Gamepad2, blurb: 'Consoles, jogos, placas e periféricos.' },
  { slug: 'eletronicos', name: 'Eletrônicos', Icon: Tv, blurb: 'TVs, monitores, áudio e câmeras.' },
  { slug: 'casa', name: 'Casa', Icon: Home, blurb: 'Móveis, eletrodomésticos e decoração.' },
  { slug: 'ferramentas', name: 'Ferramentas', Icon: Hammer, blurb: 'Elétricas, manuais e oficina.' },
  { slug: 'esportes', name: 'Esportes', Icon: Dumbbell, blurb: 'Bicicletas, fitness e aventura.' },
  { slug: 'instrumentos', name: 'Instrumentos', Icon: Guitar, blurb: 'Violões, teclados e equipamentos.' },
  { slug: 'colecionaveis', name: 'Colecionáveis', Icon: Gem, blurb: 'Cards, miniaturas e raridades.' },
];

export const categoryBySlug = (slug?: string) => CATEGORIES.find((c) => c.slug === slug);
