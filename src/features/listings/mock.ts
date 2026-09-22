import type { Listing } from '../../types/domain';
const end = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const imgs = (base: string) => [base, `${base}&sat=-8`, `${base}&con=8`, `${base}&bri=4`, `${base}&q=72`];
export const listings: Listing[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'iphone-14-128gb',
    title: 'iPhone 14 128GB impecável',
    category: 'Celulares',
    condition: 'Seminovo',
    city: 'São Paulo',
    state: 'SP',
    startPriceCents: 120000,
    currentPriceCents: 184500,
    endsAt: end(0.7),
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
  },
];
