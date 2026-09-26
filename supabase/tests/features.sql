-- Testes: checklist de estado, fotos de defeito, venda "no estado", taxa do comprador,
-- sugestão de preço, relançamento e buscas salvas.
select tests.root();
update profiles set identity_verified_at = now() where id = '5e000000-0000-0000-0000-000000000005';

-- ══ checklist e fotos de defeito ══
select tests.login('5e000000-0000-0000-0000-000000000005');
select create_listing_draft('iPhone 11 128GB preto','iPhone usado, funcionando, com marcas de uso na lateral','good','',80000,'both','São Paulo','SP',(select id from categories where slug='celulares'));
select tests.throws($$select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{"powers_on":"yes"}')$$,'CHECKLIST_INCOMPLETE','checklist incompleto é recusado');
select tests.throws($$select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{"powers_on":"yes","screen_ok":"yes","battery_ok":"yes","cameras_ok":"yes","biometrics_ok":"yes","account_free":"yes","charging_ok":"yes","hack":"yes"}')$$,'CHECKLIST_INVALID','checklist com item desconhecido é recusado');
select tests.throws($$select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{"powers_on":"talvez","screen_ok":"yes","battery_ok":"yes","cameras_ok":"yes","biometrics_ok":"yes","account_free":"yes","charging_ok":"yes"}')$$,'CHECKLIST_INCOMPLETE','resposta fora do padrão é recusada');
select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{"powers_on":"yes","screen_ok":"no","battery_ok":"yes","cameras_ok":"yes","biometrics_ok":"untested","account_free":"yes","charging_ok":"yes"}');
select tests.throws($$update listings set condition_checklist = '{}' where title='iPhone 11 128GB preto'$$,'permission denied','checklist só muda pela RPC');
insert into storage.objects(bucket_id,name) select 'listing-images','5e000000-0000-0000-0000-000000000005/'||id||'/'||i||'.webp' from listings cross join generate_series(0,3) i where title='iPhone 11 128GB preto';
insert into listing_images(listing_id,storage_path,sort_order)
 select id,'5e000000-0000-0000-0000-000000000005/'||id||'/'||i||'.webp',i from listings cross join generate_series(0,2) i where title='iPhone 11 128GB preto';
select tests.throws($$select publish_listing((select id from listings where title='iPhone 11 128GB preto'),7,true)$$,'DEFECTS_DESCRIPTION_REQUIRED','item marcado com problema exige descrição do defeito');
update listings set defects_declared = 'Trinca pequena no canto superior da tela' where title='iPhone 11 128GB preto';
select tests.throws($$select publish_listing((select id from listings where title='iPhone 11 128GB preto'),7,true)$$,'DEFECT_PHOTO_REQUIRED','defeito declarado exige foto do defeito');
insert into listing_images(listing_id,storage_path,sort_order,is_defect)
 select id,'5e000000-0000-0000-0000-000000000005/'||id||'/3.webp',3,true from listings where title='iPhone 11 128GB preto';
select tests.throws($$select publish_listing((select id from listings where title='iPhone 11 128GB preto'),7,true)$$,'IMEI_REQUIRED','celular exige IMEI');
select tests.throws($$select set_listing_imei((select id from listings where title='iPhone 11 128GB preto'),'490154203237519')$$,'INVALID_IMEI','IMEI com dígito verificador errado é recusado');
select tests.throws($$select set_listing_imei((select id from listings where title='iPhone 11 128GB preto'),'12345')$$,'INVALID_IMEI','IMEI curto é recusado');
select set_listing_imei((select id from listings where title='iPhone 11 128GB preto'),'49-015420-323751-8');
select tests.ok((select status='active' from publish_listing((select id from listings where title='iPhone 11 128GB preto'),7,true)),'publica com checklist, descrição e foto do defeito');
select tests.throws($$select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{"powers_on":"yes","screen_ok":"yes","battery_ok":"yes","cameras_ok":"yes","biometrics_ok":"yes","account_free":"yes","charging_ok":"yes"}')$$,'LISTING_LOCKED','checklist não muda depois de publicado');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select set_listing_condition_report((select id from listings where title='iPhone 11 128GB preto'),'{}')$$,'FORBIDDEN','terceiro não altera checklist');
select tests.anon();
select tests.ok((select condition_checklist->>'screen_ok'='no' from listings where title='iPhone 11 128GB preto'),'checklist publicado é público');
select tests.ok((select count(*)=1 from listing_images i join listings l on l.id=i.listing_id where l.title='iPhone 11 128GB preto' and i.is_defect),'foto de defeito é pública e marcada');

-- ══ venda "no estado" ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,defects_declared,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000001','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='pc-games'),'PS4 que não liga','Console para retirada de peças','for_parts','Não liga',10000,10000,'both','São Paulo','SP','ps4-no-estado','active',now(),now()+interval '3 days');
select tests.root();
select set_config('t.did', (select d.id::text from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), false);
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select place_bid('a5150000-0000-0000-0000-000000000001',10000,'as-is-bid-0001')$$,'AS_IS_ACK_REQUIRED','lance manual exige aceite do "no estado"');
select tests.throws($$select set_proxy_bid('a5150000-0000-0000-0000-000000000001',20000,'as-is-proxy-01')$$,'AS_IS_ACK_REQUIRED','lance automático exige aceite do "no estado"');
select acknowledge_as_is('a5150000-0000-0000-0000-000000000001');
select acknowledge_as_is('a5150000-0000-0000-0000-000000000001');
select tests.ok((select current_price_cents=10000 from place_bid('a5150000-0000-0000-0000-000000000001',10000,'as-is-bid-0001')),'após aceitar, lance é aceito');
select tests.throws($$select acknowledge_as_is((select id from listings where title='iPhone 11 128GB preto'))$$,'NOT_AS_IS','aceite só existe para item no estado');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*)=0 from as_is_acknowledgments),'aceite de outro usuário não é visível');
select tests.throws($$insert into as_is_acknowledgments(listing_id,user_id) values ('a5150000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000b')$$,'permission denied','aceite só pela RPC');

-- ══ fechamento: taxa do comprador e amostra de preço ══
select tests.root();
update listings set ends_at = now() - interval '1 second' where id = 'a5150000-0000-0000-0000-000000000001';
select close_due_auctions();
select tests.ok((select amount_cents=10000 and fee_cents=500 and buyer_fee_cents=300 and seller_net_cents=9500 from orders where listing_id='a5150000-0000-0000-0000-000000000001'),'pedido grava taxa de 3% do comprador');
select tests.ok((select count(*)=1 from sale_price_samples s join orders o on o.id=s.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'venda gera amostra de preço');
update orders set status='shipped' where listing_id='a5150000-0000-0000-0000-000000000001';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$insert into disputes(order_id,opened_by,reason,description) select id,'a0000000-0000-0000-0000-00000000000a','damaged','Chegou danificado, com a carcaça quebrada' from orders where listing_id='a5150000-0000-0000-0000-000000000001'$$,'AS_IS_REASON_NOT_ALLOWED','item no estado não abre disputa por dano');
insert into disputes(order_id,opened_by,reason,description) select id,'a0000000-0000-0000-0000-00000000000a','not_as_described','Recebi outro modelo de console, não o anunciado' from orders where listing_id='a5150000-0000-0000-0000-000000000001';
select tests.root();
select tests.ok((select snapshot->>'condition'='for_parts' from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'snapshot da disputa guarda o estado declarado');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select count(*) from sale_price_samples$$,'permission denied','amostras de preço não são expostas');

-- ══ sugestão de valor inicial ══
select tests.root();
insert into sale_price_samples(order_id,category_id,condition,title_vec,final_price_cents)
 select gen_random_uuid(),(select id from categories where slug='celulares'),'good',to_tsvector('portuguese','iPhone 11 64GB'),v
 from unnest(array[100000,120000,140000]) v;
insert into sale_price_samples(order_id,category_id,condition,title_vec,final_price_cents)
 select gen_random_uuid(),(select id from categories where slug='celulares'),'good',to_tsvector('portuguese','Moto G8'),v
 from unnest(array[30000,35000,40000]) v;
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select (r->>'basis')='similar' and (r->>'median_cents')::bigint=120000 and (r->>'suggested_start_cents')::bigint=60000 from suggest_start_price((select id from categories where slug='celulares'),'iPhone 11 128GB') r),'sugere metade da mediana de vendas parecidas');
select tests.ok((select (r->>'basis')='category' and (r->>'sample')::int=6 from suggest_start_price((select id from categories where slug='celulares'),'Xiaomi') r),'sem parecidos, usa a categoria');
select tests.ok((select suggest_start_price((select id from categories where slug='esportes'),'Bike') is null),'sem histórico não sugere');
select tests.anon();
select tests.throws($$select suggest_start_price((select id from categories where slug='celulares'),'iPhone')$$,'permission denied','anônimo não consulta sugestão');

-- ══ buscas salvas ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
insert into saved_searches(user_id,query) values ('b0000000-0000-0000-0000-00000000000b','  notebook   gamer ');
insert into saved_searches(user_id,query,category_id) values ('b0000000-0000-0000-0000-00000000000b','violao',(select id from categories where slug='instrumentos'));
select tests.ok((select query='notebook gamer' from saved_searches where query like 'notebook%'),'busca salva é normalizada');
select tests.throws($$insert into saved_searches(user_id,query) values ('a0000000-0000-0000-0000-00000000000a','hack')$$,'row-level security','não salva busca para outro usuário');
select tests.throws($$insert into saved_searches(user_id,query) values ('b0000000-0000-0000-0000-00000000000b','notebook gamer')$$,'duplicate key','busca repetida é recusada');
select tests.throws($$update saved_searches set last_notified_at = now()$$,'permission denied','usuário não altera controle de alerta');
insert into saved_searches(user_id,query) select 'b0000000-0000-0000-0000-00000000000b','termo '||i from generate_series(1,8) i;
select tests.throws($$insert into saved_searches(user_id,query) values ('b0000000-0000-0000-0000-00000000000b','termo 11')$$,'SAVED_SEARCH_LIMIT','limite de 10 buscas salvas');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*)=0 from saved_searches),'busca salva é privada');
select tests.anon();
select tests.throws($$select * from saved_searches$$,'permission denied','anônimo não lê buscas salvas');

-- ══ relançar com alerta de busca salva ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000002','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='instrumentos'),'Violão Giannini acústico','Violão de estudo em ótimo estado','good',30000,30000,'both','São Paulo','SP','violao-relist','active',now(),now()+interval '3 days');
select tests.ok((select count(*)=1 from notifications where user_id='b0000000-0000-0000-0000-00000000000b' and title='Novo anúncio na sua busca salva'),'publicação avisa busca salva (sem acento casa com acento)');
select tests.ok((select count(*)=0 from notifications where user_id='5e000000-0000-0000-0000-000000000005' and title='Novo anúncio na sua busca salva'),'vendedor não recebe alerta do próprio item');
update listings set ends_at = now() - interval '1 second' where id='a5150000-0000-0000-0000-000000000002';
select close_due_auctions();
select tests.ok((select status='ended_no_bids' from listings where id='a5150000-0000-0000-0000-000000000002'),'leilão sem lances encerra');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000002',20000,7)$$,'FORBIDDEN','só o vendedor relança');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000002',100,7)$$,'INVALID_START_PRICE','relançar valida valor inicial');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000002',20000,4)$$,'INVALID_DURATION','relançar valida duração');
select tests.ok((select status='active' and start_price_cents=20000 and current_price_cents=20000 and bid_count=0 and ends_at>now()+interval '6 days' from relist_listing('a5150000-0000-0000-0000-000000000002',20000,7)),'relança com novo valor inicial');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000002',20000,7)$$,'NOT_RELISTABLE','não relança leilão ativo');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000001',5000,7)$$,'NOT_RELISTABLE','não relança leilão vendido');
select tests.root();
select tests.ok((select count(*)=2 from notifications where user_id='b0000000-0000-0000-0000-00000000000b' and title='Novo anúncio na sua busca salva'),'relançamento avisa busca salva de novo');
select tests.ok((select count(*)=1 from audit_log where action='listing_relisted'),'relançamento vai para auditoria');

-- ══ IMEI: privacidade ══
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.ok((select imei='490154203237518' from listing_imeis i join listings l on l.id=i.listing_id where l.title='iPhone 11 128GB preto'),'vendedor vê o próprio IMEI normalizado');
select tests.throws($$insert into listing_imeis(listing_id,imei) select id,'490154203237518' from listings where title='Violão Giannini acústico'$$,'permission denied','IMEI só pela RPC');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*)=0 from listing_imeis),'terceiro não vê IMEI');
select tests.anon();
select tests.throws($$select * from listing_imeis$$,'permission denied','anônimo não vê IMEI');

-- ══ oferta ao 2º colocado, confirmação por botão e retenção do IMEI ══
select tests.root();
update profiles set role = 'user' where id = 'a0000000-0000-0000-0000-00000000000a'; -- database.sql a promove a admin
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at,second_chance_enabled)
values('a5150000-0000-0000-0000-000000000003','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='celulares'),'Galaxy S21 usado','Galaxy em bom estado de conservação','good',10000,10000,'pickup','São Paulo','SP','galaxy-2chance','active',now(),now()+interval '3 days',true);
insert into listing_imeis(listing_id,imei) values ('a5150000-0000-0000-0000-000000000003','490154203237518');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select place_bid('a5150000-0000-0000-0000-000000000003',20000,'second-chance-a1');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select place_bid('a5150000-0000-0000-0000-000000000003',25000,'second-chance-b1');
select tests.root();
update listings set ends_at = now() - interval '1 second' where id='a5150000-0000-0000-0000-000000000003';
select close_due_auctions();
update orders set payment_due_at = now() - interval '1 minute' where listing_id='a5150000-0000-0000-0000-000000000003';
select tests.ok(expire_unpaid_orders()=0,'sem pagamento real, pedido não expira');
select tests.ok((select status='pending_payment' from orders where listing_id='a5150000-0000-0000-0000-000000000003'),'pedido continua aguardando pagamento');
update app_config set value='true' where key='payments_live';
select tests.ok(expire_unpaid_orders()=1,'com pagamento real, pedido vencido expira');
select tests.ok((select status='payment_expired' from orders where listing_id='a5150000-0000-0000-0000-000000000003' and buyer_id='b0000000-0000-0000-0000-00000000000b'),'pedido do vencedor fica payment_expired');
select tests.ok((select strikes_count=1 from profiles where id='b0000000-0000-0000-0000-00000000000b'),'vencedor que não pagou recebe advertência');
select tests.ok((select bidder_id='a0000000-0000-0000-0000-00000000000a' and amount_cents=20000 and status='pending' from second_chance_offers where listing_id='a5150000-0000-0000-0000-000000000003'),'2º colocado recebe oferta pelo próprio maior lance');
select tests.ok((select count(*)=0 from second_chance_offers where listing_id<>'a5150000-0000-0000-0000-000000000003'),'sem a opção, não há oferta');
select tests.ok(expire_unpaid_orders()=0,'job é idempotente');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select accept_second_chance((select id from second_chance_offers where listing_id='a5150000-0000-0000-0000-000000000003'))$$,'FORBIDDEN','só o 2º colocado aceita');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select accept_second_chance(id) is not null from second_chance_offers where listing_id='a5150000-0000-0000-0000-000000000003'),'2º colocado aceita a oferta');
select tests.ok((select count(*)=1 and max(amount_cents)=20000 and max(buyer_fee_cents)=600 and max(fee_cents)=1000 from orders where listing_id='a5150000-0000-0000-0000-000000000003' and status='pending_payment' and buyer_id='a0000000-0000-0000-0000-00000000000a'),'novo pedido com valor e taxas do 2º colocado');
select tests.throws($$select decline_second_chance((select id from second_chance_offers where listing_id='a5150000-0000-0000-0000-000000000003'))$$,'OFFER_NOT_AVAILABLE','oferta aceita não pode ser recusada');
select tests.ok((select count(*)=0 from listing_imeis),'antes do pagamento, comprador não vê IMEI');
select tests.throws($$select confirm_delivery((select id from orders where listing_id='a5150000-0000-0000-0000-000000000003' and status='pending_payment'))$$,'INVALID_ORDER_STATE','não confirma recebimento sem pagamento');
select tests.root();
update orders set status='paid' where listing_id='a5150000-0000-0000-0000-000000000003' and status='pending_payment';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*)=1 from listing_imeis where listing_id='a5150000-0000-0000-0000-000000000003'),'após o pagamento, comprador vê IMEI');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*)=0 from listing_imeis),'vencedor que não pagou não vê IMEI');
select tests.root();
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select confirm_delivery('00000000-0000-0000-0000-000000000000')$$,'ORDER_NOT_FOUND','pedido inexistente');
select tests.root();
create temp table paid_order as select id from orders where listing_id='a5150000-0000-0000-0000-000000000003' and status='paid';
grant select on paid_order to authenticated;
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select confirm_delivery((select id from paid_order))$$,'FORBIDDEN','só o comprador confirma recebimento');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select status='completed' from confirm_delivery((select id from paid_order))),'retirada confirmada por botão direto do pagamento');
select tests.root();
alter table orders disable trigger orders_touch_updated_at;
update orders set completed_at = now() - interval '19 days', updated_at = now() - interval '19 days' where listing_id='a5150000-0000-0000-0000-000000000003';
select tests.ok(purge_expired_imeis()=0,'IMEI fica guardado até 20 dias');
select cleanup_expired_listings(10);
select tests.ok((select count(*)=1 from listings where id='a5150000-0000-0000-0000-000000000003'),'limpeza espera o IMEI ser apagado');
update orders set completed_at = now() - interval '21 days', updated_at = now() - interval '21 days' where listing_id='a5150000-0000-0000-0000-000000000003';
alter table orders enable trigger orders_touch_updated_at;
select tests.ok(purge_expired_imeis()=1,'IMEI apagado 20 dias após a conclusão');
select tests.ok((select count(*)=1 from listing_imeis),'IMEI de anúncio ativo continua');
update app_config set value='false' where key='payments_live';

-- ══ reputação durável ══
select tests.login('a0000000-0000-0000-0000-00000000000a');
insert into reviews(order_id,author_id,subject_id,rating,comment)
 select id,'a0000000-0000-0000-0000-00000000000a',seller_id,4,'Retirada tranquila' from orders where listing_id='a5150000-0000-0000-0000-000000000003' and status='completed';
select tests.login('5e000000-0000-0000-0000-000000000005');
insert into reviews(order_id,author_id,subject_id,rating)
 select id,'5e000000-0000-0000-0000-000000000005',buyer_id,2 from orders where listing_id='a5150000-0000-0000-0000-000000000003' and status='completed';
select tests.throws($$update profiles set completed_sales_count = 99 where id = '5e000000-0000-0000-0000-000000000005'$$,'PRIVILEGED_COLUMN|permission denied','vendedor não altera o próprio contador de vendas');
select tests.root();
select tests.ok((select subject_role='seller' and listing_title='Galaxy S21 usado' from reviews where comment='Retirada tranquila'),'avaliação guarda papel e título do item');
select cleanup_expired_listings(10);
select tests.ok((select count(*)=0 from listings where id='a5150000-0000-0000-0000-000000000003'),'limpeza apaga o leilão concluído');
select tests.ok((select order_id is null from reviews where comment='Retirada tranquila'),'avaliação continua depois da limpeza');
select tests.anon();
select tests.ok((select completed_sales=2 and rating_count=2 and rating_avg=4.5 from public_profiles where id='5e000000-0000-0000-0000-000000000005'),'média e vendas do vendedor continuam após a limpeza');
select tests.ok((select buyer_rating_count=1 and buyer_rating_avg=2 and rating_count=0 from public_profiles where id='a0000000-0000-0000-0000-00000000000a'),'avaliação como comprador não entra na média de vendedor');

-- ══ relançar quando o vencedor não pagou (sem oferta ao 2º colocado) ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000004','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='casa'),'Cadeira de escritório','Cadeira usada em bom estado de conservação','good',10000,10000,'pickup','São Paulo','SP','cadeira-relist','active',now(),now()+interval '3 days');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select set_proxy_bid('a5150000-0000-0000-0000-000000000004',30000,'relist-proxy-a1');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select place_bid('a5150000-0000-0000-0000-000000000004',35000,'relist-bid-b1');
select tests.root();
update listings set ends_at = now() - interval '1 second' where id='a5150000-0000-0000-0000-000000000004';
select close_due_auctions();
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select relist_listing('a5150000-0000-0000-0000-000000000004',10000,7)$$,'NOT_RELISTABLE','não relança com pedido em andamento');
select tests.root();
update orders set payment_due_at = now() - interval '1 minute' where listing_id='a5150000-0000-0000-0000-000000000004';
update app_config set value='true' where key='payments_live';
select expire_unpaid_orders();
update app_config set value='false' where key='payments_live';
select tests.ok((select count(*)=0 from second_chance_offers where listing_id='a5150000-0000-0000-0000-000000000004'),'sem a opção, ninguém recebe oferta');
select tests.ok((select count(*)=1 from notifications where user_id='5e000000-0000-0000-0000-000000000005' and title='Você pode relançar'),'vendedor é avisado que pode relançar');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.ok((select status='active' and auction_round=2 and bid_count=0 and current_price_cents=12000 from relist_listing('a5150000-0000-0000-0000-000000000004',12000,7)),'relança após o vencedor não pagar');
select tests.anon();
select tests.ok((select count(*)=0 from public_bids where listing_id='a5150000-0000-0000-0000-000000000004'),'histórico público mostra só a nova rodada');
select tests.root();
select tests.ok((select count(*)=0 from auction_leaders where listing_id='a5150000-0000-0000-0000-000000000004'),'líder da rodada anterior é removido');
select tests.ok((select count(*)=0 from proxy_bids where listing_id='a5150000-0000-0000-0000-000000000004' and active),'lances automáticos antigos são desativados');
select tests.ok((select count(*)>=2 from bids where listing_id='a5150000-0000-0000-0000-000000000004' and auction_round=1),'lances antigos continuam guardados');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select current_price_cents=12000 and bid_count=1 from place_bid('a5150000-0000-0000-0000-000000000004',12000,'relist-round2-a1')),'nova rodada começa do valor inicial');
select tests.anon();
select tests.ok((select count(*)=1 from public_bids where listing_id='a5150000-0000-0000-0000-000000000004'),'lance da nova rodada aparece no histórico');
select tests.root();

-- ══ sinal de interesse do comprador (fase sem pagamento real) ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000006','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='pc-games'),'Console retro','Console retro funcionando','good',10000,10000,'pickup','São Paulo','SP','console-retro-interesse','active',now(),now()+interval '3 days');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select place_bid('a5150000-0000-0000-0000-000000000006',10000,'interest-bid-1');
select tests.root();
update listings set ends_at = now() - interval '1 second' where id='a5150000-0000-0000-0000-000000000006';
select close_due_auctions();
create temp table interest_order as select id from orders where listing_id='a5150000-0000-0000-0000-000000000006';
grant select on interest_order to authenticated;
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select confirm_buyer_interest((select id from interest_order),'34999990000')$$,'FORBIDDEN','só o comprador confirma interesse');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.throws($$select confirm_buyer_interest((select id from interest_order),'34999990000')$$,'FORBIDDEN','vendedor não confirma interesse do comprador');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select confirm_buyer_interest((select id from interest_order),'123')$$,'INVALID_WHATSAPP','whatsapp curto demais é recusado');
select tests.ok((select buyer_confirmed_interest_at is not null and buyer_whatsapp='34999990000' from confirm_buyer_interest((select id from interest_order),'(34) 99999-0000')),'comprador confirma interesse com whatsapp normalizado');
select tests.root();
select tests.ok((select count(*)=1 from notifications where user_id='5e000000-0000-0000-0000-000000000005' and title='Comprador confirmou interesse'),'vendedor é avisado para ter paciência');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select buyer_confirmed_interest_at is not null from confirm_buyer_interest((select id from interest_order),'34988880000')),'confirmar de novo é idempotente e ignora novo whatsapp');
select tests.root();
select tests.ok((select count(*)=1 from audit_log where action='buyer_confirmed_interest'),'confirmação de interesse vai para auditoria');
update orders set status='paid' where listing_id='a5150000-0000-0000-0000-000000000006';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select confirm_buyer_interest((select id from interest_order),'34999990000')$$,'INVALID_ORDER_STATE','só confirma interesse enquanto aguarda pagamento');
select tests.root();

-- ══ verificação de identidade: aprovação grava profiles e é auditável ══
select tests.root();
update profiles set role='admin' where id='a0000000-0000-0000-0000-00000000000a';
select tests.login('b0000000-0000-0000-0000-00000000000b');
insert into identity_verifications(user_id,document_path,selfie_path) values ('b0000000-0000-0000-0000-00000000000b','b/doc.webp','b/selfie.webp');
select tests.throws($$insert into identity_verifications(user_id,document_path,selfie_path) values ('b0000000-0000-0000-0000-00000000000b','b/doc2.webp','b/selfie2.webp')$$,'row-level security|permission denied','não reenvia enquanto está pendente');
select tests.throws($$select review_identity_verification((select id from identity_verifications where user_id='b0000000-0000-0000-0000-00000000000b'),true)$$,'FORBIDDEN','quem não é staff não revisa verificação');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select review_identity_verification((select id from identity_verifications where user_id='b0000000-0000-0000-0000-00000000000b'),true);
select tests.ok((select identity_verified_at is not null and seller_status='verified' from profiles where id='b0000000-0000-0000-0000-00000000000b'),'aprovação marca identidade verificada e seller_status');
select tests.ok((select status='approved' from identity_verifications where user_id='b0000000-0000-0000-0000-00000000000b'),'registro de verificação fica approved');
select tests.throws($$select review_identity_verification((select id from identity_verifications where user_id='b0000000-0000-0000-0000-00000000000b'),true)$$,'ALREADY_REVIEWED','não revisa a mesma verificação duas vezes');
select tests.root();
select tests.ok((select count(*)=1 from notifications where user_id='b0000000-0000-0000-0000-00000000000b' and title='Identidade verificada'),'usuário é avisado da aprovação');
select tests.ok((select count(*)=1 from audit_log where action='identity_verification_reviewed'),'revisão de identidade vai para auditoria');
update profiles set role='user' where id='a0000000-0000-0000-0000-00000000000a';

-- ══ limpeza apaga fotos do storage sem travar (regressão do bug em produção) ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000007','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='casa'),'Cadeira de teste','Cadeira para teste de limpeza','good',5000,5000,'pickup','São Paulo','SP','cadeira-limpeza-storage','draft',now()-interval '31 days',now()-interval '31 days');
insert into storage.objects(bucket_id,name) values ('listing-images','5e000000-0000-0000-0000-000000000005/a5150000-0000-0000-0000-000000000007/0.webp');
insert into listing_images(listing_id,storage_path,sort_order) values ('a5150000-0000-0000-0000-000000000007','5e000000-0000-0000-0000-000000000005/a5150000-0000-0000-0000-000000000007/0.webp',0);
update listings set status='cancelled' where id='a5150000-0000-0000-0000-000000000007';
select cleanup_expired_listings(3);
select tests.ok((select count(*)=0 from listings where id='a5150000-0000-0000-0000-000000000007'),'limpeza apaga leilão cancelado com foto sem travar no storage');
select tests.ok((select count(*)=1 from storage_purge_queue where bucket='listing-images' and path like '%a5150000-0000-0000-0000-000000000007%'),'limpeza enfileira a foto para remoção pela API do Storage');

-- ══ retenção configurável em app_config ══
update app_config set value='5' where key='listing_retention_days';
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000008','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='casa'),'Mesa de teste','Mesa para teste de retenção','good',5000,5000,'pickup','São Paulo','SP','mesa-retencao-config','cancelled',now()-interval '6 days',now()-interval '6 days');
select cleanup_expired_listings();
select tests.ok((select count(*)=0 from listings where id='a5150000-0000-0000-0000-000000000008'),'sem argumento, usa app_config.listing_retention_days');
update app_config set value='30' where key='listing_retention_days';

-- ══ resolução de disputa pela staff (antes disso, não existia nenhum jeito de resolver) ══
select tests.root();
update profiles set role='admin' where id='a0000000-0000-0000-0000-00000000000a';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'seller','Vendedor demonstrou boa-fé, item vendido no estado como anunciado')$$,'FORBIDDEN','quem não é staff não resolve disputa');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'other','nota qualquer com texto grande o bastante')$$,'INVALID_RESOLUTION','resolução só pode ser buyer ou seller');
select tests.throws($$select resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'seller','curta')$$,'NOTE_TOO_SHORT','justificativa precisa ter pelo menos 10 caracteres');
select tests.throws($$select resolve_dispute('00000000-0000-0000-0000-000000000000','seller','Justificativa com texto suficiente para passar na validação')$$,'NOT_FOUND','disputa inexistente');
select tests.ok((select status='resolved_seller' from resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'seller','Item vendido no estado, anúncio deixava claro o defeito, comprador aceitou as condições')),'staff resolve a favor do vendedor');
select tests.ok((select status='completed' from orders where listing_id='a5150000-0000-0000-0000-000000000001'),'pedido libera para o vendedor (completed)');
select tests.throws($$select resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000001'),'buyer','Nova tentativa de resolução depois de já resolvida')$$,'ALREADY_RESOLVED','não resolve disputa duas vezes');
select tests.root();
select tests.ok((select count(*)=1 from audit_log where action='dispute_resolved'),'resolução vai para auditoria');
select tests.ok((select count(*)=1 from notifications where user_id='5e000000-0000-0000-0000-000000000005' and title='Disputa resolvida a seu favor'),'vendedor é avisado');
select tests.ok((select count(*)=1 from notifications where user_id='a0000000-0000-0000-0000-00000000000a' and title='Disputa resolvida a favor do vendedor'),'comprador é avisado');

-- resolução a favor do comprador (reembolso)
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a5150000-0000-0000-0000-000000000009','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='casa'),'Liquidificador com defeito','Liquidificador usado, funcionando bem','good',8000,8000,'pickup','São Paulo','SP','liquidificador-disputa','active',now(),now()+interval '3 days');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select place_bid('a5150000-0000-0000-0000-000000000009',8000,'dispute-buyer-bid-1');
select tests.root();
update listings set ends_at = now() - interval '1 second' where id='a5150000-0000-0000-0000-000000000009';
select close_due_auctions();
update orders set status='paid' where listing_id='a5150000-0000-0000-0000-000000000009';
select tests.login('b0000000-0000-0000-0000-00000000000b');
insert into disputes(order_id,opened_by,reason,description) select id,'b0000000-0000-0000-0000-00000000000b','not_as_described','Motor não liga, diferente do anunciado como funcionando' from orders where listing_id='a5150000-0000-0000-0000-000000000009';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select status='resolved_buyer' from resolve_dispute((select d.id from disputes d join orders o on o.id=d.order_id where o.listing_id='a5150000-0000-0000-0000-000000000009'),'buyer','Vendedor não conseguiu comprovar funcionamento, reembolso ao comprador')),'staff resolve a favor do comprador');
select tests.ok((select status='refunded' from orders where listing_id='a5150000-0000-0000-0000-000000000009'),'pedido vai para reembolsado');
select tests.root();
update profiles set role='user' where id='a0000000-0000-0000-0000-00000000000a';

-- ══ IP do lance e sinal de possível lance falso (shill bidding) ══
select tests.root();
insert into listings(id,seller_id,category_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
values('a515000a-0000-0000-0000-000000000001','5e000000-0000-0000-0000-000000000005',(select id from categories where slug='casa'),'Cadeira antifraude','Cadeira para teste de sinal de fraude','good',5000,5000,'pickup','São Paulo','SP','cadeira-antifraude','active',now(),now()+interval '3 days');
select tests.login('a0000000-0000-0000-0000-00000000000a');
select set_config('request.headers','{"x-forwarded-for":"203.0.113.9"}',false);
select place_bid('a515000a-0000-0000-0000-000000000001',5200,'fraud-ip-bid-a');
select tests.ok((select ip_hash is not null from bids where listing_id='a515000a-0000-0000-0000-000000000001' and bidder_id='a0000000-0000-0000-0000-00000000000a'),'lance grava o hash do IP');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select set_config('request.headers','{"x-forwarded-for":"203.0.113.9"}',false);
select place_bid('a515000a-0000-0000-0000-000000000001',5700,'fraud-ip-bid-b');
select tests.root();
select tests.ok((select count(*)=1 from fraud_signals where kind='same_ip_bids_on_seller' and user_id='b0000000-0000-0000-0000-00000000000b'),'IP repetido no mesmo vendedor gera sinal de fraude');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*)=0 from fraud_signals),'sinal de fraude não é visível a usuário comum');
select tests.root();
update profiles set role='admin' where id='a0000000-0000-0000-0000-00000000000a';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*)>=1 from fraud_signals),'staff vê os sinais de fraude');
select tests.root();
update profiles set role='user' where id='a0000000-0000-0000-0000-00000000000a';
select set_config('request.headers','',false);

-- ══ rate limit: denúncia (10/hora) e chat do pedido (30/min) ══
select tests.login('b0000000-0000-0000-0000-00000000000b');
do $$ begin for i in 1..10 loop insert into reports(reporter_id,reason,details) values ('b0000000-0000-0000-0000-00000000000b','other','teste '||i); end loop; end $$;
select tests.throws($$insert into reports(reporter_id,reason,details) values ('b0000000-0000-0000-0000-00000000000b','other','uma denúncia a mais')$$,'RATE_LIMITED','limite de 10 denúncias por hora');
do $$ declare oid uuid; begin
  select id into oid from orders where listing_id='a5150000-0000-0000-0000-000000000009';
  for i in 1..30 loop perform send_order_message(oid,'mensagem '||i); end loop;
end $$;
select tests.throws($$select send_order_message(id,'mensagem a mais') from orders where listing_id='a5150000-0000-0000-0000-000000000009'$$,'RATE_LIMITED','limite de 30 mensagens por minuto no chat');
select tests.root();

-- ══ filtro de contato no chat (nível 1), registro e liberação após o pagamento ══
select tests.root();
delete from order_messages;
select tests.root();
select tests.ok(contact_pattern('34999998888')='phone','detecta telefone sem formatação');
select tests.ok(contact_pattern('(34) 99999-8888')='phone','detecta telefone com DDD e traço');
select tests.ok(contact_pattern('34 9 9999-8888')='phone','detecta telefone com espaços');
select tests.ok(contact_pattern('+55 34 99999999')='phone','detecta telefone com +55');
select tests.ok(contact_pattern('34988438834')='phone','detecta 11 dígitos seguidos');
select tests.ok(contact_pattern('349999O9888')='phone','detecta letra O no lugar do zero');
select tests.ok(contact_pattern('meu email é fulano@gmail.com')='email','detecta e-mail');
select tests.ok(contact_pattern('w h a t s a p p')='app','detecta whatsapp espaçado');
select tests.ok(contact_pattern('me chama no zap.zap')='app','detecta zap.zap');
select tests.ok(contact_pattern('chama no Zap')='app','detecta zap');
select tests.ok(contact_pattern('me chama no t3l3gram')='app','detecta telegram com número no lugar de letra');
select tests.ok(contact_pattern('o celular liga normal? qual o número de série?') is null,'não bloqueia celular/número em conversa normal');
select tests.ok(contact_pattern('faço por R$ 1.500,00 na entrega dia 25/09/2026') is null,'não bloqueia preço nem data');
select tests.ok(contact_pattern('a instalação do jogo é rápida') is null,'não bloqueia "instalação"');
select tests.ok(contact_pattern('IMEI 356938035643809') is null,'não bloqueia IMEI de 15 dígitos');

update orders set status='pending_payment' where listing_id='a5150000-0000-0000-0000-000000000009';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select (send_order_message(id,'me passa seu zap 34999998888')->>'code')='CONTACT_SHARING_BLOCKED' from orders where listing_id='a5150000-0000-0000-0000-000000000009'),'RPC bloqueia contato antes do pagamento sem lançar exceção');
select tests.ok((select (send_order_message(id,'oi, o liquidificador liga?')->>'ok')='true' from orders where listing_id='a5150000-0000-0000-0000-000000000009'),'RPC aceita mensagem normal antes do pagamento');
select tests.throws($$insert into order_messages(order_id,sender_id,body) select id,'b0000000-0000-0000-0000-00000000000b','oi' from orders where listing_id='a5150000-0000-0000-0000-000000000009'$$,'permission denied','cliente não insere mensagem direto');
select tests.ok((select count(*)=0 from chat_flagged_attempts),'usuário comum não vê tentativas registradas');
select tests.ok(((select get_order_counterparty(id) from orders where listing_id='a5150000-0000-0000-0000-000000000009')->>'released')='false','contraparte oculta antes do pagamento');
select tests.root();
select tests.ok((select count(*)=1 and min(pattern)='phone' from chat_flagged_attempts),'tentativa bloqueada foi registrada com o padrão');
select tests.ok((select count(*)=0 from order_messages where body like '%34999998888%'),'mensagem bloqueada não foi salva');
update profiles set role='admin' where id='a0000000-0000-0000-0000-00000000000a';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*)=1 from staff_list_chat_flags()),'equipe lista as tentativas');
select tests.root();
update profiles set role='user' where id='a0000000-0000-0000-0000-00000000000a';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.throws($$select * from staff_list_chat_flags()$$,'FORBIDDEN','usuário comum não usa a lista da equipe');
select tests.root();
update orders set status='paid' where listing_id='a5150000-0000-0000-0000-000000000009';
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select (send_order_message(id,'meu zap é 34999998888')->>'ok')='true' from orders where listing_id='a5150000-0000-0000-0000-000000000009'),'após o pagamento o chat é livre');
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.ok(((select get_order_counterparty(id) from orders where listing_id='a5150000-0000-0000-0000-000000000009')->>'released')='true','contraparte liberada após o pagamento');
select tests.ok(not ((select get_order_counterparty(id) from orders where listing_id='a5150000-0000-0000-0000-000000000009')::text ~* 'phone|email|cpf'),'contraparte não expõe telefone, e-mail ou CPF');
select tests.root();
select tests.ok(short_display_name('Maria da Silva Santos')='Maria S.','apelido público abrevia o sobrenome');
select tests.ok(short_display_name('Maria')='Maria','apelido de uma palavra não muda');

-- ══ disputa: provas, conversa a três e apagamento após 30 dias ══
select tests.root();
update orders set status = 'disputed' where listing_id = 'a5150000-0000-0000-0000-000000000009';
update disputes set status = 'open', resolved_at = null, resolved_by = null, resolution_note = null
  where order_id = (select id from orders where listing_id = 'a5150000-0000-0000-0000-000000000009');
select tests.login('b0000000-0000-0000-0000-00000000000b');
select tests.ok((select get_dispute_thread(o.id) is not null from orders o where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'comprador vê a disputa do pedido');
select tests.ok((select send_dispute_message(d.id, 'Segue foto do defeito') is true from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'comprador escreve na conversa da disputa');
select tests.throws($$insert into dispute_evidence(dispute_id, author_id, kind, storage_path) select d.id, 'b0000000-0000-0000-0000-00000000000b', 'image', 'outra-pasta/x.webp' from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'$$, 'INVALID_EVIDENCE_PATH', 'foto de prova só na própria pasta da disputa');
insert into dispute_evidence(dispute_id, author_id, kind, storage_path)
  select d.id, 'b0000000-0000-0000-0000-00000000000b', 'image', 'b0000000-0000-0000-0000-00000000000b/' || d.id || '/prova.webp'
  from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009';
select tests.login('5e000000-0000-0000-0000-000000000005');
select tests.ok((select send_dispute_message(d.id, 'Enviei conforme anunciado') is true from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'vendedor responde na conversa da disputa');
select tests.root();
select set_config('t.did', (select d.id::text from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), false);
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.throws($$select send_dispute_message(current_setting('t.did')::uuid, 'sou de fora')$$, 'FORBIDDEN', 'quem não é parte nem equipe não escreve na disputa');
select tests.root();
update profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-00000000000a';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select tests.ok((select send_dispute_message(d.id, 'Equipe analisando') is true from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'equipe entra na conversa da disputa');
select tests.ok((select jsonb_array_length(get_dispute_thread(o.id)->'messages') = 3 and jsonb_array_length(get_dispute_thread(o.id)->'evidence') = 1 from orders o where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'equipe vê 3 mensagens e 1 prova');
select tests.ok((select (resolve_dispute(d.id, 'seller', 'Item conforme anunciado, prova do vendedor')).status = 'resolved_seller' from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'), 'equipe decide a disputa');
select tests.throws($$select send_dispute_message(d.id, 'depois de encerrar') from disputes d join orders o on o.id = d.order_id where o.listing_id = 'a5150000-0000-0000-0000-000000000009'$$, 'DISPUTE_CLOSED', 'disputa encerrada não recebe mensagens');
select tests.root();
update profiles set role = 'user' where id = 'a0000000-0000-0000-0000-00000000000a';
select tests.ok(purge_resolved_disputes() = 0, 'disputa recém-decidida ainda não é apagada');
update disputes set resolved_at = now() - interval '31 days' where order_id = (select id from orders where listing_id = 'a5150000-0000-0000-0000-000000000009');
select tests.ok(purge_resolved_disputes() = 1, 'disputa decidida há mais de 30 dias é apagada');
select tests.ok((select count(*) = 0 from dispute_messages where dispute_id = current_setting('t.did')::uuid) and (select count(*) = 0 from dispute_evidence where dispute_id = current_setting('t.did')::uuid), 'mensagens e provas foram apagadas');
select tests.ok((select count(*) = 1 from storage_purge_queue where bucket = 'dispute-evidence'), 'arquivo da prova entrou na fila de remoção do Storage');
select tests.ok(purge_resolved_disputes() = 0, 'apagamento é idempotente');

select 'TESTES DE FUNCIONALIDADES: OK' as resultado;
