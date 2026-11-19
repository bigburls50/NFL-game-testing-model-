import test from 'node:test';import assert from 'node:assert/strict';import {assessProvisionalPrediction} from './provisional-prediction-gate.mjs';
const game={game_id:'test',home_team:'Home',away_team:'Away',kickoff_utc:'2026-11-22T18:00:00Z'};
const now='2026-11-21T18:00:00Z';
const roster=['Home','Away'].map((team,i)=>({team,position:'QB',player_id:'00-123456'+i}));
const depthChart=roster.map(p=>({...p,depth_rank:1}));
const injuryReports=roster.map(p=>({team:p.team,source_verified:true,source_url:'https://github.com/nflverse/',retrieved_at_utc:now,report_updated_at_utc:now,players:[{player_id:p.player_id,game_status:'Available'}]}));
const prediction={home_win_probability:.62,model_version:'phase10-test',model_digest:'sha256:test',generated_at_utc:now};
test('requires actual model output and two complete preliminary team snapshots',()=>{assert.equal(assessProvisionalPrediction(game,{roster,depthChart,injuryReports,asOf:now}).status,'abstain');const ok=assessProvisionalPrediction(game,{prediction,roster,depthChart,injuryReports,asOf:now});assert.equal(ok.status,'provisional');assert.equal(ok.betting_status,'hold')});
test('rejects stale injury feed and unavailable projected quarterback',()=>{assert.equal(assessProvisionalPrediction(game,{prediction,roster,depthChart,injuryReports:[{...injuryReports[0],retrieved_at_utc:'2026-11-18T00:00:00Z'},injuryReports[1]],asOf:now}).status,'abstain');assert.equal(assessProvisionalPrediction(game,{prediction,roster,depthChart,injuryReports:injuryReports.map((r,i)=>i?{...r,players:[{player_id:roster[1].player_id,game_status:'Out'}]}:r),asOf:now}).status,'abstain')});
