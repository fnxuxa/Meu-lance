#!/usr/bin/env bash
# Corrida real: várias conexões dando lance ao mesmo tempo no mesmo leilão.
set -euo pipefail
DB="${DB:-meulance_test}"
Q="psql -X -q -At -v ON_ERROR_STOP=0 -d $DB"
$Q <<'SQL' >/dev/null
insert into auth.users(id,email,raw_user_meta_data) select ('d000000' || i || '-0000-0000-0000-0000000000d' || i)::uuid, 'c'||i||'@x.com', jsonb_build_object('display_name','User'||i) from generate_series(1,6) i;
insert into public.listings(id,seller_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at,declaration_accepted_at)
values ('99999999-9999-9999-9999-999999999999','5e000000-0000-0000-0000-000000000005','Corrida','x','good',100000,100000,'both','SP','SP','corrida','active',now(),now()+interval '2 days',now());
SQL
ok=0
for i in 1 2 3 4 5 6; do
  (
    amount=$((100000 + i * 3000))
    out=$($Q -c "select set_config('request.jwt.claim.sub','d000000${i}-0000-0000-0000-0000000000d${i}',false); set role authenticated; select current_price_cents from public.place_bid('99999999-9999-9999-9999-999999999999', ${amount}, 'race-key-${i}-xxxx')" 2>&1 | tail -1)
    echo "$i:$out"
  ) &
done | sort > /tmp/race_out.txt
wait
cat /tmp/race_out.txt
FINAL=$($Q -c "select current_price_cents||','||bid_count from public.listings where id='99999999-9999-9999-9999-999999999999'")
MAXBID=$($Q -c "select max(amount_cents) from public.bids where listing_id='99999999-9999-9999-9999-999999999999'")
COUNT=$($Q -c "select count(*) from public.bids where listing_id='99999999-9999-9999-9999-999999999999'")
LEADER=$($Q -c "select b.bidder_id = l.bidder_id from public.bids b join public.auction_leaders l on l.listing_id=b.listing_id where b.listing_id='99999999-9999-9999-9999-999999999999' and b.amount_cents=(select max(amount_cents) from public.bids where listing_id=b.listing_id)")
DEC=$($Q -c "select count(*) from (select amount_cents, lag(amount_cents) over (order by sequence_no) p from public.bids where listing_id='99999999-9999-9999-9999-999999999999') x where p is not null and amount_cents < p")
echo "estado final: $FINAL | maior lance: $MAXBID | lances gravados: $COUNT | líder=maior lance: $LEADER | quedas de preço: $DEC"
PRICE="${FINAL%%,*}"; BC="${FINAL##*,}"
[ "$PRICE" = "$MAXBID" ] && [ "$BC" = "$COUNT" ] && [ "$LEADER" = "t" ] && [ "$DEC" = "0" ] || { echo "FALHOU: estado inconsistente após corrida"; exit 1; }
echo "ok - concorrência: 6 lances simultâneos deixaram estado consistente"
