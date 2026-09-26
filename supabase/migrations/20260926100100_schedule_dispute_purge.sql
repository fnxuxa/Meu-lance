-- Agenda o apagamento de imagens e mensagens de disputas resolvidas há mais de 30 dias.
-- Separado para que os testes locais sem pg_cron ignorem só este arquivo.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-resolved-disputes';
select cron.schedule('purge-resolved-disputes', '0 4 * * *', $$select public.purge_resolved_disputes()$$);
