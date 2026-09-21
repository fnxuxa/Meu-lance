-- Correções aditivas: não altera migrations históricas.
-- A coluna gerada search_vec não integra a publicação. A PK identifica os UPDATEs.
alter table public.listings replica identity default;
create or replace function public.server_time() returns timestamptz language sql volatile as $$ select clock_timestamp() $$;
grant execute on function public.server_time() to anon, authenticated;

create or replace function public.create_listing_draft(
 p_title text,p_description text,p_condition text,p_defects text,p_start_price_cents bigint,
 p_delivery_mode public.delivery_mode,p_city text,p_state text,p_category uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lid uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from profiles where id=uid and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
 if p_title is null or char_length(trim(p_title)) not between 8 and 120 then raise exception 'INVALID_TITLE'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 10000 then raise exception 'INVALID_DESCRIPTION'; end if;
 if p_condition is null or p_condition not in ('new','like_new','good','fair','for_parts') then raise exception 'INVALID_CONDITION'; end if;
 if p_start_price_cents is null or p_start_price_cents not between 5000 and 20000000 then raise exception 'INVALID_START_PRICE'; end if;
 if p_city is null or char_length(trim(p_city)) not between 2 and 100 or p_state is null or upper(trim(p_state)) not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'INVALID_LOCATION'; end if;
 if p_delivery_mode is null then raise exception 'INVALID_DELIVERY'; end if;
 if p_category is null or not exists(select 1 from categories where id=p_category and active) then raise exception 'INVALID_CATEGORY'; end if;
 if contains_contact(p_title||' '||p_description||' '||coalesce(p_defects,'')) then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
 insert into listings(seller_id,category_id,title,description,condition,defects_declared,start_price_cents,current_price_cents,status,delivery_mode,city,state,slug)
 values(uid,p_category,trim(p_title),trim(p_description),p_condition,nullif(trim(p_defects),''),p_start_price_cents,p_start_price_cents,'draft',p_delivery_mode,trim(p_city),upper(trim(p_state)),public.make_slug(p_title)||'-'||gen_random_uuid()::text) returning id into lid;
 return lid;
end $$;

-- Registra o aceite no servidor; repetir publicação concluída é seguro.
alter function public.publish_listing(uuid,int) rename to _publish_listing_v7;
revoke all on function public._publish_listing_v7(uuid,int) from public,anon,authenticated;
create function public.publish_listing(p_listing uuid,p_duration_days int,p_declaration_accepted boolean default false)
returns public.listings language plpgsql security definer set search_path=public as $$
declare l public.listings;
begin
 select * into l from listings where id=p_listing for update;
 if not found or l.seller_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from profiles where id=auth.uid() and banned_at is null) then raise exception 'ACCOUNT_RESTRICTED'; end if;
 if l.status='active' then return l; end if;
 if p_declaration_accepted then update listings set declaration_accepted_at=clock_timestamp() where id=l.id; end if;
 return public._publish_listing_v7(p_listing,p_duration_days);
end $$;
revoke all on function public.publish_listing(uuid,int,boolean) from public,anon;
grant execute on function public.publish_listing(uuid,int,boolean) to authenticated;

-- Desempate do histórico mesmo quando dois registros têm o mesmo microssegundo.
alter table public.bids add column sequence_no bigint generated always as identity;
create or replace view public.public_bids as
select b.id,b.listing_id,b.amount_cents,b.kind,b.created_at,
 left(p.display_name,1)||'***'||right(p.display_name,1) as bidder_mask,b.sequence_no
from public.bids b join public.profiles p on p.id=b.bidder_id
join public.listings l on l.id=b.listing_id
where l.status in ('active','ended_no_bids','ended_with_winner');

-- Oculta perguntas de anúncios removidos/rascunhos.
drop policy "questions read" on public.questions;
create policy "questions read" on public.questions for select using(exists(select 1 from listings l where l.id=listing_id and (l.status in ('active','ended_no_bids','ended_with_winner') or l.seller_id=auth.uid())));
do $$ begin alter publication supabase_realtime add table public.questions; exception when duplicate_object then null; end $$;

-- Mensagens: só campos autorais e sem divulgação de contatos antes do pagamento.
revoke insert,update,delete on public.order_messages from anon,authenticated;
grant insert(order_id,sender_id,body) on public.order_messages to authenticated;
create or replace function public.guard_order_message() returns trigger language plpgsql security definer set search_path=public as $$
declare o public.orders;
begin
 select * into o from orders where id=new.order_id for update;
 if auth.uid() is null or auth.uid() not in(o.buyer_id,o.seller_id) or new.sender_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
 if new.body is null or char_length(trim(new.body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
 if o.status in ('pending_payment','payment_expired','cancelled') and contains_contact(new.body) then raise exception 'CONTACT_SHARING_BLOCKED'; end if;
 return new;
end $$;
create trigger order_message_guard before insert on public.order_messages for each row execute function public.guard_order_message();

create or replace function public._notify(p_user uuid,p_kind public.notification_kind,p_title text,p_body text,p_href text)
returns void language plpgsql security definer set search_path=public as $$
declare pref public.notification_preferences;
begin
 select * into pref from notification_preferences where user_id=p_user;
 if (p_kind='outbid' and pref.outbid=false) or (p_kind='won' and pref.won=false) or (p_kind='order' and pref.order_updates=false) then return; end if;
 insert into notifications(user_id,kind,title,body,href) values(p_user,p_kind,p_title,p_body,p_href);
end $$;
