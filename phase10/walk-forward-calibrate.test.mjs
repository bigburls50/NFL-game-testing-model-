import test from 'node:test';
import assert from 'node:assert/strict';
import {walkForwardCalibrate} from './walk-forward-calibrate.mjs';
const row=(id,season,p,y)=>({game_id:String(id),season,home_win_probability:p,home_score:y?21:14,away_score:y?14:21});
const base=Array.from({length:40},(_,i)=>row(i,2021+i%2,i%3===0?.8:.2,i%3===0));
test('expanding folds train only on earlier seasons',()=>{
 const rows=[...base,row(41,2023,.8,1),row(42,2024,.3,0)];
 const result=walkForwardCalibrate(rows,{minTrain:20});
 assert.equal(result.folds.length,2);
 assert.equal(result.folds[0].train_games,40);
 assert.equal(result.folds[1].train_games,41);
 assert.equal(result.raw.games,2);
});
test('future outcomes cannot change earlier calibrated predictions',()=>{
 const rows=[...base,row(41,2023,.8,1),row(42,2024,.3,0)];
 const changed=rows.map(r=>r.game_id==='42'?{...r,home_score:21,away_score:14}:r);
 const a=walkForwardCalibrate(rows,{minTrain:20});
 const b=walkForwardCalibrate(changed,{minTrain:20});
 assert.deepEqual(a.folds[0].parameters,b.folds[0].parameters);
 assert.equal(a.folds[0].predictions[0].calibrated,b.folds[0].predictions[0].calibrated);
});
test('reject duplicate games and invalid probabilities',()=>{
 assert.throws(()=>walkForwardCalibrate([...base,base[0],row(41,2023,.8,1)],{minTrain:20}),/Invalid or duplicate/);
 assert.throws(()=>walkForwardCalibrate([...base,row(41,2023,1,1)],{minTrain:20}),/Invalid or duplicate/);
});
test('reject inadequate historical training',()=>{
 assert.throws(()=>walkForwardCalibrate([...base,row(41,2023,.8,1)],{minTrain:100}),/Insufficient/);
});
test('scores bounded and confidence subset reported',()=>{
 const result=walkForwardCalibrate([...base,row(41,2023,.8,1)],{minTrain:20});
 assert.ok(result.calibrated.brier>=0&&result.calibrated.brier<=1);
 assert.ok(Number.isFinite(result.calibrated.log_loss));
 assert.ok(result.calibrated.high_confidence_coverage>=0);
});
