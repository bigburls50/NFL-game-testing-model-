#!/usr/bin/env node
// Expanding-window, prior-season-only probability recalibration.
// Experimental: training predictions must themselves be out-of-sample; otherwise
// this is not an unbiased prospective estimate.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
import {calibration} from './calibration-diagnostics.mjs';
const sigmoid=x=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
const logit=p=>Math.log(p/(1-p));
export function walkForward(rows,{firstTestSeason=2023,minTrainingGames=200,iterations=300,learningRate=.03}={}){
 if(!Number.isInteger(firstTestSeason)||!Number.isInteger(minTrainingGames)||minTrainingGames<1||!Number.isInteger(iterations)||iterations<1||!(learningRate>0&&learningRate<=1))throw Error('Invalid settings');
 const ids=new Set(),data=rows.map(r=>{
  if([r.season,r.home_win_probability,r.home_score,r.away_score].some(v=>v===null||v===undefined||String(v).trim()===''))throw Error('Missing season, probability or final score');
  const season=Number(r.season),p=Number(r.home_win_probability),h=Number(r.home_score),a=Number(r.away_score);
  if(!r.game_id||ids.has(r.game_id)||!Number.isInteger(season)||!(p>0&&p<1)||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h===a)throw Error('Invalid/duplicate record');
  ids.add(r.game_id);return {...r,season,p,y:Number(h>a)};
 });
 const years=[...new Set(data.map(r=>r.season))].filter(s=>s>=firstTestSeason).sort((a,b)=>a-b);
 const predictions=[],folds=[];
 for(const season of years){
  // Canonical ordering avoids floating-point accumulation differences when CSV rows are shuffled.
  const train=data.filter(r=>r.season<season).sort((a,b)=>String(a.game_id).localeCompare(String(b.game_id)));
  const test=data.filter(r=>r.season===season).sort((a,b)=>String(a.game_id).localeCompare(String(b.game_id)));
  if(train.length<minTrainingGames){folds.push({season,status:'skipped_insufficient_prior_seasons',training_games:train.length,test_games:test.length});continue}
  // Two-parameter logistic calibration; deterministic full-batch gradient descent.
  // Initialize identity calibration and fit ONLY on earlier seasons.
  let a=0,b=1;
  for(let k=0;k<iterations;k++){
   let da=0,db=0;
   for(const r of train){const x=logit(r.p),err=sigmoid(a+b*x)-r.y;da+=err;db+=err*x}
   a-=learningRate*da/train.length;b-=learningRate*db/train.length;
  }
  for(const r of test)predictions.push({...r,home_win_probability:sigmoid(a+b*logit(r.p)),training_last_season:Math.max(...train.map(t=>t.season)),training_games:train.length});
  folds.push({season,status:'evaluated',training_games:train.length,training_last_season:Math.max(...train.map(t=>t.season)),test_games:test.length,intercept:a,slope:b});
 }
 if(!predictions.length)throw Error('No eligible walk-forward folds');
 const evaluatedIds=new Set(predictions.map(r=>r.game_id));
 const original=data.filter(r=>evaluatedIds.has(r.game_id)).map(r=>({...r,home_win_probability:r.p}));
 const originalReport=calibration(original),calibratedReport=calibration(predictions);
 return {folds,predictions,report:calibratedReport,original_report:originalReport,comparison:{games:predictions.length,brier_change:calibratedReport.brier-originalReport.brier,log_loss_change:calibratedReport.log_loss-originalReport.log_loss,accuracy_change:calibratedReport.accuracy-originalReport.accuracy,high_confidence_coverage_change:calibratedReport.high_confidence_coverage-originalReport.high_confidence_coverage,original_high_confidence_games:originalReport.high_confidence_games,calibrated_high_confidence_games:calibratedReport.high_confidence_games,original_high_confidence_accuracy:originalReport.high_confidence_accuracy,calibrated_high_confidence_accuracy:calibratedReport.high_confidence_accuracy,original_high_confidence_95ci:originalReport.high_confidence_95ci,calibrated_high_confidence_95ci:calibratedReport.high_confidence_95ci,high_confidence_accuracy_change:calibratedReport.high_confidence_accuracy===null||originalReport.high_confidence_accuracy===null?null:calibratedReport.high_confidence_accuracy-originalReport.high_confidence_accuracy},warning:'Experimental expanding-window calibration. Fits only earlier-season predictions; input predictions must be generated out-of-sample with point-in-time features. Do not treat this as prospective validation.'};
}
if(process.argv[1]?.endsWith('walk-forward-calibration.mjs')){try{
 const [input,output='phase10/data/walk-forward-predictions.csv',first='2023']=process.argv.slice(2);
 if(!input)throw Error('Usage: walk-forward-calibration.mjs predictions.csv [output.csv] [first-test-season]');
 const r=walkForward(parseCSV(fs.readFileSync(input,'utf8')),{firstTestSeason:Number(first)});
 const columns=['game_id','season','home_team','away_team','home_score','away_score','home_win_probability','training_last_season','training_games'];
 const esc=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
 fs.writeFileSync(output,[columns.join(','),...r.predictions.map(p=>columns.map(k=>esc(p[k])).join(','))].join('\n')+'\n');
 console.log(JSON.stringify({folds:r.folds,report:r.report,original_report:r.original_report,comparison:r.comparison,warning:r.warning},null,2));
}catch(e){console.error(e.message);process.exitCode=1}}
