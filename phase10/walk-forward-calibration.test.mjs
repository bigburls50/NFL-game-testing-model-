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

test('holdout outcomes never influence their own season probabilities',()=>{
 const opts={firstTestSeason:2022,minTrainingGames:8,iterations:20};
 const original=walkForward(rows,opts).predictions.filter(p=>p.season===2023).map(p=>[p.game_id,p.home_win_probability]);
 const changed=rows.map(r=>r.season===2023?{...r,home_score:r.away_score+1,away_score:0}:r);
 const altered=walkForward(changed,opts).predictions.filter(p=>p.season===2023).map(p=>[p.game_id,p.home_win_probability]);
 assert.deepEqual(altered,original);
});
test('input row ordering does not change per-game calibrated probabilities',()=>{
 const opts={firstTestSeason:2022,minTrainingGames:8,iterations:20};
 const byId=r=>Object.fromEntries(r.predictions.map(p=>[p.game_id,p.home_win_probability]));
 assert.deepEqual(byId(walkForward([...rows].reverse(),opts)),byId(walkForward(rows,opts)));
});

test('heterogeneous probability gradients remain exactly invariant under shuffling',()=>{
 const mixed=[];
 for(let season=2019;season<=2024;season++)for(let i=0;i<41;i++)
  mixed.push({game_id:`${season}-${i}`,season,home_score:i%3===0?13:24,away_score:i%3===0?27:10,
   home_win_probability:0.01+0.98*((i*37+season*11)%101)/101});
 const opts={firstTestSeason:2021,minTrainingGames:40,iterations:60};
 const first=walkForward(mixed,opts);
 const shuffled=[...mixed].sort((a,b)=>b.game_id.localeCompare(a.game_id));
 const second=walkForward(shuffled,opts);
 assert.deepEqual(first.predictions,second.predictions);
 assert.deepEqual(first.folds,second.folds);
 // Floating-point reductions can differ by a few ULPs when input rows are shuffled.
 // Preserve exact checks for discrete metrics and a strict tolerance for scoring metrics.
 for(const key of Object.keys(first.comparison)){
  if(['brier_change','log_loss_change'].includes(key))
   assert.ok(Math.abs(first.comparison[key]-second.comparison[key])<1e-12,`${key} changed materially`);
  else assert.deepEqual(first.comparison[key],second.comparison[key]);
 }
});

test('paired report exposes high-confidence counts, uncertainty and null-safe accuracy deltas',()=>{
 const result=walkForward(rows,{firstTestSeason:2022,minTrainingGames:8,iterations:20});
 const {comparison:c,report:after,original_report:before}=result;
 assert.equal(c.original_high_confidence_games,before.high_confidence_games);
 assert.equal(c.calibrated_high_confidence_games,after.high_confidence_games);
 assert.deepEqual(c.original_high_confidence_95ci,before.high_confidence_95ci);
 assert.deepEqual(c.calibrated_high_confidence_95ci,after.high_confidence_95ci);
 assert.equal(c.original_high_confidence_accuracy,before.high_confidence_accuracy);
 assert.equal(c.calibrated_high_confidence_accuracy,after.high_confidence_accuracy);
 const expected=after.high_confidence_accuracy===null||before.high_confidence_accuracy===null
  ?null:after.high_confidence_accuracy-before.high_confidence_accuracy;
 assert.equal(c.high_confidence_accuracy_change,expected);
 assert.equal(c.games,after.games);
});
