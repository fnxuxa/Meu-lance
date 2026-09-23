-- MeuLance: sugestão de valor inicial a partir de vendas anteriores e relançamento com 1 clique.

-- Amostras de preço final. Tabela própria porque a limpeza automática apaga anúncios encerrados;
-- guarda só categoria, estado, vetor de busca do título e valor (sem vendedor/comprador).
create table public.sale_price_samples(
  id bigint generated always as identity primary key,
  order_id uuid unique not null,
  category_id uuid references public.categories(id) on delete set null,
  condition text not null,
  title_vec tsvector not null,
  final_price_cents bigint not null check (final_price_cents > 0),
  closed_at timestamptz not null default now()
);
alter table public.sale_price_samples enable row level security;
revoke all on public.sale_price_samples from anon, authenticated;
create index sale_price_samples_category_idx on public.sale_price_samples(category_id, closed_at desc);
create index sale_price_samples_title_idx on public.sale_price_samples using gin(title_vec);

create or replace function public._record_sale_sample() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.sale_price_samples(order_id, category_id, condition, title_vec, final_price_cents)
      select new.id, l.category_id, l.condition, l.search_vec, new.amount_cents from public.listings l where l.id = new.listing_id
      on conflict (order_id) do nothing;
  elsif new.status in ('payment_expired', 'cancelled') and old.status is distinct from new.status then
    -- venda que não se concretizou não serve de referência de preço
    delete from public.sale_price_samples where order_id = new.id;
  end if;
  return new;
end $$;
create trigger orders_sale_sample after insert or update of status on public.orders
  for each row execute function public._record_sale_sample();
revoke all on function public._record_sale_sample() from public, anon, authenticated;

-- Retorna estatísticas das vendas parecidas (título) ou, se poucas, da categoria.
-- Sugestão = metade da mediana, arredondada para baixo a R$ 5 e nunca abaixo de R$ 50:
-- valor inicial baixo atrai os primeiros lances e o leilão sobe até o preço de mercado.
create or replace function public.suggest_start_price(p_category uuid, p_title text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q tsquery; basis text; prices bigint[]; med numeric; lo numeric; hi numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_category is null then return null; end if;
  if p_title is not null and char_length(p_title) <= 200 then
    q := nullif(replace(plainto_tsquery('portuguese', p_title)::text, ' & ', ' | '), '')::tsquery;
  end if;
  if q is not null then
    select array_agg(final_price_cents) into prices from (
      select final_price_cents from public.sale_price_samples
       where category_id = p_category and closed_at > now() - interval '365 days' and title_vec @@ q
       order by ts_rank_cd(title_vec, q) desc, closed_at desc limit 20) s;
    basis := 'similar';
  end if;
  if coalesce(array_length(prices, 1), 0) < 3 then
    select array_agg(final_price_cents) into prices from (
      select final_price_cents from public.sale_price_samples
       where category_id = p_category and closed_at > now() - interval '365 days'
       order by closed_at desc limit 50) s;
    basis := 'category';
  end if;
  if coalesce(array_length(prices, 1), 0) < 3 then return null; end if;
  select percentile_cont(0.5) within group (order by p), percentile_cont(0.25) within group (order by p),
         percentile_cont(0.75) within group (order by p)
    into med, lo, hi from unnest(prices) p;
  return jsonb_build_object(
    'basis', basis, 'sample', array_length(prices, 1),
    'median_cents', round(med)::bigint, 'low_cents', round(lo)::bigint, 'high_cents', round(hi)::bigint,
    'suggested_start_cents', greatest(5000, floor(med / 2 / 500) * 500)::bigint);
end $$;
revoke all on function public.suggest_start_price(uuid, text) from public, anon;
grant execute on function public.suggest_start_price(uuid, text) to authenticated;

-- Relançar: reabre o mesmo anúncio (mesmas fotos, textos e checklist) quando terminou sem lances.
-- Só o valor inicial e a duração mudam. Anúncio com lance nunca é relançado.
create or replace function public.relist_listing(p_listing uuid, p_start_price_cents bigint, p_duration_days int)
returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings; uid uuid := auth.uid(); ends timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from uid then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.profiles where id = uid and identity_verified_at is not null) then raise exception 'IDENTITY_NOT_VERIFIED'; end if;
  if l.status <> 'ended_no_bids' or l.bid_count <> 0 then raise exception 'NOT_RELISTABLE'; end if;
  if p_start_price_cents is null or p_start_price_cents not between 5000 and 20000000 then raise exception 'INVALID_START_PRICE'; end if;
  if p_duration_days is null or p_duration_days not in (3,5,7,10) then raise exception 'INVALID_DURATION'; end if;
  ends := clock_timestamp() + make_interval(days => p_duration_days);
  update public.listings
     set status = 'active', start_price_cents = p_start_price_cents, current_price_cents = p_start_price_cents,
         starts_at = clock_timestamp(), ends_at = ends, original_ends_at = ends, duration_days = p_duration_days,
         extensions_count = 0
   where id = l.id returning * into l;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (uid, 'listing_relisted', 'listing', l.id::text, jsonb_build_object('start_price_cents', p_start_price_cents, 'duration_days', p_duration_days));
  return l;
end $$;
revoke all on function public.relist_listing(uuid, bigint, int) from public, anon;
grant execute on function public.relist_listing(uuid, bigint, int) to authenticated;
