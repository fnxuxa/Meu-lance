-- MeuLance: criação segura de rascunho e preferências.
create or replace function public.create_listing_draft(
  p_title text,p_description text,p_condition text,p_defects text,p_start_price_cents bigint,
  p_delivery_mode public.delivery_mode,p_city text,p_state text,p_category uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lid uuid; base_slug text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(p_title)) < 8 or char_length(trim(p_title)) > 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(trim(p_description)) < 20 then raise exception 'INVALID_DESCRIPTION'; end if;
  if p_start_price_cents < 5000 or p_start_price_cents > 20000000 then raise exception 'INVALID_START_PRICE'; end if;
  if char_length(trim(p_city)) < 2 or char_length(trim(p_state)) <> 2 then raise exception 'INVALID_LOCATION'; end if;
  base_slug:=lower(regexp_replace(unaccent(trim(p_title)),'[^a-zA-Z0-9]+','-','g'));
  base_slug:=trim(both '-' from base_slug)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  insert into public.listings(seller_id,category_id,title,description,condition,defects_declared,start_price_cents,current_price_cents,status,delivery_mode,city,state,slug)
  values(uid,p_category,trim(p_title),trim(p_description),p_condition,nullif(trim(p_defects),''),p_start_price_cents,p_start_price_cents,'draft',p_delivery_mode,trim(p_city),upper(trim(p_state)),base_slug)
  returning id into lid;
  return lid;
end $$;
revoke all on function public.create_listing_draft(text,text,text,text,bigint,public.delivery_mode,text,text,uuid) from public,anon;
grant execute on function public.create_listing_draft(text,text,text,text,bigint,public.delivery_mode,text,text,uuid) to authenticated;

drop policy if exists "prefs own insert" on public.notification_preferences;
create policy "prefs own insert" on public.notification_preferences for insert to authenticated with check(auth.uid()=user_id);
