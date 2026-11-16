import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonAudit} from './season-calibration.mjs';
const row=(id,season,p,h=20,a=10)=>({game_id:id,season,home_win_probability:p,home_score:h,away_score:a});
test('chronological season reports preserve counts and selection coverage',()=>{
 const r=seasonAudit([row('a',2022,.9),row('b',2023,.8),row('c',2024,.2,10,20),row('d',2024,.6,10,20)]);
 assert.deepEqual(r.years,[2023,2024]);assert.equal(r.combined.games,3);
 assert.equal(r.by_season['2023'].games,1);assert.equal(r.by_season['2024'].games,2);
 assert.equal(r.combined.high_confidence_games,2);
 assert.equal(r.combined.high_confidence_coverage,2/3);
 assert.equal(r.combined.high_confidence_accuracy,1);
 assert.ok(r.combined.high_confidence_95ci.lower<1);
});
test('reject duplicates, invalid seasons and missing holdout',()=>{
 assert.throws(()=>seasonAudit([row('a',2023,.6),row('a',2024,.7)]),/duplicate/);
 assert.throws(()=>seasonAudit([row('a','bad',.6)]),/season/);
 assert.throws(()=>seasonAudit([row('a',2022,.6)]),/No evaluation/);
 assert.throws(()=>seasonAudit([row('a',2023,1.5)]),/Invalid/);
});
