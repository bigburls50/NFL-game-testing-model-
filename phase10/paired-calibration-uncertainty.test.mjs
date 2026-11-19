import test from 'node:test';import assert from 'node:assert/strict';import {pairedAudit} from './paired-calibration-uncertainty.mjs';
const row=(id,season,p)=>({game_id:id,season:String(season),home_team:'A',away_team:'B',home_score:'21',away_score:'14',home_win_probability:String(p)});
test('paired bootstrap deterministic and reports signed probability improvement',()=>{
 const a=[row('a',2023,.6),row('b',2024,.6)],b=[row('a',2023,.7),row('b',2024,.7)];
 const x=pairedAudit(a,b);assert.equal(x.games,2);assert.ok(x.delta.brier<0);assert.deepEqual(x,pairedAudit(a,b));
});
test('reject mismatched and incomplete pairs',()=>{
 assert.throws(()=>pairedAudit([row('a',2023,.6)],[row('b',2023,.7)]));
 assert.equal(pairedAudit([row('a',2022,.6),row('b',2023,.6)],[row('b',2023,.7)]).games,1);
});
