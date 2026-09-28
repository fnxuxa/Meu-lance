import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Share2, Star, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { TrustBadges } from '../../components/TrustBadges';
import { ListingCard } from '../../components/ListingCard';
import { BackButton } from '../../components/BackButton';
import { mapListing } from './useListings';
import NotFound from '../../app/pages/NotFound';

const LISTING_SELECTION =
  'id,slug,seller_id,title,condition,city,state,current_price_cents,start_price_cents,starts_at,ends_at,bid_count,status,delivery_mode,description,defects_declared,condition_checklist,second_chance_enabled,sale_type,auction_mode,live_duration_minutes,promo_price_cents,stock_qty,stock_sold,categories(name,slug),listing_images(storage_path,sort_order,is_defect)';

export function StorePage() {
  const { slug } = useParams();
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ['store', slug],
    enabled: !!supabase && !!slug,
    queryFn: async () => {
      const { data: profile, error: pe } = await supabase!
        .from('public_profiles')
        .select(
          'id,display_name,city,state,avatar_url,created_at,email_verified,phone_verified,identity_verified,completed_sales,rating_avg,rating_count,store_slug',
        )
        .eq('store_slug', slug!)
        .maybeSingle();
      if (pe) throw pe;
      if (!profile) return null;
      const { data: listingRows, error: le } = await supabase!
        .from('listings')
        .select(LISTING_SELECTION)
        .eq('seller_id', profile.id)
        .in('status', ['active', 'scheduled', 'ended_no_bids', 'ended_with_winner'])
        .is('paused_at', null)
        .order('created_at', { ascending: false });
      if (le) throw le;
      const all = (listingRows as unknown as Parameters<typeof mapListing>[0][]).map(mapListing);
      return {
        profile,
        active: all.filter((l) => l.status === 'active' || l.status === 'scheduled'),
        ended: all.filter((l) => l.status === 'ended_no_bids' || l.status === 'ended_with_winner'),
      };
    },
  });
  useDocumentMeta({
    title: query.data?.profile.display_name ? `Loja de ${query.data.profile.display_name}` : 'Loja',
    description: query.data
      ? `Confira os anúncios de ${query.data.profile.display_name} no MeuLance.`
      : undefined,
    canonicalPath: slug ? `/loja/${slug}` : undefined,
    noindex: !query.data,
  });
  if (query.isPending)
    return (
      <main className="page simple">
        <p>Carregando loja…</p>
      </main>
    );
  if (query.error)
    return (
      <main className="page simple">
        <BackButton />
        <h1>Não foi possível carregar esta loja</h1>
        <p>{errorMessage(query.error)}</p>
      </main>
    );
  if (!query.data) return <NotFound />;
  const { profile, active, ended } = query.data;
  const storeUrl = typeof window !== 'undefined' ? window.location.href : '';
  return (
    <main className="page simple seller-profile">
      <BackButton />
      <div className="seller-header">
        <span className="seller-avatar">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <User size={26} />}
        </span>
        <div>
          <h1>Loja de {profile.display_name}</h1>
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
              <Star size={13} />
              {profile.rating_count
                ? `${profile.rating_avg} (${profile.rating_count})`
                : 'Sem avaliações ainda'}
            </span>
            <span>{profile.completed_sales} vendas concluídas</span>
          </div>
          <TrustBadges seller={profile} />
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            try {
              if (navigator.share)
                await navigator.share({ title: `Loja de ${profile.display_name}`, url: storeUrl });
              else {
                await navigator.clipboard.writeText(storeUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            } catch {
              /* usuário cancelou o compartilhamento */
            }
          }}
        >
          <Share2 size={15} /> {copied ? 'Link copiado!' : 'Compartilhar'}
        </button>
      </div>
      <section className="section" style={{ padding: '32px 0 0' }}>
        <h2>Anúncios ativos ({active.length})</h2>
        {!active.length ? (
          <p className="muted">Nenhum anúncio ativo no momento.</p>
        ) : (
          <div className="grid">
            {active.map((l) => (
              <ListingCard key={l.id} item={l} />
            ))}
          </div>
        )}
      </section>
      {ended.length > 0 && (
        <section className="section" style={{ padding: '32px 0' }}>
          <h2>Encerrados</h2>
          <div className="grid">
            {ended.slice(0, 12).map((l) => (
              <ListingCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
