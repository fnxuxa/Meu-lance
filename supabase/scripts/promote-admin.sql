-- Promove um usuário a admin. Rode DEPOIS que a conta existir em auth.users (cadastro normal pelo app).
-- Uso: psql "$DATABASE_URL" -v admin_email='voce@dominio.com' -f supabase/scripts/promote-admin.sql
-- Nunca faça essa checagem por e-mail no frontend: a permissão vive só em profiles.role (validada por RLS/RPC).
update public.profiles set role = 'admin'
 where id = (select id from auth.users where lower(email) = lower(:'admin_email'))
returning id, display_name, role;
