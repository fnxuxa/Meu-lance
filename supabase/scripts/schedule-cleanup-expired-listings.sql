-- Agenda a limpeza de leilões concluídos há mais de 10 dias, 1x por dia às 03:30 UTC.
-- Supabase: Database → Extensions → pg_cron (mesmo mecanismo de schedule-close-auctions.sql).
select cron.schedule('cleanup-expired-listings', '30 3 * * *', $$select public.cleanup_expired_listings(10)$$);
