#!/usr/bin/env node
// Descriptive calibration only: never fit or choose thresholds on evaluation seasons.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
import {wilson} from './season-compare.mjs';
export function calibration(rows,{bins=10,threshold=.75}={}){
 if(!Number.isInteger(bins)||bins<2||bins>100||!(threshold>.5&&threshold<1))throw Error('Invalid calibration settings');
 const seen=new Set(),groups=Array.from({length:bins},(_,i)=>({lower:i/bins,upper:(i+1)/bins,n:0,probability_sum:0,wins:0,brier_sum:0}));
 let correct=0,brier=0,loss=0,selected=0,selectedCorrect=0;
 for(const r of rows){
  const p=Number(r.home_win_probability),h=Number(r.home_score),a=Number(r.away_score);
  if(!r.game_id||seen.has(r.game_id)||!Number.isFinite(p)||!(p>0&&p<1)||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h===a)throw Error('Invalid or duplicate game');
  seen.add(r.game_id);const y=Number(h>a),hit=Number((p>=.5)===Boolean(y)),q=groups[Math.min(bins-1,Math.floor(p*bins))];
  q.n++;q.probability_sum+=p;q.wins+=y;q.brier_sum+=(p-y)**2;
  correct+=hit;brier+=(p-y)**2;loss-=y*Math.log(p)+(1-y)*Math.log(1-p);
  if(Math.max(p,1-p)>=threshold){selected++;selectedCorrect+=hit}
 }
 const n=rows.length;if(!n)throw Error('No predictions');
 const result=groups.map(({lower,upper,n,probability_sum,wins,brier_sum})=>({lower,upper,count:n,mean_probability:n?probability_sum/n:null,observed_home_win_rate:n?wins/n:null,home_win_95ci:wilson(wins,n),brier:n?brier_sum/n:null}));
 const ece=result.reduce((s,q)=>s+(q.count/n)*(q.count?Math.abs(q.mean_probability-q.observed_home_win_rate):0),0);
 return {games:n,bins,threshold,accuracy:correct/n,accuracy_95ci:wilson(correct,n),brier:brier/n,log_loss:loss/n,expected_calibration_error:ece,high_confidence_games:selected,high_confidence_coverage:selected/n,high_confidence_accuracy:selected?selectedCorrect/selected:null,high_confidence_95ci:wilson(selectedCorrect,selected),calibration:result,warning:'Descriptive fixed-bin retrospective calibration only. No model fitting, threshold optimization, prospective validation, or betting-profit claim.'};
}
if(process.argv[1]?.endsWith('calibration-diagnostics.mjs')){try{const file=process.argv[2];if(!file)throw Error('Usage: calibration-diagnostics.mjs predictions.csv');console.log(JSON.stringify(calibration(parseCSV(fs.readFileSync(file,'utf8'))),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
