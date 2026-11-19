import test from 'node:test';import assert from 'node:assert/strict';import {assessPregameEvidence} from './pregame-evidence-gate.mjs';
const game={game_id:'test',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
const roster=[{team:'HOU',position:'QB',player_id:'00-0031234',player_name:'Home QB'},{team:'IND',position:'QB',player_id:'00-0035678',player_name:'Away QB'}];
const depthChart=roster.map(p=>({...p,depth_rank:1}));
const injuries=['HOU','IND'].map(team=>({team,source_verified:true,retrieved_at_utc:'2026-11-19T18:00:00Z',players:[]}));
const options={roster,depthChart,injuries,retrievedAt:'2026-11-19T18:00:00Z',asOf:'2026-11-19T19:00:00Z'};
test('preliminary status is explicitly separate from confirmed',()=>{const r=assessPregameEvidence(game,options);assert.equal(r.decision,'preliminary_inputs_available');assert.equal(r.teams.HOU.projected_qb.status,'projected_not_confirmed')});
test('missing or unavailable QB causes abstain',()=>{assert.equal(assessPregameEvidence(game,{...options,depthChart:[]}).decision,'abstain');assert.equal(assessPregameEvidence(game,{...options,injuries:[{...injuries[0],players:[{player_id:'00-0031234',game_status:'Out'}]},injuries[1]]}).decision,'abstain')});
test('stale snapshot causes abstain',()=>assert.equal(assessPregameEvidence(game,{...options,asOf:'2026-11-21T19:00:00Z'}).decision,'abstain'));
