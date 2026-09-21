-- Habilita pg_cron e agenda os jobs recorrentes do motor de leilão.
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'close-auctions';
select cron.schedule('close-auctions', '* * * * *', $$select public.close_due_auctions()$$);

select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-expired-listings';
select cron.schedule('cleanup-expired-listings', '30 3 * * *', $$select public.cleanup_expired_listings(10)$$);
