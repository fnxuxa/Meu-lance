-- MeuLance: buscas salvas com alerta quando um leilão compatível começa (publicação ou relançamento).
create or replace function public._fold(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;

create table public.saved_searches(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text check (query is null or char_length(query) between 2 and 100),
  category_id uuid references public.categories(id) on delete cascade,
  condition text check (condition is null or condition in ('new','like_new','good','fair','for_parts')),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  max_price_cents bigint check (max_price_cents is null or max_price_cents between 100 and 20000000),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (query is not null or category_id is not null)
);
create unique index saved_searches_unique on public.saved_searches(
  user_id, coalesce(query, ''), coalesce(category_id::text, ''), coalesce(condition, ''), coalesce(state, ''), coalesce(max_price_cents, 0));
create index saved_searches_category_idx on public.saved_searches(category_id);
alter table public.saved_searches enable row level security;
create policy "saved searches own read" on public.saved_searches for select to authenticated using (auth.uid() = user_id);
create policy "saved searches own insert" on public.saved_searches for insert to authenticated with check (auth.uid() = user_id);
create policy "saved searches own delete" on public.saved_searches for delete to authenticated using (auth.uid() = user_id);
revoke all on public.saved_searches from anon;
revoke insert, update, delete on public.saved_searches from authenticated;
grant insert (user_id, query, category_id, condition, state, max_price_cents), delete on public.saved_searches to authenticated;

create or replace function public._saved_search_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.query := nullif(trim(regexp_replace(coalesce(new.query, ''), '\s+', ' ', 'g')), '');
  new.state := nullif(upper(trim(coalesce(new.state, ''))), '');
  new.last_notified_at := null;
  perform pg_advisory_xact_lock(hashtextextended('saved_search:' || new.user_id::text, 0));
  if (select count(*) from public.saved_searches where user_id = new.user_id) >= 10 then raise exception 'SAVED_SEARCH_LIMIT'; end if;
  return new;
end $$;
create trigger saved_search_guard before insert on public.saved_searches for each row execute function public._saved_search_before_insert();

-- Um alerta por usuário por leilão, mesmo que várias buscas dele combinem.
create or replace function public._notify_saved_searches() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then return new; end if;
  for s in
    select distinct on (ss.user_id) ss.id, ss.user_id
      from public.saved_searches ss
      join public.profiles p on p.id = ss.user_id and p.banned_at is null
     where ss.user_id <> new.seller_id
       and (ss.category_id is null or ss.category_id = new.category_id)
       and (ss.condition is null or ss.condition = new.condition)
       and (ss.state is null or ss.state = new.state)
       and (ss.max_price_cents is null or new.start_price_cents <= ss.max_price_cents)
       and (ss.query is null
            or new.search_vec @@ websearch_to_tsquery('portuguese', ss.query)
            or public._fold(new.title) like '%' || public._fold(ss.query) || '%')
     order by ss.user_id, ss.created_at
     limit 1000
  loop
    perform public._notify(s.user_id, 'system', 'Novo leilão na sua busca salva',
      '"' || new.title || '" acabou de entrar em leilão.', '/l/' || new.slug);
    update public.saved_searches set last_notified_at = now() where id = s.id;
  end loop;
  return new;
end $$;
create trigger listings_saved_search_alert after insert or update of status on public.listings
  for each row execute function public._notify_saved_searches();
revoke all on function public._saved_search_before_insert(), public._notify_saved_searches() from public, anon, authenticated;
