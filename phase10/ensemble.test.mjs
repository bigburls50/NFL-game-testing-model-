import test from 'node:test';import assert from 'node:assert/strict';import {blend} from './ensemble.mjs';
const row=(p)=>({game_id:'g1',season:'2024',kickoff_date:'2024-09-01',home_team:'A',away_team:'B',home_score:'20',away_score:'10',home_win_probability:p});
test('fixed equal-weight average',()=>assert.equal(blend([row(.8)],[row(.6)])[0].home_win_probability,.7));
test('exclude games not in both models',()=>assert.equal(blend([row(.8)],[]).length,0));
test('reject mismatched results',()=>assert.throws(()=>blend([row(.8)],[{...row(.6),away_score:'11'}]),/mismatch/));
test('reject invalid probabilities',()=>assert.throws(()=>blend([row(.8)],[row(1.5)]),/probabilities/));
