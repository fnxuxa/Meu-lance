import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Star, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { TrustBadges } from '../../components/TrustBadges';
import { ListingCard } from '../../components/ListingCard';
import { BackButton } from '../../components/BackButton';
import { mapListing } from './useListings';
type ReviewRow = { id: string; rating: number; comment: string | null; created_at: string; author_id: string };
export function SellerProfile() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['seller-profile', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const [{ data: profile, error: pe }, { data: listingRows, error: le }, { data: reviewRows, error: re }] =
        await Promise.all([
          supabase!
            .from('public_profiles')
            .select(
              'id,display_name,city,state,avatar_url,created_at,email_verified,phone_verified,identity_verified,completed_sales,rating_avg,rating_count,active_listings',
            )
            .eq('id', id!)
            .maybeSingle(),
          supabase!
            .from('listings')
            .select(
              'id,slug,seller_id,title,condition,city,state,current_price_cents,start_price_cents,ends_at,bid_count,status,delivery_mode,description,defects_declared,categories(name),listing_images(storage_path,sort_order)',
            )
            .eq('seller_id', id!)
            .eq('status', 'active')
            .order('ends_at'),
          supabase!
            .from('reviews')
            .select('id,rating,comment,created_at,author_id')
            .eq('subject_id', id!)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);
      if (pe || le || re) throw pe ?? le ?? re;
      if (!profile) return null;
      const authorIds = [...new Set((reviewRows as ReviewRow[]).map((r) => r.author_id))];
      const authors = authorIds.length
        ? await supabase!.from('public_profiles').select('id,display_name,avatar_url').in('id', authorIds)
        : { data: [], error: null };
      if (authors.error) throw authors.error;
      const authorMap = new Map(authors.data!.map((a) => [a.id, a]));
      return {
        profile,
        listings: (listingRows as unknown as Parameters<typeof mapListing>[0][]).map(mapListing),
        reviews: (reviewRows as ReviewRow[]).map((r) => ({ ...r, author: authorMap.get(r.author_id) })),
      };
    },
  });
  useDocumentMeta({
    title: query.data?.profile.display_name ?? 'Vendedor',
    noindex: true,
  });
  if (query.isPending)
    return (
      <main className="page simple">
        <p>Carregando perfil…</p>
      </main>
    );
  if (query.error || !query.data)
    return (
      <main className="page simple">
        <BackButton />
        <h1>Vendedor não encontrado</h1>
        {query.error && <p>{errorMessage(query.error)}</p>}
      </main>
    );
  const { profile, listings, reviews } = query.data;
  return (
    <main className="page simple seller-profile">
      <BackButton />
      <div className="seller-header">
        <span className="seller-avatar">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <User size={26} />}
        </span>
        <div>
          <h1>{profile.display_name}</h1>
          <div className="seller-meta">
            {(profile.city || profile.state) && (
              <span>
                <MapPin size={13} />
                {profile.city}
                {profile.city && profile.state ? ', ' : ''}
                {profile.state}
              </span>
            )}
            <span>
              <CalendarDays size={13} />
              Desde {new Date(profile.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}
            </span>
            <span>{profile.completed_sales} vendas concluídas</span>
          </div>
          <TrustBadges seller={profile} />
        </div>
      </div>
      <section className="section" style={{ padding: '32px 0 0' }}>
        <h2>Anúncios ativos</h2>
        {!listings.length ? (
          <p className="muted">Nenhum anúncio ativo no momento.</p>
        ) : (
          <div className="grid">
            {listings.map((l) => (
              <ListingCard key={l.id} item={l} />
            ))}
          </div>
        )}
      </section>
      <section className="section" style={{ padding: '32px 0' }}>
        <h2>Avaliações de quem já comprou</h2>
        {!reviews.length ? (
          <p className="muted">Ainda não há avaliações.</p>
        ) : (
          <div className="review-list">
            {reviews.map((r) => (
              <article className="review-card" key={r.id}>
                <div className="review-card-head">
                  <span className="account-avatar-mini">
                    {r.author?.avatar_url ? <img src={r.author.avatar_url} alt="" /> : <User size={14} />}
                  </span>
                  <b>{r.author?.display_name ?? 'Usuário'}</b>
                  <span className="review-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} fill={n <= r.rating ? 'currentColor' : 'none'} />
                    ))}
                  </span>
                  <span className="muted review-date">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
