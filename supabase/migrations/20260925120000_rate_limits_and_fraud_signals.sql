-- Antifraude e rate limit (AGENTS.md §8). O que já existia: lance manual e proxy limitados a
-- 30/min por usuário (review_bidding.sql), perguntas 5/10min (hardening.sql). Faltava tudo o
-- resto: denúncia, chat, IP do lance e a tabela fraud_signals (citada no AGENTS.md, nunca criada).
--
-- Fora do escopo desta migration, de propósito (não dá pra fazer só no banco):
--  * Verificação de telefone por OTP e CPF único: precisa de provedor de SMS (custo, decisão de
--    produto) — AGENTS.md §15 já lista como decisão em aberto.
--  * Rate limit de cadastro/login: fica a cargo do Supabase Auth (rate limit e captcha
--    configuráveis no painel do projeto), o Postgres não vê essas chamadas.
--  * device_id: exigiria mudar a assinatura de place_bid/set_proxy_bid (função central, muito
--    testada) e o client para gerar/enviar um fingerprint. Fica para uma próxima rodada.

-- ───────── IP do request (best-effort; nunca quebra se o header não vier) ─────────
create or replace function public._client_ip() returns text language sql stable as $$
  select nullif(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '')
$$;
create or replace function public._ip_hash() returns text language sql stable as $$
  select case when public._client_ip() is null then null
    else encode(digest(public._client_ip() || '|meulance-rate-limit-salt', 'sha256'), 'hex') end
$$;
revoke all on function public._client_ip(), public._ip_hash() from public, anon;
grant execute on function public._client_ip(), public._ip_hash() to authenticated;

-- ───────── IP mascarado no lance (só hash, nunca o IP em texto) ─────────
alter table public.bids add column if not exists ip_hash text;
create or replace function public._stamp_bid_ip() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.ip_hash := public._ip_hash();
  return new;
end $$;
create trigger bids_stamp_ip before insert on public.bids for each row execute function public._stamp_bid_ip();

-- ───────── fraud_signals: sinal de possível lance falso (shill bidding) ─────────
create table public.fraud_signals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null,
  score int not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.fraud_signals enable row level security;
create index fraud_signals_user_idx on public.fraud_signals(user_id, created_at desc);
create policy "staff read fraud signals" on public.fraud_signals for select using (public.is_staff());
revoke insert, update, delete on public.fraud_signals from anon, authenticated;

-- Heurística v1: o mesmo IP dá lance em anúncios do MESMO vendedor a partir de contas
-- diferentes — não prova fraude sozinho, mas é o padrão que o AGENTS.md pede para vigiar
-- ("as mesmas contas sempre dão lance nos mesmos vendedores").
create or replace function public._detect_shill_signal() returns trigger language plpgsql security definer set search_path = public as $$
declare seller uuid; r record;
begin
  if new.ip_hash is null then return new; end if;
  select seller_id into seller from public.listings where id = new.listing_id;
  if seller is null or seller = new.bidder_id then return new; end if;
  for r in
    select b.bidder_id as other_bidder
      from public.bids b join public.listings l on l.id = b.listing_id
     where l.seller_id = seller and b.ip_hash = new.ip_hash and b.bidder_id <> new.bidder_id
     group by b.bidder_id
  loop
    if not exists (
      select 1 from public.fraud_signals
       where kind = 'same_ip_bids_on_seller' and user_id = new.bidder_id
         and data->>'seller_id' = seller::text and data->>'other_bidder' = r.other_bidder::text
         and created_at > now() - interval '1 day'
    ) then
      insert into public.fraud_signals(user_id, kind, score, data) values
        (new.bidder_id, 'same_ip_bids_on_seller', 3,
         jsonb_build_object('seller_id', seller, 'other_bidder', r.other_bidder, 'listing_id', new.listing_id));
    end if;
  end loop;
  return new;
end $$;
create trigger bids_detect_shill after insert on public.bids for each row execute function public._detect_shill_signal();

-- ───────── rate limit: denúncia (10/hora) e chat do pedido (30/min, mesmo teto do lance) ─────────
create or replace function public._rate_limit_reports() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;
create trigger reports_rate_limit before insert on public.reports for each row execute function public._rate_limit_reports();

create or replace function public._rate_limit_order_messages() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.order_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;
create trigger order_messages_rate_limit before insert on public.order_messages for each row execute function public._rate_limit_order_messages();
