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
select tests.ok((select count(*)=1 from notifications where user_id='b0000000-0000-0000-0000-00000000000b' and title='Novo leilão na sua busca salva'),'publicação avisa busca salva (sem acento casa com acento)');
select tests.ok((select count(*)=0 from notifications where user_id='5e000000-0000-0000-0000-000000000005' and title='Novo leilão na sua busca salva'),'vendedor não recebe alerta do próprio item');
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
select tests.ok((select count(*)=2 from notifications where user_id='b0000000-0000-0000-0000-00000000000b' and title='Novo leilão na sua busca salva'),'relançamento avisa busca salva de novo');
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

select 'TESTES DE FUNCIONALIDADES: OK' as resultado;
