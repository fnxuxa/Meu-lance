-- public_profiles e public_bids são SECURITY DEFINER de propósito: expõem só colunas
-- seguras/mascaradas de tabelas (profiles, bids) que o RLS não deixa ler direto.
-- Como definer ignora o RLS de quem consulta, a view precisa ser estritamente somente leitura:
-- public_profiles é uma view de tabela única (auto-atualizável), então INSERT/UPDATE/DELETE
-- via view poderiam contornar o RLS se os privilégios padrão do Supabase estiverem ativos.
revoke all on public.public_profiles from public, anon, authenticated;
revoke all on public.public_bids from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
grant select on public.public_bids to anon, authenticated;
