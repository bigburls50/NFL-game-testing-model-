import test from 'node:test';import assert from 'node:assert/strict';import {augmentWithEpa} from './epa-augmented.mjs';
const p={game_id:'g',season:'2025',home_team:'A',away_team:'B',home_win_probability:.6};
const f={game_id:'g',season:'2025',home_team:'A',away_team:'B',home_prior_games:6,away_prior_games:6,home_offense_epa_per_play:.3,away_offense_epa_per_play:-.1,home_defense_epa_allowed_per_play:-.1,away_defense_epa_allowed_per_play:.2,home_qb_epa_per_dropback:.2,away_qb_epa_per_dropback:-.1};
test('better home EPA increases probability',()=>{const x=augmentWithEpa([p],[f])[0];assert.ok(x.home_win_probability>.6);assert.equal(x.epa_features_used,1)});
test('missing features preserve base model',()=>{const x=augmentWithEpa([p],[])[0];assert.equal(x.home_win_probability,.6);assert.equal(x.epa_features_used,0)});
test('too few prior games preserves base model',()=>{const x=augmentWithEpa([p],[{...f,home_prior_games:1}])[0];assert.equal(x.home_win_probability,.6)});
test('rejects mismatched teams',()=>assert.throws(()=>augmentWithEpa([p],[{...f,away_team:'C'}]),/mismatch/));
test('missing values do not become zero',()=>{const x=augmentWithEpa([p],[{...f,home_offense_epa_per_play:'',home_qb_epa_per_dropback:''}])[0];assert.equal(x.epa_features_used,0)});

test('rejects mismatched kickoff dates when both sources provide dates',()=>{
 assert.throws(()=>augmentWithEpa([{...p,gameday:'2025-09-07'}],[{...f,gameday:'2025-09-14'}]),/mismatch/);
 assert.equal(augmentWithEpa([{...p,gameday:'2025-09-07'}],[{...f,gameday:'2025-09-07'}])[0].epa_features_used,1);
});
