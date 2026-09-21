-- Agenda o fechamento de leilões a cada minuto com pg_cron (Supabase: Database → Extensions → pg_cron).
-- Alternativa: chamar a Edge Function `close-auctions` com Authorization: Bearer $CRON_SECRET.
select cron.schedule('close-auctions', '* * * * *', $$select public.close_due_auctions()$$);
