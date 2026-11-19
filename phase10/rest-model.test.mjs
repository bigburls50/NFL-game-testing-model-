import test from 'node:test';import assert from 'node:assert/strict';import {augmentWithRest} from './rest-model.mjs';
const p={game_id:'g1',season:2025,gameday:'2025-09-14',home_team:'A',away_team:'B',home_win_probability:0.6};
const f={game_id:'g1',season:2025,gameday:'2025-09-14',home_team:'A',away_team:'B',rest_days_edge:3};
test('positive and negative rest edge adjust in opposite directions',()=>{const a=augmentWithRest([p],[f])[0];const b=augmentWithRest([p],[{...f,rest_days_edge:-3}])[0];assert.ok(a.home_win_probability>.6);assert.ok(b.home_win_probability<.6)});
test('unknown rest leaves probability unchanged',()=>{const r=augmentWithRest([p],[{...f,rest_days_edge:''}])[0];assert.equal(r.home_win_probability,.6);assert.equal(r.rest_features_used,0)});
test('mismatched game date is rejected',()=>assert.throws(()=>augmentWithRest([p],[{...f,gameday:'2025-09-15'}]),/mismatch/));
test('duplicate rest rows are rejected',()=>assert.throws(()=>augmentWithRest([p],[f,f]),/Duplicate/));
test('extreme rest edge is rejected',()=>assert.throws(()=>augmentWithRest([p],[{...f,rest_days_edge:29}]),/Invalid rest edge/));
test('clipping limits adjustment',()=>assert.equal(augmentWithRest([p],[{...f,rest_days_edge:20}],{maxEdge:7})[0].rest_logit_adjustment,0.24500000000000002));
