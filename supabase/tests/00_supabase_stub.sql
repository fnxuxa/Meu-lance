-- Simula o mínimo do Supabase para testar migrations em Postgres puro (CI e local).
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase concede tudo por padrão nas tabelas novas; as migrations restringem depois.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
