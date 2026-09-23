-- Agenda os jobs de pedidos (separado para que os testes locais sem pg_cron ignorem só este arquivo).
select cron.unschedule(jobid) from cron.job where jobname = 'expire-unpaid-orders';
select cron.schedule('expire-unpaid-orders', '*/5 * * * *', $$select public.expire_unpaid_orders()$$);

select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-imeis';
select cron.schedule('purge-expired-imeis', '15 3 * * *', $$select public.purge_expired_imeis()$$);
