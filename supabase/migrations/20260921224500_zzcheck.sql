do $$
declare r record;
begin
  for r in select jobname, schedule, active from cron.job order by jobname loop
    raise notice 'CRONJOB % | % | active=%', r.jobname, r.schedule, r.active;
  end loop;
end $$
