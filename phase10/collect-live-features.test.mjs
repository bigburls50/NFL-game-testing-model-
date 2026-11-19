import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLiveFeatures,fetchJson} from './collect-live-features.mjs';
const schedule=[{game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'}];
const now='2026-11-18T18:00:00Z';
const base={game_id:'g',observed_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z'};
const qb=team=>({...base,team,player_id:'qb-'+team,player_name:'Fixture QB',prior_epa_per_dropback:.2,prior_dropbacks:90});
const injury=team=>({...base,team,player_id:'inj-'+team,player_name:'Fixture player',game_status:'questionable',report_date:'2026-11-18'});
const weather={...base,team:'HOU',venue_type:'indoor',wind_mph:0,temperature_f:70,precip_probability:0};
const payloads={qb:[qb('HOU'),qb('IND')],injury:[injury('HOU'),injury('IND')],weather:[weather]};
const sources=Object.fromEntries(Object.keys(payloads).map(k=>[k,'https://example.org/'+k]));
const fakeFetch=async url=>({ok:true,arrayBuffer:async()=>Buffer.from(JSON.stringify(payloads[url.split('/').at(-1)]))});
test('collector fetches and validates all three independently sourced feature categories',async()=>{
 const r=await collectLiveFeatures(schedule,{sources,fetchImpl:fakeFetch,asOf:now});
 assert.equal(r.ready,true);assert.equal(r.accepted.length,5);assert.equal(r.source_audit.length,3);
 assert.ok(r.source_audit.every(s=>s.digest.startsWith('sha256:')));
});
test('collector abstains with missing or failed provider',async()=>{
 const r=await collectLiveFeatures(schedule,{sources:{qb:sources.qb,weather:'https://example.org/fail'},fetchImpl:async url=>url.endsWith('/fail')?{ok:false,status:503}:fakeFetch(url),asOf:now});
 assert.equal(r.ready,false);assert.ok(r.source_audit.some(s=>s.status==='failed'));assert.ok(r.source_audit.some(s=>s.status==='unconfigured'));
});
test('collector rejects tokenized URLs and non-HTTPS URLs',async()=>{
 await assert.rejects(fetchJson('https://example.org/api?key=secret',{fetchImpl:fakeFetch}),/credential-free HTTPS/);
 await assert.rejects(fetchJson('http://example.org/api',{fetchImpl:fakeFetch}),/credential-free HTTPS/);
});
test('collector rejects source payloads that are not arrays',async()=>{
 const r=await collectLiveFeatures(schedule,{sources:{qb:sources.qb},fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from('{}')}),asOf:now});
 assert.equal(r.ready,false);assert.equal(r.source_audit[0].status,'failed');
});
