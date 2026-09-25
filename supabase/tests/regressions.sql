select tests.root();
insert into listings(id,seller_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('77777777-7777-7777-7777-777777777777','5e000000-0000-0000-0000-000000000005','Teste empate manual','Produto para teste de empate','good',10000,10000,'both','São Paulo','SP','regression-tie','active',now(),now()+interval '3 days');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select set_proxy_bid('77777777-7777-7777-7777-777777777777',20000,'proxy-repeat-1');
select tests.ok((select bid_count=1 from set_proxy_bid('77777777-7777-7777-7777-777777777777',20000,'proxy-repeat-1')),'retry de proxy é idempotente');
select tests.throws($$select set_proxy_bid('77777777-7777-7777-7777-777777777777',21000,'proxy-repeat-1')$$,'IDEMPOTENCY_CONFLICT','chave proxy não aceita outro valor');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select current_price_cents=20000 from place_bid('77777777-7777-7777-7777-777777777777',20000,'manual-tie-01')),'manual empatado consome teto sem superá-lo');
select tests.ok((select count(*)=0 from auction_leaders where listing_id='77777777-7777-7777-7777-777777777777'),'manual não rouba liderança do teto empatado anterior');
select tests.throws($$select place_bid('77777777-7777-7777-7777-777777777777',21000,'manual-tie-01')$$,'IDEMPOTENCY_CONFLICT','chave manual vincula valor');
select tests.throws($$select place_bid('11111111-1111-1111-1111-111111111111',20000,'manual-tie-01')$$,'IDEMPOTENCY_CONFLICT','chave manual vincula anúncio');
select tests.throws($$select _set_proxy_bid_v7('77777777-7777-7777-7777-777777777777',25000)$$,'permission denied','motor interno não é RPC pública');
select tests.root();
select tests.ok((select bidder_id='a0000000-0000-0000-0000-00000000000a' from auction_leaders where listing_id='77777777-7777-7777-7777-777777777777'),'teto anterior permanece vencedor');
insert into listings(id,seller_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('88888888-8888-8888-8888-888888888888','5e000000-0000-0000-0000-000000000005','Teste fração incremento','Produto para teste de limite','good',10000,10000,'both','São Paulo','SP','regression-partial','active',now(),now()+interval '3 days');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select set_proxy_bid('88888888-8888-8888-8888-888888888888',20100,'partial-proxy-1');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select current_price_cents=20100 from place_bid('88888888-8888-8888-8888-888888888888',20000,'partial-manual-1')),'proxy cobre até teto quando diferença é menor que incremento');

-- A RPC que não funcionava por depender de unaccent deve funcionar sem essa extensão.
select tests.login('5e000000-0000-0000-0000-000000000005');
select create_listing_draft('Violão de estudo','Violão usado em bom estado de conservação','good','Marcas leves',15000,'both','São Paulo','SP',(select id from categories where slug='teste'));
select tests.ok((select count(*)=1 from listings where title='Violão de estudo' and status='draft'),'cria rascunho real com acentos');
select tests.throws($$select create_listing_draft(null,'Descrição suficiente para validação','good','',10000,'both','São Paulo','SP',(select id from categories limit 1))$$,'INVALID_TITLE','NULL não contorna validação');
insert into storage.objects(bucket_id,name) select 'listing-images','5e000000-0000-0000-0000-000000000005/'||id||'/'||i||'.webp' from listings cross join generate_series(0,2) i where title='Violão de estudo';
insert into listing_images(listing_id,storage_path,sort_order,is_defect)
 select id,'5e000000-0000-0000-0000-000000000005/'||id||'/'||i||'.webp',i,i=2 from listings cross join generate_series(0,2) i where title='Violão de estudo';
select set_listing_condition_report((select id from listings where title='Violão de estudo'),'{"works_ok":"yes","structure_ok":"yes","parts_ok":"yes"}');
select tests.throws($$select publish_listing((select id from listings where title='Violão de estudo'),7)$$,'DECLARATION_REQUIRED','aceite não é presumido');
select tests.ok((select status='active' and declaration_accepted_at is not null from publish_listing((select id from listings where title='Violão de estudo'),7,true)),'publicação grava aceite no servidor');
select tests.ok((select status='active' from publish_listing((select id from listings where title='Violão de estudo'),7,true)),'retry de publicação é seguro');
select tests.throws($$select _publish_listing_v7((select id from listings where title='Violão de estudo'),7)$$,'permission denied','publicação interna não é exposta');
select tests.throws($$delete from storage.objects where name like '5e000000-0000-0000-0000-000000000005/%'$$,'Direct deletion|permission denied','vendedor não apaga fotos publicadas (bloqueado antes mesmo da RLS, igual ao Storage real)');
select tests.throws($$insert into storage.objects(bucket_id,name) select 'listing-images','5e000000-0000-0000-0000-000000000005/'||id||'/nova.webp' from listings where title='Violão de estudo'$$,'LISTING_LOCKED|row-level','não adiciona fotos ao leilão publicado');
select tests.root();
update notification_preferences set outbid=false where user_id='b0000000-0000-0000-0000-00000000000b';
select _notify('b0000000-0000-0000-0000-00000000000b','outbid','Não entregar','Preferência desativada','/');
select tests.ok((select count(*)=0 from notifications where title='Não entregar'),'preferência de alerta é respeitada pelo motor');
select tests.ok(not has_function_privilege('anon','public._notify(uuid,public.notification_kind,text,text,text)','EXECUTE'),'notificações internas continuam privadas');
