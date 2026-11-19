// Historical price proxy and prospective paper-only policy; no wagers or account access.
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,scorePredictions,noVigProbability} from './learned-matchup.mjs';
import {paperStake} from './paper-math.mjs';
export const VALUE_VERSION='phase10-market-anchor-research-v1';
export const VALUE_POLICY=Object.freeze({min_ev:.03,max_singles:3,virtual_weekly_bankroll:1000});
export function decimal(price){const p=Number(price);return Number.isInteger(p)&&Math.abs(p)>=100?(p>0?1+p/100:1+100/-p):null}
const logit=p=>Math.log(p/(1-p)),sigmoid=z=>1/(1+Math.exp(-z));
export function blendProbability(model,market,weight){
 if(![model,market].every(p=>Number.isFinite(p)&&p>0&&p<1)||!Number.isFinite(weight)||weight<0||weight>1)return null;
 return sigmoid(weight*logit(model)+(1-weight)*logit(market));
}
export function fitBlendWeight(rows){
 const eligible=rows.filter(r=>r.y!==null);if(eligible.length<100)throw Error('Insufficient earlier probability records');let best={weight:0,log_loss:Infinity};
 for(let i=0;i<=100;i++){const weight=i/100,score=scorePredictions(eligible.map(r=>({y:r.y,p:blendProbability(r.v2,r.market,weight)})));if(score.log_loss<best.log_loss-1e-12)best={weight,log_loss:score.log_loss}}
 return best.weight;
}
export function chooseValueLeg(game,probability,threshold=VALUE_POLICY.min_ev){
 if(!Number.isFinite(probability)||probability<=0||probability>=1)return null;
 const legs=[['home',probability,game.home_decimal],['away',1-probability,game.away_decimal]].filter(([,p,d])=>Number.isFinite(d)&&d>1&&p*d-1>=threshold).map(([side,p,d])=>({side,p,decimal:d,edge:p*d-1}));
 return legs.sort((a,b)=>b.edge-a.edge||a.side.localeCompare(b.side))[0]??null;
}
export function pickWeeklySingles(games,key,policy=VALUE_POLICY){
 const groups=new Map();
 for(const g of games){const leg=chooseValueLeg(g,g[key],policy.min_ev);if(!leg)continue;const week=g.season+'|'+g.week;if(!groups.has(week))groups.set(week,[]);groups.get(week).push({...g,...leg})}
 return [...groups].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).flatMap(([week,rows])=>rows.sort((a,b)=>b.edge-a.edge||a.game_id.localeCompare(b.game_id)).slice(0,policy.max_singles).map(r=>({...r,week_key:week,stake:paperStake(r.p,r.decimal,policy.virtual_weekly_bankroll).stake})));
}
const result=(r,stake)=>r.y===null?0:(r.side==='home'?r.y===1:r.y===0)?stake*(r.decimal-1):-stake;
export function summarizeValueBets(bets,initial=1000){
 const weeks=new Map();let risk=0,pnl=0,flat=0,wins=0,losses=0,pushes=0;
 for(const r of bets){const profit=result(r,r.stake);pnl+=profit;risk+=r.stake;flat+=result(r,1);if(r.y===null)pushes++;else if(profit>0)wins++;else losses++;const prior=weeks.get(r.week_key)??{pnl:0,risk:0};prior.pnl+=profit;prior.risk+=r.stake;weeks.set(r.week_key,prior)}
 let equity=initial,peak=initial,drawdown=0;for(const w of weeks.values()){equity+=w.pnl;peak=Math.max(peak,equity);drawdown=Math.max(drawdown,(peak-equity)/peak)}
 // Deterministic weekly block bootstrap describes uncertainty, not proof of future profitability.
 const values=[...weeks.values()],samples=[];let seed=1729;if(values.length>=5)for(let i=0;i<2000;i++){let sum=0,stake=0;for(let j=0;j<values.length;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const w=values[Math.floor(seed/2**32*values.length)];sum+=w.pnl;stake+=w.risk}if(stake>0)samples.push(sum/stake)}samples.sort((a,b)=>a-b);
 return {bets:bets.length,wins,losses,pushes,win_rate:wins+losses?wins/(wins+losses):null,turnover:risk,pnl,roi:risk?pnl/risk:null,flat_unit_roi:bets.length?flat/bets.length:null,weekly_drawdown:drawdown,weekly_roi_bootstrap_95:samples.length?[samples[Math.floor(.025*samples.length)],samples[Math.floor(.975*samples.length)]]:null,ending_virtual_balance:initial+pnl};
}
export function evaluateValueResearch(schedule){
 const history=completedRows(schedule).filter(r=>Number(r.season)>=2016),features=buildCausalFeatures(history,{includeTies:true}).data,fixtures=new Map(history.map(g=>[g.game_id,g])),records=[];
 for(let season=2019;season<=2026;season++){const training=features.filter(r=>r.season>2016&&r.season<season&&r.y!==null),weights=fitLogistic(training);for(const r of features.filter(r=>r.season===season)){const g=fixtures.get(r.game_id),home=decimal(r.home_moneyline),away=decimal(r.away_moneyline),market=noVigProbability(r.home_moneyline,r.away_moneyline);if(home&&away&&market!==null)records.push({game_id:r.game_id,season,week:Number(g.week),date:r.date,y:r.y,v2:predictLogistic(r.x,weights),market,home_decimal:home,away_decimal:away})}}
 const fitBySeason={},scored=[];for(let season=2023;season<=2026;season++){const weight=fitBlendWeight(records.filter(r=>r.season<season));fitBySeason[season]=weight;for(const r of records.filter(r=>r.season===season))scored.push({...r,blend:blendProbability(r.v2,r.market,weight)})}
 function summary(rows){return {games:rows.length,probability_metrics:Object.fromEntries(['v2','market','blend'].map(k=>[k,scorePredictions(rows.filter(r=>r.y!==null).map(r=>({p:r[k],y:r.y})))])),paper:Object.fromEntries(['v2','market','blend'].map(k=>[k,summarizeValueBets(pickWeeklySingles(rows,k))]))}}
 const dev=summary(scored.filter(r=>r.season<=2024)),holdout=summary(scored.filter(r=>r.season>=2025));
 return {version:VALUE_VERSION,policy:VALUE_POLICY,fit_weights_by_season:fitBySeason,development_seasons:[2023,2024],holdout_seasons:[2025,2026],development:dev,holdout,production_gate:{passed:false,reason:'Historical moneylines lack independently verified quote times/bookmaker identity. No proof of executable price or prospective profitability.'},warning:'Retrospective single quoted moneyline proxy, not Ontario quotes. Model and market blend only fitted on earlier seasons. Unit and fixed-bankroll paper bets capped at 3 per week; tied games push. Holdout overlaps previous model research.'};
}
