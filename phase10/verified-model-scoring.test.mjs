import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreVerifiedGames} from './verified-model-scoring.mjs';
const schedule=[{game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'}],asOf='2026-11-18T18:00:00Z';
const starter=team=>({game_id:'g',team,status:'confirmed',player_id:'id-'+team,player_name:'Example QB',confirmed_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z',source_url:'https://www.nfl.com/'});
const inputs={starterReports:[starter('HOU'),starter('IND')],injuryAudit:{ready_for_forecast:true},weatherAudit:{forecast_rows:[{game_id:'g'}]},featuresByGame:{g:{asof_utc:'2026-11-18T17:00:00Z'}}};
test('missing confirmed starter abstains without invoking model',async()=>{
 let calls=0;const result=await scoreVerifiedGames(schedule,{...inputs,starterReports:[starter('HOU')]},{asOf,model:()=>{calls++;return {home_win_probability:.6}}});
 assert.equal(calls,0);assert.equal(result.games[0].status,'abstain');
});
test('verified inputs invoke fitted model and preserve provenance',async()=>{
 const result=await scoreVerifiedGames(schedule,inputs,{asOf,model:()=>({home_win_probability:.6,model_version:'v1',model_digest:'sha256:fixture'})});
 assert.equal(result.games[0].status,'research_prediction');assert.equal(result.coverage,1);
});
test('future model features cause abstention before model call',async()=>{
 const result=await scoreVerifiedGames(schedule,{...inputs,featuresByGame:{g:{asof_utc:'2026-11-20T02:00:00Z'}}},{asOf,model:()=>{throw Error('must not call')}});
 assert.equal(result.games[0].status,'abstain');
});
