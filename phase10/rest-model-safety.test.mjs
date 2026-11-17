import test from 'node:test';
import assert from 'node:assert/strict';
import {augmentWithRest} from './rest-model.mjs';
const base={game_id:'g1',season:2025,gameday:'2025-09-14',home_team:'A',away_team:'B',home_win_probability:0.6};
const feature={game_id:'g1',season:2025,gameday:'2025-09-14',home_team:'A',away_team:'B',rest_days_edge:3};
test('final outcomes cannot affect pregame rest probabilities',()=>{
 const a=augmentWithRest([{...base,home_score:10,away_score:3,home_win:1}],[feature])[0];
 const b=augmentWithRest([{...base,home_score:3,away_score:10,home_win:0}],[feature])[0];
 assert.equal(a.home_win_probability,b.home_win_probability);
 assert.equal(a.rest_logit_adjustment,b.rest_logit_adjustment);
});
test('rest features join by game ID regardless of row order',()=>{
 const second={...base,game_id:'g2',home_team:'C',away_team:'D',home_win_probability:0.4};
 const secondFeature={...feature,game_id:'g2',home_team:'C',away_team:'D',rest_days_edge:-2};
 const a=augmentWithRest([base,second],[feature,secondFeature]);
 const b=augmentWithRest([second,base],[secondFeature,feature]);
 assert.equal(a[0].home_win_probability,b[1].home_win_probability);
 assert.equal(a[1].home_win_probability,b[0].home_win_probability);
});
test('missing feature row preserves original probability and records missingness',()=>{
 const a=augmentWithRest([base],[])[0];
 assert.equal(a.home_win_probability,base.home_win_probability);
 assert.equal(a.rest_features_used,0);
 assert.equal(a.rest_logit_adjustment,0);
});
test('rejects nonfinite, out-of-range, and duplicate prediction inputs',()=>{
 for(const probability of [0,1,-0.1,1.1,NaN,Infinity])
  assert.throws(()=>augmentWithRest([{...base,home_win_probability:probability}],[feature]),/Invalid base probability/);
 assert.throws(()=>augmentWithRest([base,base],[feature]),/Duplicate/);
});
