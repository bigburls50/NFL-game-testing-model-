// Timestamped pregame reports only. Absence of a report is not evidence of health.
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,scorePredictions} from './learned-matchup.mjs';
import {kickoffUtc} from './generate-provisional-feed.mjs';
const canon=t=>({OAK:'LV',SD:'LAC',STL:'LA',LAR:'LA',WSH:'WAS',JAC:'JAX'}[t]??t);
const key=(s,w,t)=>[s,w,canon(t)].join('|');
const OFF=new Set(['RB','FB','HB','WR','TE','OT','T','G','OG','C','OL']);
const DEF=new Set(['DE','DT','NT','DL','LB','ILB','OLB','MLB','CB','DB','S','SS','FS','EDGE']);
const weights={Out:1,Doubtful:.75,Questionable:.25};
export const injurySeverity=status=>Object.hasOwn(weights,status)?weights[status]:0;
export const injurySide=position=>OFF.has(position)?'offense':DEF.has(position)?'defense':null;
export function indexInjuryReports(rows){
 const map=new Map();for(const r of rows){const timestamp=Date.parse(r.date_modified??'');if(!Number.isFinite(timestamp)||!/^00-\d{7}$/.test(r.gsis_id??'')||!r.team)continue;const k=key(r.season,r.week,r.team);if(!map.has(k))map.set(k,[]);map.get(k).push({...r,timestamp})}return map;
}
export function latestInjuryRows(index,g,team,cutoff){
 const list=index.get(key(g.season,g.week,team))??[],latest=new Map(),bad=new Set();
 for(const r of list){if(r.timestamp>cutoff||cutoff-r.timestamp>8*86400000)continue;const previous=latest.get(r.gsis_id);if(!previous||r.timestamp>previous.timestamp){latest.set(r.gsis_id,r);bad.delete(r.gsis_id)}else if(r.timestamp===previous.timestamp&&r.report_status!==previous.report_status)bad.add(r.gsis_id)}
 if(!latest.size||bad.size)return null;return [...latest.values()];
}
export function pregameInjuries(index,g,team,cutoff,previousQB){
 const latest=latestInjuryRows(index,g,team,cutoff);if(!latest)return null;
 let offense=0,defense=0,qb=0;for(const r of latest.values()){const severity=Object.hasOwn(weights,r.report_status)?weights[r.report_status]:0;if(OFF.has(r.position))offense+=severity;if(DEF.has(r.position))defense+=severity;if(r.gsis_id===previousQB&&r.position==='QB')qb=severity}
 return {offense,defense,prior_qb_status:qb,observed_players:latest.length};
}
export function injuryFeatures(schedule,index){
 const games=completedRows(schedule),prev=new Map(),out=new Map();
 for(let i=0;i<games.length;){const date=games[i].gameday,batch=[];while(i<games.length&&games[i].gameday===date){const g=games[i++];batch.push(g);const kick=kickoffUtc(g.gameday,g.gametime);if(!kick)continue;const cut=Date.parse(kick)-3*3600000,h=prev.get(canon(g.home_team)),a=prev.get(canon(g.away_team));if(!h||!a)continue;const home=pregameInjuries(index,g,g.home_team,cut,h),away=pregameInjuries(index,g,g.away_team,cut,a);if(home&&away)out.set(g.game_id,{x:[(home.offense-away.offense)/3,(home.defense-away.defense)/3,home.prior_qb_status-away.prior_qb_status],home,away})}
  for(const g of batch){for(const [t,id] of [[g.home_team,g.home_qb_id],[g.away_team,g.away_qb_id]])if(/^00-\d{7}$/.test(id??''))prev.set(canon(t),id);else prev.delete(canon(t))}
 }return out;
}
const logit=p=>Math.log(p/(1-p)),sigmoid=z=>1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));
export function predictInjuryOffset(p,x,w){return sigmoid(logit(p)+x.reduce((s,v,i)=>s+v*w[i],0))}
function fitOffset(rows){if(rows.length<100)throw Error('Not enough injury-labeled history');let w=[0,0,0];for(let i=0;i<450;i++){const grad=[0,0,0];for(const r of rows){const d=predictInjuryOffset(r.v2,r.x,w)-r.y;for(let j=0;j<3;j++)grad[j]+=d*r.x[j]}w=w.map((v,j)=>v-.25*(grad[j]/rows.length+.01*v))}return w}
export function evaluateInjuryImpact(schedule,injuryRows){
 const games=completedRows(schedule).filter(g=>Number(g.season)>=2016),base=buildCausalFeatures(games).data,index=indexInjuryReports(injuryRows),injuries=injuryFeatures(games,index),records=[],coverage={};
 for(let season=2019;season<=2026;season++){const test=base.filter(r=>r.season===season),weights=fitLogistic(base.filter(r=>r.season>2016&&r.season<season));let observed=0;for(const r of test){const v=injuries.get(r.game_id);if(v){observed++;records.push({season,y:r.y,x:v.x,v2:predictLogistic(r.x,weights)})}}coverage[season]={games:test.length,paired_timestamped_games:observed}}
 const train=records.filter(r=>r.season<=2022),holdout=records.filter(r=>[2023,2024].includes(r.season)),w=fitOffset(train);
 const metrics={v2:scorePredictions(holdout.map(r=>({p:r.v2,y:r.y}))),injuries:scorePredictions(holdout.map(r=>({p:predictInjuryOffset(r.v2,r.x,w),y:r.y})))};
 return {model_version:'phase10-injury-burden-offset-research-v1',train_seasons:[2019,2020,2021,2022],holdout_seasons:[2023,2024],coverage,features:['offense_report_burden_difference','defense_report_burden_difference','prior_qb_report_burden_difference'],coefficients:w,training_games:train.length,holdout:metrics,promotion_gate:{passed:false,reason:'2025 and 2026 source files lack individual timestamps; cannot validate a contemporary pregame adjustment.'},warning:'Historical injury candidate observations, not certified complete official reports. Position counts are a proxy, not individual player impact. Undated rows never used; no betting recommendation.'};
}
