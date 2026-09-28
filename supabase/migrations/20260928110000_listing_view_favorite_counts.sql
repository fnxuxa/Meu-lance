-- Estatísticas simples de engajamento do anúncio: visualizações (coluna já existente,
-- listings.view_count) e contagem pública de favoritos (watchlist), sem expor quem favoritou.

create or replace function public.register_listing_view(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.listings set view_count = view_count + 1
  where id = p_listing and status in ('active','scheduled');
end;
$$;
grant execute on function public.register_listing_view(uuid) to anon, authenticated;

create or replace function public.get_listing_favorite_count(p_listing uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.watchlist where listing_id = p_listing;
$$;
grant execute on function public.get_listing_favorite_count(uuid) to anon, authenticated;

-- versão em lote, usada pelo painel do vendedor (Minha Loja) para não fazer 1 chamada por anúncio.
create or replace function public.get_favorite_counts(p_listing_ids uuid[]) returns table(listing_id uuid, cnt integer)
language sql stable security definer set search_path = public as $$
  select w.listing_id, count(*)::int
  from public.watchlist w
  where w.listing_id = any(p_listing_ids)
  group by w.listing_id;
$$;
grant execute on function public.get_favorite_counts(uuid[]) to authenticated;
