import test from 'node:test';import assert from 'node:assert/strict';import {holdout} from './holdout.mjs';
const g=(id,season,p,h=20,a=10)=>({game_id:id,season:String(season),home_win_probability:String(p),home_score:String(h),away_score:String(a)});
test('excludes all seasons before test boundary',()=>{const x=holdout([g('a',2022,.01),g('b',2023,.8),g('c',2024,.6)],{firstTestSeason:2023});assert.equal(x.holdout.games,2);assert.equal(x.holdout.accuracy,1);assert.equal(x.holdout.high_confidence_games,1)});
test('reports no high-confidence accuracy when none selected',()=>{const x=holdout([g('a',2024,.6)]);assert.equal(x.holdout.high_confidence_accuracy,null)});
test('rejects duplicate predictions',()=>assert.throws(()=>holdout([g('a',2024,.6),g('a',2024,.7)]),/duplicate/));
test('requires held-out games',()=>assert.throws(()=>holdout([g('a',2022,.6)]),/No held-out/));
