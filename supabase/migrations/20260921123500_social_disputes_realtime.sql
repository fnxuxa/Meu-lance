-- MeuLance: disputes, messaging, notifications, audit and realtime
create type public.dispute_status as enum ('open','seller_response','under_review','resolved_buyer','resolved_seller','cancelled');
create type public.notification_kind as enum ('bid','outbid','won','order','message','dispute','system');

create table public.listing_images(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id) on delete cascade,storage_path text not null,sort_order int not null default 0,created_at timestamptz not null default now());
create table public.questions(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id) on delete cascade,author_id uuid not null references public.profiles(id),body text not null check(char_length(body) between 2 and 800),answer text,answered_at timestamptz,created_at timestamptz not null default now());
create table public.order_messages(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,sender_id uuid not null references public.profiles(id),body text check(char_length(body) between 1 and 2000),attachment_path text,created_at timestamptz not null default now());
create table public.disputes(id uuid primary key default gen_random_uuid(),order_id uuid unique not null references public.orders(id),opened_by uuid not null references public.profiles(id),reason text not null,description text not null,status public.dispute_status not null default 'open',resolution_note text,resolved_by uuid references public.profiles(id),resolved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.dispute_evidence(id uuid primary key default gen_random_uuid(),dispute_id uuid not null references public.disputes(id) on delete cascade,author_id uuid not null references public.profiles(id),kind text not null check(kind in ('image','text','tracking','other')),storage_path text,note text,created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,kind public.notification_kind not null,title text not null,body text not null,href text,read_at timestamptz,created_at timestamptz not null default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),author_id uuid not null references public.profiles(id),subject_id uuid not null references public.profiles(id),rating int not null check(rating between 1 and 5),comment text,created_at timestamptz not null default now(),unique(order_id,author_id));
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id),listing_id uuid references public.listings(id),reported_user_id uuid references public.profiles(id),reason text not null,details text,status text not null default 'open',created_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid,action text not null,entity_type text not null,entity_id text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table public.bid_idempotency(bidder_id uuid not null references public.profiles(id),idempotency_key text not null,bid_id uuid references public.bids(id),created_at timestamptz not null default now(),primary key(bidder_id,idempotency_key));

alter table public.listing_images enable row level security; alter table public.questions enable row level security;
alter table public.order_messages enable row level security; alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security; alter table public.notifications enable row level security;
alter table public.reviews enable row level security; alter table public.reports enable row level security;
alter table public.audit_log enable row level security; alter table public.bid_idempotency enable row level security;

create policy "listing images public read" on public.listing_images for select using(true);
create policy "questions public read" on public.questions for select using(true);
create policy "questions authenticated insert" on public.questions for insert to authenticated with check(auth.uid()=author_id);
create policy "order parties messages read" on public.order_messages for select using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "order parties messages insert" on public.order_messages for insert with check(auth.uid()=sender_id and exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "dispute parties read" on public.disputes for select using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in('moderator','admin')));
create policy "buyer opens dispute" on public.disputes for insert with check(auth.uid()=opened_by and exists(select 1 from public.orders o where o.id=order_id and auth.uid()=o.buyer_id));
create policy "evidence parties read" on public.dispute_evidence for select using(exists(select 1 from public.disputes d join public.orders o on o.id=d.order_id where d.id=dispute_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "evidence parties insert" on public.dispute_evidence for insert with check(auth.uid()=author_id);
create policy "notifications own" on public.notifications for select using(auth.uid()=user_id);
create policy "notifications own update" on public.notifications for update using(auth.uid()=user_id);
create policy "reviews public read" on public.reviews for select using(true);
create policy "reports own insert" on public.reports for insert with check(auth.uid()=reporter_id);
create policy "audit admin read" on public.audit_log for select using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

alter table public.listings replica identity full; alter table public.bids replica identity full;
alter table public.order_messages replica identity full; alter table public.notifications replica identity full;
do $$ begin
 alter publication supabase_realtime add table public.listings;
 alter publication supabase_realtime add table public.bids;
 alter publication supabase_realtime add table public.order_messages;
 alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
