import {readFile,readdir,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import EmbeddedPostgres from 'embedded-postgres';

// Diretório exclusivo dentro do projeto, sem apagar banco existente.
const root=resolve('.test-db');await mkdir(root,{recursive:true});
const dir=await mkdtemp(resolve(root,'run-'));
const port=await new Promise((res,rej)=>{const s=createServer();s.on('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p))})});
const pg=new EmbeddedPostgres({databaseDir:dir,user:'postgres',password:randomUUID(),port,persistent:true,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1','-c','wal_level=logical'],onLog:()=>{},onError:()=>{}});
let client,passed=0,failed=false;
try{
 await pg.initialise();await pg.start();client=pg.getPgClient('postgres','127.0.0.1');await client.connect();
 client.on('notice',n=>{if(n.message.startsWith('ok -'))passed++});
 async function run(path){console.log(path);await client.query((await readFile(path,'utf8')).replace(/^\\set.*$/gm,''))}
 await run('supabase/tests/00_supabase_stub.sql');
 for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await run('supabase/migrations/'+f);
 await run('supabase/seed.sql');await run('supabase/tests/database.sql');await run('supabase/tests/regressions.sql');
 const auction='99999999-9999-9999-9999-999999999999';
 await client.query(`insert into auth.users(id,email,raw_user_meta_data) select ('d000000'||i||'-0000-0000-0000-0000000000d'||i)::uuid,'c'||i||'@x.com',jsonb_build_object('display_name','User'||i) from generate_series(1,6)i;
 insert into listings(id,seller_id,title,description,condition,start_price_cents,current_price_cents,delivery_mode,city,state,slug,status,starts_at,ends_at)
 values('${auction}','5e000000-0000-0000-0000-000000000005','Concorrência','Teste paralelo','good',100000,100000,'both','SP','SP','race-native','active',now(),now()+interval '1 day')`);
 const results=await Promise.all(Array.from({length:6},async(_,i)=>{
  const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();
  try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",['d000000'+(i+1)+'-0000-0000-0000-0000000000d'+(i+1)]);await c.query('set role authenticated');await c.query('select place_bid($1,$2,$3)',[auction,103000+i*3000,'native-race-'+i]);return 'accepted';}
  catch(e){if(!e.message.includes('BID_TOO_LOW'))throw e;return 'outbid';}finally{await c.end()}
 }));
 assert.ok(results.includes('accepted'));
 const {rows:[state]}=await client.query(`select current_price_cents,bid_count,(select count(*) from bids where listing_id=l.id) count,(select max(amount_cents) from bids where listing_id=l.id) maximum from listings l where id=$1`,[auction]);
 assert.equal(Number(state.current_price_cents),118000);assert.equal(Number(state.maximum),118000);assert.equal(Number(state.count),state.bid_count);
 const{rows:[leader]}=await client.query('select bidder_id from auction_leaders where listing_id=$1',[auction]);assert.equal(leader.bidder_id,'d0000006-0000-0000-0000-0000000000d6');
 // Mesmo lance simultâneo: duas conexões, uma única gravação.
 const retry=async()=>{const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();try{await c.query("select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-00000000000a',false);set role authenticated");return await c.query('select place_bid($1,120000,$2)',[auction,'same-request-parallel'])}finally{await c.end()}};
 await Promise.all([retry(),retry()]);
 const{rows:[duplicates]}=await client.query("select count(*) from bids where listing_id=$1 and amount_cents=120000",[auction]);assert.equal(Number(duplicates.count),1);
 console.log('PostgreSQL nativo: '+passed+' assertivas SQL + concorrência (6 conexões) + retry simultâneo: OK.');
}catch(e){console.error(e.message,e.detail??'',e.hint??'',e.where??'');failed=true;}
finally{if(client)await client.end();await pg.stop();if(failed)process.exitCode=1;}

