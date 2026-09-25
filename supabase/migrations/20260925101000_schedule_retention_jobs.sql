-- Agenda a limpeza (agora lendo a retenção configurável de app_config) e a nova limpeza de
-- notificações. Separado para que os testes locais sem pg_cron ignorem só este arquivo.
select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-expired-listings';
select cron.schedule('cleanup-expired-listings', '30 3 * * *', $$select public.cleanup_expired_listings()$$);

select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-notifications';
select cron.schedule('purge-old-notifications', '45 3 * * *', $$select public.purge_old_notifications()$$);
