import test from 'node:test';import assert from 'node:assert/strict';import {eloPredict} from './elo.mjs';
const g=(id,date,season,home,away,hs,as)=>({game_id:id,gameday:date,season:String(season),home_team:home,away_team:away,home_score:String(hs),away_score:String(as)});
test('same-day games never influence each others predictions',()=>{const a=g('a','2024-09-10',2024,'A','B',40,0),b=g('b','2024-09-10',2024,'A','C',0,40);const p=eloPredict([a,b]);assert.equal(p[0].home_elo,1500);assert.equal(p[1].home_elo,1500)});
test('earlier game result changes later Elo',()=>{const p=eloPredict([g('a','2024-09-10',2024,'A','B',40,0),g('b','2024-09-17',2024,'A','B',10,7)]);assert.ok(p[1].home_elo>1500);assert.ok(p[1].home_win_probability>p[0].home_win_probability)});
test('input order does not affect predictions',()=>{const a=g('a','2024-09-10',2024,'A','B',40,0),b=g('b','2024-09-17',2024,'A','B',0,40);assert.deepEqual(eloPredict([b,a]),eloPredict([a,b]))});
test('rejects duplicates',()=>assert.throws(()=>eloPredict([g('a','2024-09-10',2024,'A','B',1,0),g('a','2024-09-17',2024,'A','B',1,0)]),/Duplicate/));
