-- Foto publicada não pode ser apagada ou sobrescrita pelo vendedor.
create unique index listing_images_path_unique on public.listing_images(listing_id,storage_path);
create or replace function public.can_write_listing_image(path text) returns boolean
language sql stable security definer set search_path=public as $$
 select split_part(path,'/',1)=auth.uid()::text and exists(
 select 1 from listings where id::text=split_part(path,'/',2) and seller_id=auth.uid() and status='draft')
$$;
revoke all on function public.can_write_listing_image(text) from public,anon;
grant execute on function public.can_write_listing_image(text) to authenticated;
create or replace function public.listing_images_limit() returns trigger language plpgsql security definer set search_path=public as $$
declare l public.listings;
begin
 select * into l from listings where id=new.listing_id for update;
 if l.status<>'draft' then raise exception 'LISTING_LOCKED'; end if;
 if auth.uid() is not null then
  if l.seller_id is distinct from auth.uid() or not can_write_listing_image(new.storage_path) or split_part(new.storage_path,'/',2)<>l.id::text then raise exception 'INVALID_IMAGE_PATH'; end if;
  if not exists(select 1 from storage.objects where bucket_id='listing-images' and name=new.storage_path) then raise exception 'IMAGE_NOT_UPLOADED'; end if;
 end if;
 if new.sort_order not between 0 and 9 then raise exception 'INVALID_IMAGE_POSITION'; end if;
 if (select count(*) from listing_images where listing_id=new.listing_id and storage_path<>new.storage_path)>=10 then raise exception 'MAX_IMAGES'; end if;
 return new;
end $$;
drop policy "own folder upload" on storage.objects;
drop policy "own folder delete" on storage.objects;
create policy "own folder upload" on storage.objects for insert to authenticated with check(
 (bucket_id='listing-images' and public.can_write_listing_image(name)) or
 (bucket_id in ('avatars','dispute-evidence') and (storage.foldername(name))[1]=auth.uid()::text));
create policy "own folder delete" on storage.objects for delete to authenticated using(
 (bucket_id='listing-images' and public.can_write_listing_image(name)) or
 (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text));
create policy "own draft image update" on storage.objects for update to authenticated
 using(bucket_id='listing-images' and public.can_write_listing_image(name))
 with check(bucket_id='listing-images' and public.can_write_listing_image(name));

-- Serializa upload/remoção com publicação; uma policy sozinha não resolve a corrida.
create function public.guard_listing_storage() returns trigger language plpgsql security definer set search_path=public as $$
declare path text; bucket text; l public.listings;
begin
 if tg_op='DELETE' then path:=old.name;bucket:=old.bucket_id; else path:=new.name;bucket:=new.bucket_id; end if;
 if bucket='listing-images' and auth.uid() is not null then
  select * into l from listings where id::text=split_part(path,'/',2) for update;
  if not found or l.seller_id is distinct from auth.uid() or l.status<>'draft' or split_part(path,'/',1)<>auth.uid()::text then raise exception 'LISTING_LOCKED'; end if;
  if tg_op='UPDATE' and (new.name is distinct from old.name or new.bucket_id is distinct from old.bucket_id) then raise exception 'INVALID_IMAGE_PATH'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
create trigger listing_storage_guard before insert or update or delete on storage.objects for each row execute function public.guard_listing_storage();
