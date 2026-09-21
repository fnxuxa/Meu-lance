-- MeuLance: colunas extras de proxy_bids.
-- As funções set_proxy_bid / close_due_auctions e o bootstrap de admin foram movidos para:
--   20260921141000_auction_engine.sql   (motor de leilão)
--   supabase/scripts/promote-admin.sql  (promoção de admin, manual e fora do frontend)
alter table public.proxy_bids
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();
alter table public.proxy_bids
  add constraint proxy_bids_max_positive check (max_amount_cents > 0);
