import test from 'node:test';import assert from 'node:assert/strict';import {audit} from './audit-seasons.mjs';
const row=(id,season,home,away,p,last)=>({game_id:id,season:String(season),home_score:String(home),away_score:String(away),home_win_probability:String(p),training_last_season:String(last)});
test('reports per-season metrics and always-home benchmark',()=>{const r=audit([row('a',2021,21,14,.7,2020),row('b',2021,7,14,.7,2020),row('c',2022,10,20,.3,2021)]);assert.equal(r.length,2);assert.equal(r[0].games,2);assert.equal(r[0].accuracy,.5);assert.equal(r[0].always_home_accuracy,.5);assert.equal(r[1].accuracy,1)});
test('rejects future or same-season training leakage',()=>assert.throws(()=>audit([row('a',2021,21,14,.6,2021)]),/leaking/));
test('rejects invalid probabilities',()=>assert.throws(()=>audit([row('a',2021,21,14,1,2020)]),/Invalid/));
