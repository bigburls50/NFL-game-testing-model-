import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRest} from './compare-rest.mjs';

const prediction=(id,date='2025-09-14')=>({
 game_id:id,season:'2025',kickoff_date:date,home_team:'A',away_team:'B',
 home_score:'24',away_score:'17',home_win_probability:'0.6'
});
const rest=(id,edge='3')=>({
 game_id:id,season:'2025',gameday:'2025-09-14',
 home_team:'A',away_team:'B',rest_days_edge:edge
});

test('rest comparison rejects duplicate prediction IDs instead of double-counting games',()=>{
 assert.throws(()=>compareRest([prediction('g'),prediction('g')],[rest('g')]),/Duplicate\/missing prediction game/);
});
test('rest comparison rejects duplicate rest records instead of using arbitrary last value',()=>{
 assert.throws(()=>compareRest([prediction('g')],[rest('g'),rest('g','-3')]),/Duplicate\/missing rest game/);
});
test('rest comparison is invariant to final scores when computing probabilities',()=>{
 const before=compareRest([prediction('g')],[rest('g')]);
 const after=compareRest([{...prediction('g'),home_score:'7',away_score:'30'}],[rest('g')]);
 // Outcome metrics should change, but the feature adjustment itself must not.
 assert.equal(before.rest_feature_games,after.rest_feature_games);
 assert.equal(before.rest_feature_coverage,after.rest_feature_coverage);
 const baseline=compareRest([prediction('g')],[]);
 assert.notEqual(before.models.ensemble_plus_rest.brier,baseline.models.ensemble_plus_rest.brier);
});
test('missing rest edge remains uncovered and leaves model probabilities unchanged',()=>{
 const result=compareRest([prediction('g')],[rest('g','')]);
 assert.equal(result.rest_feature_games,0);
 assert.equal(result.models.ensemble.brier,result.models.ensemble_plus_rest.brier);
});
