import test from 'node:test';
import assert from 'node:assert/strict';
import {gateForecastInputs} from './forecast-input-gate.mjs';
const schedule=[{game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'}],asOf='2026-11-18T18:00:00Z';
const starter=team=>({game_id:'g',team,status:'confirmed',player_id:'id-'+team,player_name:'Test QB',confirmed_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z',source_url:'https://www.nfl.com/'});
test('verified starter reports alone never authorize a forecast',()=>{
 const r=gateForecastInputs(schedule,{starterReports:[starter('HOU'),starter('IND')],asOf});
 assert.equal(r.ready,false);assert.deepEqual(r.games[0].reasons,['unverified_injury_report','weather_unavailable']);
});
test('complete verified inputs allow model scoring but never invent probability',()=>{
 const r=gateForecastInputs(schedule,{starterReports:[starter('HOU'),starter('IND')],injuryAudit:{ready_for_forecast:true},weatherAudit:{forecast_rows:[{game_id:'g'}]},asOf});
 assert.equal(r.ready,true);assert.equal(r.games[0].decision,'eligible_for_model_scoring');assert.equal('probability' in r.games[0],false);
});
test('projected QB must abstain despite other data',()=>{
 const r=gateForecastInputs(schedule,{starterReports:[{...starter('HOU'),status:'projected'},starter('IND')],injuryAudit:{ready_for_forecast:true},weatherAudit:{forecast_rows:[{game_id:'g'}]},asOf});
 assert.equal(r.ready,false);assert.ok(r.games[0].reasons.includes('unconfirmed_starter'));
});
