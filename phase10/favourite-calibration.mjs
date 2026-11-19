// Research-only symmetric favourite/underdog model; always fitted on completed earlier seasons.
import {scorePredictions} from './learned-matchup.mjs';
import {buildValueRecords,pickWeeklySingles,summarizeValueBets} from './value-research.mjs';
export const FAVOURITE_VERSION='phase10-favourite-calibration-research-v1';
const logit=p=>Math.log(p/(1-p)), sigmoid=z=>1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));
const valid=p=>Number.isFinite(p)&&p>0&&p<1;
// A slope adjustment learns whether market favourites are too short/long; a discrepancy term
// learns whether independent V2 disagreement helps. No intercept: pick'em is symmetric.
function inputs(m,v){const a=logit(m),d=logit(v)-a;return [a,d]}
export function adjustedProbability(m,v,weights){
 if(!valid(m)||!valid(v)||!Array.isArray(weights)||weights.length!==2||weights.some(w=>!Number.isFinite(w)))return null;
 const [a,d]=inputs(m,v);return sigmoid(a+weights[0]*a+weights[1]*d);
}
export function fitFavouriteCalibration(rows,{residual=true}={}){
 const train=rows.filter(r=>[0,1].includes(r.y)&&valid(r.market)&&valid(r.v2));if(train.length<100)throw Error('Insufficient prior-season data');
 const x=train.map(r=>({y:r.y,m:r.market,x:inputs(r.market,r.v2)}));let w=[0,0];
 // Fixed shrinkage towards unmodified market. Constrained independent weight avoids fitting
 // a spurious negative V2 signal; fixed iterations, no holdout-driven hyperparameter search.
 for(let i=0;i<500;i++){const grad=[0,0];for(const r of x){const d=sigmoid(logit(r.m)+w[0]*r.x[0]+w[1]*r.x[1])-r.y;grad[0]+=d*r.x[0];grad[1]+=d*r.x[1]}
  w=[Math.max(-.5,Math.min(.5,w[0]-.3*(grad[0]/x.length+.04*w[0]))),residual?Math.max(0,Math.min(.5,w[1]-.3*(grad[1]/x.length+.04*w[1]))):0];
 }
 return w;
}
export const FAVOURITE_BANDS=[['50–60%',.5,.6],['60–75%',.6,.75],['75–100%',.75,1]];
const keys=['v2','market','slope','residual'];
function summary(rows){
 const labelled=rows.filter(r=>r.y!==null),metrics=Object.fromEntries(keys.map(k=>[k,scorePredictions(labelled.map(r=>({p:r[k],y:r.y})))]));
 const bands=FAVOURITE_BANDS.map(([label,min,max])=>{const r=labelled.filter(g=>Math.max(g.market,1-g.market)>=min&&Math.max(g.market,1-g.market)<max);const actual=r.length?r.reduce((s,g)=>s+(g.market>=.5?g.y:1-g.y),0)/r.length:null;return {label,games:r.length,favourite_win_rate:actual,predicted_favourite:Object.fromEntries(keys.map(k=>[k,r.length?r.reduce((s,g)=>s+(g.market>=.5?g[k]:1-g[k]),0)/r.length:null])),metrics:Object.fromEntries(keys.map(k=>[k,scorePredictions(r.map(g=>({p:g[k],y:g.y})))]))}});
 const paper=Object.fromEntries(keys.map(k=>{const picks=pickWeeklySingles(rows,k),isDog=r=>r.side==='home'?r.market<.5:r.market>.5;return [k,{all:summarizeValueBets(picks),underdogs:summarizeValueBets(picks.filter(isDog)),favourites:summarizeValueBets(picks.filter(r=>!isDog(r)))}]}));
 return {games:rows.length,metrics,bands,paper};
}
export function evaluateFavouriteCalibration(schedule){
 const records=buildValueRecords(schedule),scored=[],weights_by_season={};
 for(let season=2023;season<=2026;season++){
  const prior=records.filter(r=>r.season<season),slope=fitFavouriteCalibration(prior,{residual:false}),residual=fitFavouriteCalibration(prior);
  weights_by_season[season]={slope,residual,training_games:prior.filter(r=>r.y!==null).length};
  for(const r of records.filter(r=>r.season===season))scored.push({...r,slope:adjustedProbability(r.market,r.v2,slope),residual:adjustedProbability(r.market,r.v2,residual)});
 }
 const development=summary(scored.filter(r=>r.season<=2024)),holdout=summary(scored.filter(r=>r.season>=2025));
 // Choose using development only, with market as an explicit no-change option. Holdout is not
 // used to select or refit the candidate. A gain on both proper scoring rules is required.
 const candidates=['slope','residual'].filter(k=>development.metrics[k].brier<development.metrics.market.brier&&development.metrics[k].log_loss<development.metrics.market.log_loss).sort((a,b)=>development.metrics[a].log_loss-development.metrics[b].log_loss);
 const selected=candidates[0]??'market';const passed=selected!=='market'&&holdout.metrics[selected].brier<holdout.metrics.market.brier&&holdout.metrics[selected].log_loss<holdout.metrics.market.log_loss;
 return {version:FAVOURITE_VERSION,weights_by_season,development_seasons:[2023,2024],holdout_seasons:[2025,2026],development,holdout,selected_on_development:selected,retrospective_gate:{passed,reason:passed?'Both proper scores improved on development and holdout; shadow research only.':'No preselected adjustment improved both proper scores on development and holdout; retain market baseline.'},production_gate:{passed:false,reason:'No forward verification; historical moneylines have unknown quote timing and sportsbook identity.'},warning:'Historical price proxy, not verified Ontario prices. No actual wagers. The holdout has been used in earlier model research.'};
}
