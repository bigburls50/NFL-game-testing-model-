import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {bestMoneylines} from './moneyline.mjs';

const request=new Request('https://example.test/api/odds');
const now=Date.now(), iso=offset=>new Date(now+offset).toISOString();
const game={id:'1',home_team:'Buffalo Bills',away_team:'Miami Dolphins',commence_time:iso(3600000)};
const book=(key,offset=-60000,outcomes=[{name:game.home_team,price:-160},{name:game.away_team,price:140}])=>({key,title:'Provider title',last_update:iso(offset),markets:[{key:'h2h',outcomes}]});

test('Cloudflare requests exact BetMGM Ontario key and rejects US, stale and incomplete quotes',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{
  const u=new URL(url);assert.equal(u.searchParams.get('regions'),'ca');assert.equal(u.searchParams.get('bookmakers'),'betmgm_ca_on');assert.equal(u.searchParams.get('markets'),'h2h');
  return Response.json([
   {...game,bookmakers:[book('betmgm'),book('betmgm_ontario'),book('betmgm_ca_on')]},
   {...game,id:'2',bookmakers:[book('betmgm_ca_on',-31*60000)]},
   {...game,id:'3',bookmakers:[book('betmgm_ca_on',-60000,[{name:game.home_team,price:-160}])]},
   {...game,id:'4',commence_time:iso(-3600000),bookmakers:[book('betmgm_ca_on')]}
  ]);
 });
 const response=await worker.fetch(request,{ODDS_API_KEY:'test-only'}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.bookmaker_key,'betmgm_ca_on');assert.equal(data.status,'available');assert.equal(data.quoted_games,1);assert.equal(data.games.length,3);
 assert.deepEqual(data.games[0].bookmakers.map(b=>b.key),['betmgm_ca_on']);assert.equal(data.games[0].bookmakers[0].title,'BetMGM Ontario');assert.equal(data.games[1].bookmakers.length,0);assert.equal(data.games[2].bookmakers.length,0);
 const prices=bestMoneylines({...game,kickoff_utc:game.commence_time},{games:[data.games[0]]},now);assert.equal(prices.home.price,-160);assert.equal(prices.away.bookKey,'betmgm_ca_on');
});

test('US-only response is never substituted for missing Ontario prices',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json([{...game,bookmakers:[book('betmgm')]}]));
 const res=await worker.fetch(request,{ODDS_API_KEY:'test-only'}),data=await res.json();assert.equal(data.status,'no_fresh_quotes');assert.equal(data.quoted_games,0);assert.deepEqual(data.games[0].bookmakers,[]);
});

test('missing API key fails closed rather than inventing prices',async()=>{
 const res=await worker.fetch(request,{});assert.equal(res.status,503);assert.match((await res.json()).error,/not configured/);
});
