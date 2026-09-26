-- Disputa: envio de evidências (fotos), conversa a três (comprador, vendedor e equipe) e
-- apagamento das imagens e mensagens 30 dias depois da decisão.
-- O upload em si já era permitido pela policy "own folder upload" (pasta do próprio usuário no
-- bucket dispute-evidence); o que faltava era a tela e a validação do caminho/quantidade.

insert into public.app_config(key, value) values ('dispute_retention_days', '30') on conflict (key) do nothing;
alter table public.disputes add column if not exists data_purged_at timestamptz;

-- ───────── evidências: caminho e quantidade validados no servidor ─────────
create or replace function public.dispute_evidence_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'image' then
    if new.storage_path is null or new.storage_path not like (new.author_id::text || '/' || new.dispute_id::text || '/%') then
      raise exception 'INVALID_EVIDENCE_PATH';
    end if;
    if (select count(*) from public.dispute_evidence
         where dispute_id = new.dispute_id and author_id = new.author_id and kind = 'image') >= 10 then
      raise exception 'MAX_EVIDENCE';
    end if;
  end if;
  return new;
end $$;
create trigger dispute_evidence_guard before insert on public.dispute_evidence
  for each row execute function public.dispute_evidence_guard();

-- ───────── conversa da disputa (comprador, vendedor e equipe) ─────────
create table public.dispute_messages(
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.dispute_messages enable row level security;
create index dispute_messages_dispute_idx on public.dispute_messages(dispute_id, created_at);
create policy "dispute thread read" on public.dispute_messages for select using (
  public.is_staff() or exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id
    where d.id = dispute_id and auth.uid() in (o.buyer_id, o.seller_id)));
revoke all on public.dispute_messages from anon, authenticated;
grant select on public.dispute_messages to authenticated;

create or replace function public.send_dispute_message(p_dispute uuid, p_body text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d public.disputes; o public.orders; b text := trim(coalesce(p_body, '')); staff boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from disputes where id = p_dispute;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from orders where id = d.order_id;
  staff := is_staff();
  if not staff and auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'FORBIDDEN'; end if;
  if d.status in ('resolved_buyer', 'resolved_seller', 'cancelled') then raise exception 'DISPUTE_CLOSED'; end if;
  if char_length(b) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  if (select count(*) from dispute_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into dispute_messages(dispute_id, sender_id, body) values (d.id, auth.uid(), b);
  -- avisa quem não escreveu (a equipe acompanha pelo /admin)
  if auth.uid() <> o.buyer_id then
    perform _notify(o.buyer_id, 'dispute', 'Nova mensagem na disputa', 'Há uma mensagem nova na conversa da disputa.', '/pedido/' || o.id);
  end if;
  if auth.uid() <> o.seller_id then
    perform _notify(o.seller_id, 'dispute', 'Nova mensagem na disputa', 'Há uma mensagem nova na conversa da disputa.', '/pedido/' || o.id);
  end if;
  return true;
end $$;
revoke all on function public.send_dispute_message(uuid, text) from public, anon;
grant execute on function public.send_dispute_message(uuid, text) to authenticated;

-- Tudo da disputa de um pedido numa chamada (papéis calculados no servidor, sem expor perfis).
create or replace function public.get_dispute_thread(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d public.disputes; o public.orders; days int; result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from orders where id = p_order_id;
  if not found then return null; end if;
  if not is_staff() and auth.uid() not in (o.buyer_id, o.seller_id) then raise exception 'FORBIDDEN'; end if;
  select * into d from disputes where order_id = o.id;
  if not found then return null; end if;
  select (value #>> '{}')::int into days from app_config where key = 'dispute_retention_days';
  days := coalesce(days, 30);
  select jsonb_build_object(
    'dispute', jsonb_build_object(
      'id', d.id, 'status', d.status, 'reason', d.reason, 'created_at', d.created_at,
      'resolved_at', d.resolved_at, 'resolution_note', d.resolution_note,
      'purge_at', case when d.resolved_at is not null then d.resolved_at + make_interval(days => days) end,
      'purged', d.data_purged_at is not null,
      'closed', d.status in ('resolved_buyer', 'resolved_seller', 'cancelled')),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'body', m.body, 'created_at', m.created_at, 'mine', m.sender_id = auth.uid(),
        'role', case when m.sender_id = o.buyer_id then 'buyer' when m.sender_id = o.seller_id then 'seller' else 'staff' end)
        order by m.created_at) from dispute_messages m where m.dispute_id = d.id), '[]'::jsonb),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'kind', e.kind, 'storage_path', e.storage_path, 'note', e.note, 'created_at', e.created_at,
        'mine', e.author_id = auth.uid(),
        'role', case when e.author_id = o.buyer_id then 'buyer' when e.author_id = o.seller_id then 'seller' else 'staff' end)
        order by e.created_at) from dispute_evidence e where e.dispute_id = d.id), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_dispute_thread(uuid) from public, anon;
grant execute on function public.get_dispute_thread(uuid) to authenticated;

-- Ao abrir a disputa: avisa o vendedor e a equipe (a conversa nasce junto com a disputa).
create or replace function public.disputes_notify_parties() returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders; s record;
begin
  select * into o from orders where id = new.order_id;
  perform _notify(o.seller_id, 'dispute', 'Disputa aberta no seu pedido',
    'O comprador abriu uma disputa. Envie sua versão e provas na conversa do pedido.', '/pedido/' || o.id);
  for s in select id from profiles where role in ('admin', 'moderator') and id <> new.opened_by loop
    perform _notify(s.id, 'dispute', 'Nova disputa para analisar', 'Uma disputa foi aberta e aguarda análise.', '/admin');
  end loop;
  return new;
end $$;
create trigger disputes_notify after insert on public.disputes
  for each row execute function public.disputes_notify_parties();

-- ───────── apagamento 30 dias após a decisão ─────────
-- O arquivo em si NÃO pode ser apagado por SQL (a linha em storage.objects some, o arquivo fica
-- órfão no armazenamento). Por isso os caminhos vão para uma fila que a rota /api/purge-storage
-- esvazia pela API oficial do Storage.
create table public.storage_purge_queue(
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.storage_purge_queue enable row level security;
revoke all on public.storage_purge_queue from anon, authenticated;
grant all on public.storage_purge_queue to service_role;

create or replace function public.purge_resolved_disputes() returns integer
language plpgsql security definer set search_path = public as $$
declare days int; n int := 0; d record;
begin
  select (value #>> '{}')::int into days from app_config where key = 'dispute_retention_days';
  days := greatest(coalesce(days, 30), 1);
  for d in
    select id from disputes
    where resolved_at is not null and resolved_at < now() - make_interval(days => days) and data_purged_at is null
    for update skip locked
  loop
    insert into storage_purge_queue(bucket, path)
      select 'dispute-evidence', storage_path from dispute_evidence where dispute_id = d.id and storage_path is not null;
    delete from dispute_evidence where dispute_id = d.id;
    delete from dispute_messages where dispute_id = d.id;
    update disputes set data_purged_at = now() where id = d.id;
    insert into audit_log(actor_id, action, entity_type, entity_id, metadata)
      values (null, 'dispute_data_purged', 'dispute', d.id::text, jsonb_build_object('retention_days', days));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.purge_resolved_disputes() from public, anon, authenticated;
grant execute on function public.purge_resolved_disputes() to service_role;
