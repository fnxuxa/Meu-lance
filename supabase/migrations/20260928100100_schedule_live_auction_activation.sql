-- Ativa leilões ao vivo agendados quando a hora de início chega (rede de segurança: place_bid já
-- ativa na hora quando alguém dá o primeiro lance; isto cobre o caso de ninguém dar lance).
select cron.unschedule(jobid) from cron.job where jobname = 'activate-scheduled-listings';
select cron.schedule('activate-scheduled-listings', '* * * * *', $$select public.activate_scheduled_listings()$$);
