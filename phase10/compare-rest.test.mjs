import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRest} from './compare-rest.mjs';
const p={game_id:'g',season:'2025',kickoff_date:'2025-09-14',home_team:'A',away_team:'B',home_score:'24',away_score:'17',home_win_probability:'0.6'};
const r={game_id:'g',season:'2025',gameday:'2025-09-14',home_team:'A',away_team:'B',rest_days_edge:'3'};
test('rest comparison preserves matched sample and reports coverage',()=>{
 const x=compareRest([p],[r]);assert.equal(x.common_games,1);assert.equal(x.rest_feature_coverage,1);
 assert.ok(x.models.ensemble_plus_rest.brier<x.models.ensemble.brier);
});
test('missing rest is not silently called covered',()=>{
 const x=compareRest([p],[]);assert.equal(x.rest_feature_coverage,0);
 assert.equal(x.models.ensemble_plus_rest.brier,x.models.ensemble.brier);
});
test('kickoff date mismatch fails closed',()=>assert.throws(()=>compareRest([p],[{...r,gameday:'2025-09-15'}]),/mismatch/));
test('missing kickoff date fails closed',()=>assert.throws(()=>compareRest([{...p,kickoff_date:''}],[r]),/kickoff_date/));
