import test from 'node:test';
import assert from 'node:assert/strict';
import {walkForward} from './walk-forward-calibration.mjs';
const rows=[];
for(let season=2021;season<=2024;season++)for(let i=0;i<8;i++)rows.push({game_id:season+'-'+i,season,home_score:i%2?14:24,away_score:i%2?21:17,home_win_probability:i%2?.35:.65});
test('each fold trains exclusively on earlier seasons',()=>{
 const r=walkForward(rows,{firstTestSeason:2022,minTrainingGames:8,iterations:20});
 assert.deepEqual(r.folds.map(f=>f.training_games),[8,16,24]);
 assert.equal(r.predictions.length,24);
 for(const p of r.predictions)assert.ok(p.training_last_season<p.season);
 assert.equal(r.report.games,24);
 assert.ok(Number.isFinite(r.report.brier));
});
test('future data cannot alter past-season calibrated probabilities',()=>{
 const options={firstTestSeason:2022,minTrainingGames:8,iterations:20};
 const a=walkForward(rows,options).predictions.filter(p=>p.season===2022);
 const altered=rows.map(r=>r.season>=2023?{...r,home_score:100,away_score:0}:r);
 const b=walkForward(altered,options).predictions.filter(p=>p.season===2022);
 assert.deepEqual(a,b);
});
test('reject duplicate games and insufficient prior training',()=>{
 assert.throws(()=>walkForward([...rows,rows[0]],{minTrainingGames:8}),/duplicate/);
 assert.throws(()=>walkForward(rows,{firstTestSeason:2021,minTrainingGames:100}),/No eligible/);
});
