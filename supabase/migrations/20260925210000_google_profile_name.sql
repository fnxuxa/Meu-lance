-- Login social (Google): o provedor envia "name"/"full_name" em raw_user_meta_data, não "display_name".
-- Aditiva: só melhora a origem do nome ao criar o perfil; comportamento por e-mail/senha não muda.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare n text; f text;
begin
  f := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''));
  n := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), f, split_part(new.email, '@', 1));
  if n is null or char_length(n) < 2 then n := 'Usuário'; end if;
  insert into public.profiles(id, display_name, full_name, email_verified_at)
  values (new.id, left(n, 40), f, new.email_confirmed_at)
  on conflict (id) do nothing;
  insert into public.notification_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
