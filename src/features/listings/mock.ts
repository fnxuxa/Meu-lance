import type { Listing } from '../../types/domain';
const imgs = (base: string) => [base, `${base}&sat=-8`, `${base}&con=8`, `${base}&bri=4`, `${base}&q=72`];
// endsAt é um getter: recalcula "agora + N horas" a cada leitura, então o
// anúncio de demonstração nunca fica com prazo expirado (antes era calculado
// uma única vez ao carregar o módulo e, passado o tempo, virava passado).
function withRollingDeadline(hours: number, listing: Omit<Listing, 'endsAt'>): Listing {
  return Object.defineProperty({ ...listing }, 'endsAt', {
    enumerable: true,
    get: () => new Date(Date.now() + hours * 3600000).toISOString(),
  }) as Listing;
}
export const listings: Listing[] = [
  withRollingDeadline(0.7, {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'iphone-14-128gb',
    title: 'iPhone 14 128GB impecável',
    category: 'Celulares',
    categorySlug: 'celulares',
    condition: 'Seminovo',
    city: 'São Paulo',
    state: 'SP',
    startPriceCents: 120000,
    currentPriceCents: 184500,
    bidCount: 18,
    participantCount: 7,
    image: 'https://images.unsplash.com/photo-1678652197831-2d180705cd2c?auto=format&fit=crop&w=1000&q=82',
    images: imgs(
      'https://images.unsplash.com/photo-1678652197831-2d180705cd2c?auto=format&fit=crop&w=1000&q=82',
    ),
    delivery: 'Ambos',
    description:
      'Aparelho muito bem conservado, funcionando normalmente. Confira todas as fotos antes de ofertar.',
    defects: 'Pequenas marcas de uso compatíveis com o tempo de uso.',
    featured: true,
  }),
];
