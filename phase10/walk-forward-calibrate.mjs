// Expanding-season probability calibration: fit on earlier seasons only.
// Input predictions must themselves have been generated without future data.
export function walkForwardCalibrate(rows,{firstTestSeason=2023,minTrain=100,threshold=.75}={}){
 if(!Number.isInteger(firstTestSeason)||!Number.isInteger(minTrain)||minTrain<1||!(threshold>.5&&threshold<1))throw Error('Invalid configuration');
 const seen=new Set(),data=[];
 for(const r of rows){
  const season=Number(r.season),p=Number(r.home_win_probability),h=Number(r.home_score),a=Number(r.away_score);
  if(!r.game_id||seen.has(r.game_id)||!Number.isInteger(season)||!(p>0&&p<1)||!Number.isInteger(h)||!Number.isInteger(a)||h===a)throw Error('Invalid or duplicate row');
  seen.add(r.game_id);data.push({id:r.game_id,season,p,y:Number(h>a)});
 }
 const seasons=[...new Set(data.map(r=>r.season))].filter(s=>s>=firstTestSeason).sort((a,b)=>a-b);
 if(!seasons.length)throw Error('No test seasons');
 const sigmoid=x=>1/(1+Math.exp(-Math.max(-35,Math.min(35,x))));
 const logit=p=>Math.log(p/(1-p));
 const output=[];
 for(const season of seasons){
  const train=data.filter(r=>r.season<season),test=data.filter(r=>r.season===season);
  if(train.length<minTrain)throw Error('Insufficient earlier-season training data for '+season);
  // Fit a two-parameter Platt/logistic calibration by deterministic batch gradient descent.
  let intercept=0,slope=1;
  for(let epoch=0;epoch<1200;epoch++){
   let ga=0,gb=0;
   for(const r of train){const x=Math.max(-8,Math.min(8,logit(r.p))),err=sigmoid(intercept+slope*x)-r.y;ga+=err;gb+=err*x}
   const rate=.12/Math.sqrt(1+epoch/100);
   intercept-=rate*ga/train.length;slope-=rate*gb/train.length;
  }
  const predictions=test.map(r=>({...r,calibrated:sigmoid(intercept+slope*Math.max(-8,Math.min(8,logit(r.p))))}));
  output.push({season,train_games:train.length,test_games:test.length,parameters:{intercept,slope},predictions});
 }
 const scored=output.flatMap(o=>o.predictions);
 const metrics=(key)=>{const n=scored.length,chosen=scored.filter(r=>Math.max(r[key],1-r[key])>=threshold);const acc=a=>a.length?a.filter(r=>Number(r[key]>=.5)===r.y).length/a.length:null;return {games:n,accuracy:acc(scored),brier:scored.reduce((s,r)=>s+(r[key]-r.y)**2,0)/n,log_loss:-scored.reduce((s,r)=>s+r.y*Math.log(Math.max(1e-15,r[key]))+(1-r.y)*Math.log(Math.max(1e-15,1-r[key])),0)/n,high_confidence_games:chosen.length,high_confidence_coverage:chosen.length/n,high_confidence_accuracy:acc(chosen)}};
 return {first_test_season:firstTestSeason,threshold,raw:metrics('p'),calibrated:metrics('calibrated'),folds:output,warning:'Calibration trained only on prior seasons, but input base-model predictions and feature snapshots must independently be proven leakage-free. Exploratory retrospective result; threshold must be frozen before prospective use.'};
}
