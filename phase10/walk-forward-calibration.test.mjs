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

test('reject missing outcomes instead of treating blank CSV cells as zero scores',()=>{
 for(const field of ['home_score','away_score','season','home_win_probability']){
  for(const value of ['', '   ', null, undefined]){
   const corrupted=rows.map((r,i)=>i===0?{...r,[field]:value}:r);
   assert.throws(()=>walkForward(corrupted,{firstTestSeason:2022,minTrainingGames:8,iterations:20}),/Missing/);
  }
 }
});

test('original and calibrated metrics use identical eligible holdout games',()=>{
 const result=walkForward(rows,{firstTestSeason:2022,minTrainingGames:8,iterations:20});
 assert.equal(result.original_report.games,result.report.games);
 assert.equal(result.comparison.games,result.predictions.length);
 assert.equal(result.original_report.games,24);
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12);
 close(result.comparison.brier_change,result.report.brier-result.original_report.brier);
 close(result.comparison.log_loss_change,result.report.log_loss-result.original_report.log_loss);
 close(result.comparison.accuracy_change,result.report.accuracy-result.original_report.accuracy);
 close(result.comparison.high_confidence_coverage_change,result.report.high_confidence_coverage-result.original_report.high_confidence_coverage);
});
