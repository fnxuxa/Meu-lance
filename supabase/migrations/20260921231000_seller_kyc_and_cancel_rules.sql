-- 1) Regra de cancelamento de leilão pelo vendedor:
--    - pode cancelar se ninguém deu lance ainda, OU
--    - pode cancelar se já tem lance mas falta mais de 1 dia pro fim,
--    - NÃO pode cancelar com lance e faltando <= 1 dia (avisa quem já apostou).
create or replace function public.cancel_listing(p_listing uuid) returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; b record;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if l.status not in ('draft', 'active') then raise exception 'NOT_CANCELLABLE'; end if;
  if l.bid_count > 0 and l.status = 'active' and l.ends_at - now() <= interval '1 day' then
    raise exception 'TOO_CLOSE_TO_END';
  end if;
  update public.listings set status = 'cancelled' where id = l.id;
  if l.bid_count > 0 then
    for b in select distinct bidder_id from public.bids where listing_id = l.id loop
      perform public._notify(
        b.bidder_id, 'system', 'Leilão cancelado pelo vendedor',
        'O vendedor cancelou "' || l.title || '" antes do fim. Nenhuma cobrança será feita.',
        '/l/' || l.slug
      );
    end loop;
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'listing_cancelled', 'listing', l.id::text);
end $$;

-- 2) Verificação de identidade do vendedor (RG + selfie), revisão manual por staff.
--    identity_verified_at/seller_status já existiam em profiles (hardening.sql) mas nunca
--    tinham um fluxo de entrada — este é ele.
create table public.identity_verifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_path text not null,
  selfie_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table public.identity_verifications enable row level security;
create index identity_verifications_user_idx on public.identity_verifications(user_id);
create index identity_verifications_pending_idx on public.identity_verifications(status) where status = 'pending';

create policy "own verification read" on public.identity_verifications
  for select using (auth.uid() = user_id or public.is_staff());
create policy "own verification insert" on public.identity_verifications
  for insert to authenticated with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.identity_verifications iv
      where iv.user_id = auth.uid() and iv.status = 'pending'
    )
  );
revoke insert, update, delete on public.identity_verifications from anon, authenticated;
grant insert (user_id, document_path, selfie_path) on public.identity_verifications to authenticated;

create or replace function public.review_identity_verification(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.identity_verifications;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into v from public.identity_verifications where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  update public.identity_verifications
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = case when p_approve then null else p_reason end
    where id = p_id;
  if p_approve then
    update public.profiles set identity_verified_at = now(), seller_status = 'verified' where id = v.user_id;
  end if;
  perform public._notify(
    v.user_id, 'system',
    case when p_approve then 'Identidade verificada' else 'Verificação de identidade recusada' end,
    case when p_approve then 'Sua identidade foi verificada. Agora você pode publicar leilões.'
         else 'Não foi possível verificar seus documentos. ' || coalesce(p_reason, 'Tente novamente com fotos mais nítidas.') end,
    '/conta/verificacao'
  );
  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'identity_verification_reviewed', 'identity_verification', p_id::text,
            jsonb_build_object('approved', p_approve));
end $$;
revoke all on function public.review_identity_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_identity_verification(uuid, boolean, text) to authenticated;

-- 3) publish_listing (a versão vigente é a de 3 argumentos criada em review_contracts.sql,
--    que por baixo chama _publish_listing_v7) agora exige identidade verificada.
create or replace function public.publish_listing(p_listing uuid, p_duration_days int, p_declaration_accepted boolean default false)
returns public.listings language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and identity_verified_at is not null) then
    raise exception 'IDENTITY_NOT_VERIFIED';
  end if;
  select * into l from listings where id = p_listing for update;
  if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  if l.status = 'active' then return l; end if;
  if p_declaration_accepted then update listings set declaration_accepted_at = clock_timestamp() where id = l.id; end if;
  return public._publish_listing_v7(p_listing, p_duration_days);
end $$;
revoke all on function public.publish_listing(uuid, int, boolean) from public, anon;
grant execute on function public.publish_listing(uuid, int, boolean) to authenticated;

-- 4) storage: bucket privado para documentos de identidade (nunca público).
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
      ('identity-documents', 'identity-documents', false, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
    execute $p$create policy "identity docs own upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "identity docs read" on storage.objects for select to authenticated using (
      bucket_id = 'identity-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()))$p$;
  end if;
end $$;
