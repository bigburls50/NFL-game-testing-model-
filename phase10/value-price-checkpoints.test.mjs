import test from 'node:test';import assert from 'node:assert/strict';
import {createValueTrial} from './value-paper-trial.mjs';
import {createCheckpoint,needsCheckpoint,summarizeCheckpoints,verifyCheckpoint} from './value-price-checkpoints.mjs';
const kickoff='2026-11-20T01:15:00Z',start=Date.parse(kickoff)-6*3600000,late=Date.parse(kickoff)-2*3600000,digest='sha256:'+'a'.repeat(64),books=['betmgm_ca_on','betano_ca_on','betrivers_ca_on'];
const p={game_id:'2026_11_IND_HOU',home_team:'Houston Texans',away_team:'Indianapolis Colts',kickoff_utc:kickoff,model_version:'phase10-causal-logistic-v2',model_digest:digest,prediction_created_utc:new Date(start-1000).toISOString(),status:'provisional',home_win_probability:.75};
const model={model_metadata:{version:p.model_version,digest},predictions:[p]};
function market(now,price=-110){let last_update=new Date(now-1000).toISOString();return {status:'available',primary_bookmaker:'betmgm_ca_on',retrieved_at:last_update,source:'test',games:[{home_team:p.home_team,away_team:p.away_team,commence_time:kickoff,bookmakers:books.map((key,i)=>({key,title:key,last_update,outcomes:[{name:p.home_team,price:i===0?price:-150},{name:p.away_team,price:i===0?-110:130}]}))}]}}
const trial=createValueTrial(model,market(start),start);
test('checkpoint only when locked ticket is within four hours and still pregame',()=>{assert.equal(needsCheckpoint([trial],start),false);assert.equal(needsCheckpoint([trial],late),true);assert.equal(needsCheckpoint([trial],Date.parse(kickoff)),false);assert.equal(createCheckpoint([trial],market(Date.parse(kickoff)),Date.parse(kickoff)).games.length,0)});
test('latest fresh paired quote yields same-book and independently referenced price edges',()=>{
 const before=createCheckpoint([trial],market(late,-120),late),after=createCheckpoint([trial],market(late+3600000,-150),late+3600000);
 assert.ok(verifyCheckpoint(after));assert.equal(after.games.length,1);
 const s=summarizeCheckpoints([trial],[after,before]);const leg=trial.strategies.v2.tickets[0].legs[0],b=s.slates[trial.slate].v2[0].benchmark;
 assert.equal(b.minutes_before_kickoff,60);assert.equal(b.same_book_price_edge,leg.decimal/(1+100/150)-1);assert.ok(b.same_book_price_edge>0);assert.equal(s.summary.v2.benchmarked,1);assert.equal(s.summary.v2.positive_same_book,1);assert.ok(b.reference_fair_probability>0&&b.reference_fair_probability<1);assert.equal(s.real_money_stake,0);
});
test('missing, stale or non-Ontario quotes never fabricate a benchmark',()=>{
 const bad=market(late);bad.games[0].bookmakers[1].last_update=new Date(late-6*60000).toISOString();const c=createCheckpoint([trial],bad,late);assert.equal(c.games.length,0);const s=summarizeCheckpoints([trial],[c]);assert.equal(s.summary.v2.benchmarked,0);assert.equal(s.summary.v2.mean_same_book_price_edge,null);assert.throws(()=>createCheckpoint([trial],market(start),late),/fresh/);
 const missing=market(late);missing.games[0].bookmakers.pop();assert.equal(createCheckpoint([trial],missing,late).games.length,0);
});
test('altered archives rejected; empty benchmark leaves frozen ticket intact',()=>{const c=createCheckpoint([trial],market(late),late);assert.throws(()=>summarizeCheckpoints([trial],[{...c,captured_at_utc:kickoff}]),/integrity/);const before=JSON.stringify(trial);const s=summarizeCheckpoints([trial],[]);assert.equal(s.summary.v2.benchmarked,0);assert.equal(JSON.stringify(trial),before)});
