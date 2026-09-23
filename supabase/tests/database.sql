-- Testes de banco: RLS, privilégios, motor de lances/proxy, anti-sniping e fechamento.
\set ON_ERROR_STOP on
create schema tests;
grant usage on schema tests to public;
create function tests.login(u uuid) returns void language plpgsql as $$ begin reset role; perform set_config('request.jwt.claim.sub', u::text, false); set role authenticated; end $$;
create function tests.anon() returns void language plpgsql as $$ begin reset role; perform set_config('request.jwt.claim.sub', '', false); set role anon; end $$;
create function tests.root() returns void language plpgsql as $$ begin reset role; perform set_config('request.jwt.claim.sub', '', false); end $$;
create function tests.ok(c boolean, msg text) returns void language plpgsql as $$ begin if c is not true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create function tests.throws(q text, pattern text, msg text) returns void language plpgsql as $$
declare failed boolean := false; m text;
begin
  begin execute q; exception when others then failed := true; m := sqlerrm; end;
  if not failed then raise exception 'FALHOU (não deu erro): %', msg; end if;
  if m !~* pattern then raise exception 'FALHOU (erro inesperado "%" != "%"): %', m, pattern, msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function tests.affected(q text) returns int language plpgsql as $$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
grant execute on all functions in schema tests to public;

-- usuários
insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at) values
 ('a0000000-0000-0000-0000-00000000000a', 'ana@x.com',   '{"display_name":"Ana"}', now()),
 ('b0000000-0000-0000-0000-00000000000b', 'bruno@x.com', '{"display_name":"Bruno"}', now()),
 ('c0000000-0000-0000-0000-00000000000c', 'carla@x.com', '{"display_name":"Carla"}', null),
 ('5e000000-0000-0000-0000-000000000005', 'sara@x.com',  '{"display_name":"Sara","full_name":"Sara Vendedora"}', now());
select tests.ok((select count(*) = 4 from profiles), 'trigger cria profile no cadastro');
select tests.ok((select count(*) = 4 from notification_preferences), 'trigger cria preferências de notificação');
update profiles set phone_e164 = '+5534999990005', identity_verified_at = now() where id = '5e000000-0000-0000-0000-000000000005';
select tests.ok((select email_verified_at is null from profiles where id = 'c0000000-0000-0000-0000-00000000000c'), 'e-mail não verificado começa nulo');
update auth.users set email_confirmed_at = now() where id = 'c0000000-0000-0000-0000-00000000000c';
select tests.ok((select email_verified_at is not null from profiles where id = 'c0000000-0000-0000-0000-00000000000c'), 'confirmação de e-mail sincroniza no profile');

-- ══ profiles ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$update profiles set role = 'admin' where id = 'b0000000-0000-0000-0000-00000000000b'$$, 'permission denied|PRIVILEGED', 'usuário não vira admin');
select tests.throws($$update profiles set phone_verified_at = now() where id = 'b0000000-0000-0000-0000-00000000000b'$$, 'permission denied|PRIVILEGED', 'usuário não se autoverifica');
update profiles set city = 'Uberlândia', state = 'MG' where id = 'b0000000-0000-0000-0000-00000000000b';
select tests.ok((select city = 'Uberlândia' from profiles where id = 'b0000000-0000-0000-0000-00000000000b'), 'usuário edita campos permitidos do próprio perfil');
select tests.ok((select count(*) = 1 from profiles), 'usuário só enxerga o próprio profile');
select tests.anon();
select tests.ok((select count(*) = 0 from profiles), 'anônimo não lê tabela profiles');
select tests.ok((select count(*) = 4 from public_profiles), 'anônimo lê public_profiles');
select tests.ok((select count(*) = 0 from information_schema.columns where table_name = 'public_profiles' and column_name in ('phone_e164','full_name','role')), 'public_profiles não expõe telefone, nome completo nem role');

-- ══ anúncios ══
select tests.root(); insert into categories(slug,name) values ('teste','Teste') on conflict do nothing;
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$insert into listings(seller_id, title, description, condition, start_price_cents, current_price_cents, bid_count, delivery_mode, city, state) values ('5e000000-0000-0000-0000-000000000005','x','y','good',100,100,42,'both','a','b')$$, 'permission denied', 'vendedor não consegue enviar bid_count/status/preço atual no INSERT');
insert into listings(seller_id, title, description, condition, start_price_cents, current_price_cents, delivery_mode, city, state, declaration_accepted_at)
  values ('5e000000-0000-0000-0000-000000000005', 'PlayStation 5 Slim', 'Console com 2 controles', 'good', 200000, 99999999, 'both', 'Uberlândia', 'MG', now());
select tests.root();
update listings set id = '11111111-1111-1111-1111-111111111111' where title = 'PlayStation 5 Slim';
select tests.ok((select status = 'draft' and bid_count = 0 and current_price_cents = 200000 and slug like 'playstation-5-slim-%' from listings where id = '11111111-1111-1111-1111-111111111111'), 'INSERT do vendedor vira rascunho (preço atual = inicial, slug gerado no servidor)');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$insert into listings(seller_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state) values ('b0000000-0000-0000-0000-00000000000b','x','y','good',100,100,'both','a','b')$$, 'row-level security', 'não cria anúncio em nome de outro usuário');
select tests.throws($$select publish_listing('11111111-1111-1111-1111-111111111111', 7)$$, 'MIN_IMAGES', 'publicar exige 3 fotos');
insert into storage.objects(bucket_id,name) select 'listing-images','5e000000-0000-0000-0000-000000000005/11111111-1111-1111-1111-111111111111/'||x||'.webp' from unnest(array['a','b','c']) x;
insert into listing_images(listing_id, storage_path, sort_order) values
  ('11111111-1111-1111-1111-111111111111','5e000000-0000-0000-0000-000000000005/11111111-1111-1111-1111-111111111111/a.webp',0),('11111111-1111-1111-1111-111111111111','5e000000-0000-0000-0000-000000000005/11111111-1111-1111-1111-111111111111/b.webp',1),('11111111-1111-1111-1111-111111111111','5e000000-0000-0000-0000-000000000005/11111111-1111-1111-1111-111111111111/c.webp',2);
select tests.throws($$select publish_listing('11111111-1111-1111-1111-111111111111', 4)$$, 'INVALID_DURATION', 'duração inválida é recusada');
select tests.anon();
select tests.ok((select count(*) = 0 from listings), 'rascunho não aparece para anônimo');
select tests.ok((select count(*) = 0 from listing_images), 'fotos de rascunho não aparecem para anônimo');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select publish_listing('11111111-1111-1111-1111-111111111111', 7)$$, 'CHECKLIST_REQUIRED', 'publicar exige checklist de estado');
select set_listing_condition_report('11111111-1111-1111-1111-111111111111', '{"works_ok":"yes","structure_ok":"yes","parts_ok":"untested"}');
select tests.ok((select status = 'active' and ends_at > now() + interval '6 days 23 hours' from publish_listing('11111111-1111-1111-1111-111111111111', 7)), 'publicação ativa o leilão por 7 dias');
select tests.ok(tests.affected($$update listings set title = 'hack' where id = '11111111-1111-1111-1111-111111111111'$$) = 0, 'vendedor não edita anúncio publicado');
select tests.throws($$update listings set status = 'ended_with_winner' where id = '11111111-1111-1111-1111-111111111111'$$, 'permission denied', 'vendedor não muda status por UPDATE direto');
select tests.anon();
select tests.ok((select count(*) = 1 from listings), 'anúncio ativo é público');
select tests.ok((select count(*) = 0 from information_schema.columns where table_name = 'listings' and column_name = 'highest_bidder_id'), 'listings não guarda identidade do líder');

-- ══ perguntas ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$insert into questions(listing_id, author_id, body, answer) values ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b','Tem nota fiscal?','Sim, pode comprar')$$, 'permission denied|row-level', 'usuário não injeta resposta falsa do vendedor');
select tests.throws($$insert into questions(listing_id, author_id, body) values ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b','me chama no zap 34 99999-0000')$$, 'CONTACT_SHARING_BLOCKED', 'bloqueia contato na pergunta (whatsapp/telefone)');
select tests.throws($$insert into questions(listing_id, author_id, body) values ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b','manda email pra fulano@gmail.com')$$, 'CONTACT_SHARING_BLOCKED', 'bloqueia e-mail na pergunta');
insert into questions(listing_id, author_id, body) values ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b','Tem nota fiscal?');
select tests.throws($$select answer_question((select id from questions limit 1), 'Tenho sim')$$, 'FORBIDDEN', 'só o vendedor responde');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select answer_question((select id from questions limit 1), 'me chama no telegram')$$, 'CONTACT_SHARING_BLOCKED', 'vendedor também não passa contato');
select answer_question((select id from questions limit 1), 'Tenho sim, acompanha a caixa.');
select tests.anon();
select tests.ok((select answer = 'Tenho sim, acompanha a caixa.' from questions limit 1), 'anônimo lê pergunta respondida');
select tests.throws($$select author_id from questions$$, 'permission denied', 'author_id da pergunta não é legível');

-- ══ lances: ordem básica ══
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 200000, 'seller-key-1')$$, 'SELLER_CANNOT_BID', 'vendedor não dá lance no próprio item');
select tests.anon();
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 200000, 'anon-key-01')$$, 'permission denied', 'anônimo não executa place_bid');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 199999, 'bruno-key-0')$$, 'BID_TOO_LOW', 'primeiro lance abaixo do valor inicial falha');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 200000, 'short')$$, 'IDEMPOTENCY_KEY_REQUIRED', 'exige chave de idempotência');
select tests.ok((select current_price_cents = 200000 and bid_count = 1 from place_bid('11111111-1111-1111-1111-111111111111', 200000, 'bruno-key-1')), 'primeiro lance no valor inicial');
select tests.ok((select bid_count = 1 from place_bid('11111111-1111-1111-1111-111111111111', 200000, 'bruno-key-1')), 'repetir a mesma chave não cria novo lance (idempotência)');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 300000, 'bruno-key-2')$$, 'ALREADY_LEADING', 'líder não dá lance em si mesmo');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111', 200500, 'ana-key-001')$$, 'BID_TOO_LOW', 'incremento mínimo: R$ 10 em R$ 2.000 (R$ 2.005 é recusado)');
select tests.ok((select current_price_cents = 201000 from place_bid('11111111-1111-1111-1111-111111111111', 201000, 'ana-key-002')), 'lance válido com incremento mínimo (R$ 2.010)');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*) = 0 from auction_leaders), 'quem foi superado não enxerga o líder');
select tests.ok((select count(*) = 1 from bids), 'usuário lê só os próprios lances');
select tests.ok((select count(*) = 1 from notifications where kind = 'outbid'), 'quem foi superado recebe notificação');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*) = 1 from auction_leaders), 'o líder enxerga a própria liderança');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$update notifications set title = 'x'$$, 'permission denied', 'notificação: só read_at é editável');
select tests.anon();
select tests.ok((select count(*) = 2 from public_bids where listing_id = '11111111-1111-1111-1111-111111111111'), 'histórico público disponível');
select tests.ok((select bidder_mask = 'A***a' from public_bids order by created_at desc limit 1), 'identidade mascarada no histórico (A***a)');
select tests.ok((select count(*) = 0 from bids), 'anônimo não lê tabela bids');
select tests.throws($$select * from auction_leaders$$, 'permission denied', 'anônimo não lê líder');

-- ══ lance automático (proxy) ══
select tests.root();
insert into listings(id, seller_id, title, description, condition, start_price_cents, current_price_cents, delivery_mode, city, state, slug, status, starts_at, ends_at, declaration_accepted_at)
values ('22222222-2222-2222-2222-222222222222','5e000000-0000-0000-0000-000000000005','RTX 4070 Super','Placa','like_new',200000,200000,'shipping','Campinas','SP','rtx-4070','active',now(),now()+interval '3 days',now());
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select current_price_cents = 200000 and bid_count = 1 from set_proxy_bid('22222222-2222-2222-2222-222222222222', 400000)), 'primeiro teto abre o leilão no valor inicial (não no teto)');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select current_price_cents = 212500 from place_bid('22222222-2222-2222-2222-222222222222', 210000, 'bruno-px-01')), 'cenário do handoff: A tem teto 4.000; B dá 2.100; A sobe só o necessário (R$ 2.125)');
select tests.root();
select tests.ok((select bidder_id = 'a0000000-0000-0000-0000-00000000000a' from auction_leaders where listing_id = '22222222-2222-2222-2222-222222222222'), 'A continua líder');
select tests.ok((select bid_count = 3 from listings where id = '22222222-2222-2222-2222-222222222222'), 'histórico: A abre, B lança, A cobre');
select tests.anon();
select tests.ok((select count(*) = 0 from public_bids where amount_cents = 400000), 'teto de A (R$ 4.000) nunca aparece no histórico público');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select current_price_cents = 352500 from set_proxy_bid('22222222-2222-2222-2222-222222222222', 350000)), 'dois tetos: B (3.500) perde para A (4.000) e o preço vai a R$ 3.525');
select tests.ok((select count(*) = 1 from notifications where title = 'Seu limite foi superado'), 'B é avisado de que o teto foi superado');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select set_proxy_bid('22222222-2222-2222-2222-222222222222', 390000)$$, 'MAX_NOT_HIGHER', 'líder só pode aumentar o teto (390k < 400k)');
select tests.ok((select current_price_cents = 352500 from set_proxy_bid('22222222-2222-2222-2222-222222222222', 450000)), 'líder aumenta o teto sem mexer no preço');
select tests.login('c0000000-0000-0000-0000-00000000000c');
select tests.ok((select current_price_cents = 500000 from place_bid('22222222-2222-2222-2222-222222222222', 500000, 'carla-px-01')), 'lance manual acima de todos os tetos vira o novo preço');
select tests.root();
select tests.ok((select bidder_id = 'c0000000-0000-0000-0000-00000000000c' from auction_leaders where listing_id = '22222222-2222-2222-2222-222222222222'), 'C assume a liderança');
select tests.ok((select count(*) = 0 from (select amount_cents, lag(amount_cents) over (order by sequence_no) prev from bids where listing_id = '22222222-2222-2222-2222-222222222222') x where prev is not null and amount_cents < prev), 'o preço nunca diminui ao longo do histórico');

-- teto empatado: quem definiu primeiro continua
insert into listings(id, seller_id, title, description, condition, start_price_cents, current_price_cents, delivery_mode, city, state, slug, status, starts_at, ends_at, declaration_accepted_at)
values ('33333333-3333-3333-3333-333333333333','5e000000-0000-0000-0000-000000000005','Monitor','Monitor','good',100000,100000,'both','Goiânia','GO','monitor','active',now(),now()+interval '3 days',now());
select tests.login('a0000000-0000-0000-0000-00000000000a');
select set_proxy_bid('33333333-3333-3333-3333-333333333333', 300000);
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select current_price_cents = 300000 from set_proxy_bid('33333333-3333-3333-3333-333333333333', 300000)), 'empate de tetos: preço vai ao teto');
select tests.root();
select tests.ok((select bidder_id = 'a0000000-0000-0000-0000-00000000000a' from auction_leaders where listing_id = '33333333-3333-3333-3333-333333333333'), 'empate de tetos: quem definiu primeiro fica na frente');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select cancel_proxy_bid('33333333-3333-3333-3333-333333333333');
select tests.ok((select not active from proxy_bids where bidder_id = 'a0000000-0000-0000-0000-00000000000a' and listing_id = '33333333-3333-3333-3333-333333333333'), 'usuário desativa o lance automático');
select tests.ok((select count(*) = 0 from proxy_bids where bidder_id <> 'a0000000-0000-0000-0000-00000000000a'), 'teto só é visível para o dono');
select tests.throws($$update proxy_bids set max_amount_cents = 1$$, 'permission denied', 'proxy_bids não é editável direto');

-- ══ anti-sniping e fim do leilão ══
select tests.root();
insert into listings(id, seller_id, title, description, condition, start_price_cents, current_price_cents, delivery_mode, city, state, slug, status, starts_at, ends_at, original_ends_at, declaration_accepted_at)
values ('44444444-4444-4444-4444-444444444444','5e000000-0000-0000-0000-000000000005','Bike','Bike','good',10000,10000,'pickup','BH','MG','bike','active',now(),now()+interval '90 seconds',now()+interval '90 seconds',now());
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select ends_at > now() + interval '3 minutes' and extensions_count = 1 from place_bid('44444444-4444-4444-4444-444444444444', 10000, 'ana-snipe-1')), 'anti-sniping estende +2 min quando o lance chega nos últimos 2 min');
select tests.root();
update listings set ends_at = now() - interval '1 second' where id = '44444444-4444-4444-4444-444444444444';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select place_bid('44444444-4444-4444-4444-444444444444', 20000, 'bruno-late-1')$$, 'AUCTION_ENDED', 'lance após o encerramento falha');
select tests.throws($$select close_due_auctions()$$, 'permission denied', 'usuário não executa close_due_auctions');
select tests.root();
insert into listings(id, seller_id, title, description, condition, start_price_cents, current_price_cents, delivery_mode, city, state, slug, status, starts_at, ends_at, declaration_accepted_at)
values ('55555555-5555-5555-5555-555555555555','5e000000-0000-0000-0000-000000000005','Sem lances','x','good',5000,5000,'pickup','SP','SP','sem-lances','active',now()-interval '2 days',now()-interval '1 minute',now());
select tests.ok(close_due_auctions() >= 2, 'fechamento processa leilões vencidos');
select tests.ok((select status = 'ended_with_winner' from listings where id = '44444444-4444-4444-4444-444444444444'), 'leilão com vencedor -> ended_with_winner');
select tests.ok((select status = 'ended_no_bids' from listings where id = '55555555-5555-5555-5555-555555555555'), 'leilão sem lances -> ended_no_bids');
select tests.ok((select count(*) = 1 and max(fee_cents) = 500 and max(seller_net_cents) = 9500 and max(status) = 'pending_payment' and max(payment_due_at) > now() + interval '47 hours' from orders where listing_id = '44444444-4444-4444-4444-444444444444'), 'cria 1 pedido com comissão de 5% e prazo de 48h');
select tests.ok(close_due_auctions() = 0, 'fechamento é idempotente');
select tests.ok((select count(*) = 1 from orders where listing_id = '44444444-4444-4444-4444-444444444444'), 'nunca duplica pedido');
select tests.ok((select count(*) = 1 from notifications where kind = 'won' and user_id = 'a0000000-0000-0000-0000-00000000000a'), 'vencedor é notificado');

-- ══ cancelamento ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select cancel_listing('22222222-2222-2222-2222-222222222222')$$, 'FORBIDDEN', 'só o vendedor cancela');
select tests.root();
update listings set ends_at = now() + interval '2 hours' where id = '22222222-2222-2222-2222-222222222222';
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select cancel_listing('22222222-2222-2222-2222-222222222222')$$, 'TOO_CLOSE_TO_END', 'não cancela leilão com lances perto do fim');

-- ══ disputas, avaliações e evidências ══
select tests.root();
update orders set status = 'shipped' where listing_id = '44444444-4444-4444-4444-444444444444';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok(tests.affected($$insert into disputes(order_id, opened_by, reason, description) select o.id, 'b0000000-0000-0000-0000-00000000000b', 'damaged', 'Descrição longa o suficiente aqui' from orders o$$) = 0, 'quem não é parte do pedido não abre disputa');
select tests.throws($$insert into disputes(order_id, opened_by, reason, description) values ((select id from orders limit 1), 'b0000000-0000-0000-0000-00000000000b', 'damaged', 'Descrição longa o suficiente aqui')$$, 'row-level security|null value', 'nem forçando o id do pedido de outra pessoa');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$insert into disputes(order_id, opened_by, reason, description) select id, 'a0000000-0000-0000-0000-00000000000a', 'damaged', 'curta' from orders$$, 'disputes_desc_len', 'descrição curta é recusada');
select tests.throws($$insert into disputes(order_id, opened_by, reason, description, status) select id, 'a0000000-0000-0000-0000-00000000000a', 'damaged', 'Descrição longa o suficiente aqui', 'resolved_buyer' from orders$$, 'permission denied', 'comprador não abre disputa já resolvida');
insert into disputes(order_id, opened_by, reason, description) select id, 'a0000000-0000-0000-0000-00000000000a', 'damaged', 'A bike chegou com o quadro amassado e sem o selim.' from orders where listing_id = '44444444-4444-4444-4444-444444444444';
select tests.root();
select tests.ok((select status = 'disputed' from orders where listing_id = '44444444-4444-4444-4444-444444444444'), 'abrir disputa move o pedido para disputed');
select tests.ok((select snapshot->>'title' = 'Bike' from disputes limit 1), 'disputa guarda snapshot imutável do anúncio');
select tests.login('c0000000-0000-0000-0000-00000000000c');
select tests.throws($$insert into dispute_evidence(dispute_id, author_id, kind, note) values ((select id from disputes limit 1), 'c0000000-0000-0000-0000-00000000000c', 'text', 'intruso')$$, 'row-level security|null value', 'terceiro não adiciona evidência');
select tests.login('c0000000-0000-0000-0000-00000000000c');
select tests.ok((select count(*) = 0 from disputes), 'terceiro não lê disputa alheia');
select tests.login('5e000000-0000-0000-0000-000000000005');
insert into dispute_evidence(dispute_id, author_id, kind, note) select id, '5e000000-0000-0000-0000-000000000005', 'text', 'Enviei bem embalada, tenho o comprovante.' from disputes;
select tests.ok((select count(*) = 1 from disputes), 'vendedor da ordem lê a disputa');
select tests.throws($$insert into reviews(order_id, author_id, subject_id, rating) select id, '5e000000-0000-0000-0000-000000000005', buyer_id, 5 from orders$$, 'row-level security', 'não avalia pedido que não está concluído');
select tests.root();
update orders set status = 'completed' where listing_id = '44444444-4444-4444-4444-444444444444';
select tests.login('a0000000-0000-0000-0000-00000000000a');
insert into reviews(order_id, author_id, subject_id, rating, comment) select id, 'a0000000-0000-0000-0000-00000000000a', seller_id, 5, 'Vendedor ok' from orders;
select tests.throws($$insert into reviews(order_id, author_id, subject_id, rating) select id, 'a0000000-0000-0000-0000-00000000000a', seller_id, 4 from orders$$, 'duplicate key', 'uma avaliação por parte por pedido');
select tests.anon();
select tests.ok((select rating_avg = 5 and rating_count = 1 and completed_sales = 1 from public_profiles where id = '5e000000-0000-0000-0000-000000000005'), 'reputação do vendedor calculada de dados reais');

-- ══ storage (stub) ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok(tests.affected($$insert into storage.objects(bucket_id, name) values ('avatars','b0000000-0000-0000-0000-00000000000b/x.webp')$$) = 1, 'upload na própria pasta é permitido');
select tests.throws($$insert into storage.objects(bucket_id, name) values ('avatars','a0000000-0000-0000-0000-00000000000a/x.webp')$$, 'row-level security', 'upload na pasta de outro usuário é bloqueado');

-- ══ promoção de admin (script) ══
select tests.root();
select tests.ok(tests.affected($$update profiles set role = 'admin' where id = (select id from auth.users where email = 'ana@x.com')$$) = 1, 'admin só é promovido pelo servidor (script)');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok(is_admin(), 'is_admin() reflete profiles.role');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok(not is_admin(), 'usuário comum não é admin');
select tests.root();
select 'TESTES SQL: OK' as resultado;
