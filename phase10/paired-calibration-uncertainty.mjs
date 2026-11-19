#!/usr/bin/env node
// Paired, game-level uncertainty audit. Fixed comparison; no model selection or threshold search.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
function score(r){
 const p=Number(r.home_win_probability),h=Number(r.home_score),a=Number(r.away_score);
 if(!Number.isFinite(p)||p<=0||p>=1||!Number.isInteger(h)||!Number.isInteger(a)||h===a)throw Error('Invalid probability or outcome');
 const y=Number(h>a);
 return {brier:(p-y)**2,logLoss:-(y*Math.log(p)+(1-y)*Math.log(1-p)),correct:Number((p>=.5)===Boolean(y))};
}
export function pairedAudit(original,calibrated){
 const left=new Map();
 for(const r of original){if(!r.game_id||left.has(r.game_id))throw Error('Duplicate original game');left.set(r.game_id,r)}
 const pairs=[];
 for(const r of calibrated){
  const o=left.get(r.game_id);if(!o)throw Error('Missing original game '+r.game_id);
  for(const k of ['season','home_team','away_team','home_score','away_score'])if(String(o[k])!==String(r[k]))throw Error('Mismatch '+r.game_id+' '+k);
  const a=score(o),b=score(r);pairs.push({season:String(r.season),brier:b.brier-a.brier,logLoss:b.logLoss-a.logLoss,accuracy:b.correct-a.correct});
 }
 if(!pairs.length)throw Error('No paired games');
 const summarize=(arr)=>Object.fromEntries(['brier','logLoss','accuracy'].map(k=>[k,arr.reduce((s,r)=>s+r[k],0)/arr.length]));
 const bySeason=Object.fromEntries([...new Set(pairs.map(p=>p.season))].sort().map(season=>[season,{games:pairs.filter(p=>p.season===season).length,delta:summarize(pairs.filter(p=>p.season===season))}]));
 // Deterministic paired bootstrap, resampling games within each season; not independent prospective validation.
 let state=20261119;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
 const groups=Object.keys(bySeason).map(season=>pairs.filter(p=>p.season===season));
 const draws=2000,dist={brier:[],logLoss:[],accuracy:[]};
 for(let i=0;i<draws;i++){
  const sample=[];for(const group of groups)for(let j=0;j<group.length;j++)sample.push(group[Math.floor(random()*group.length)]);
  const v=summarize(sample);for(const k of Object.keys(dist))dist[k].push(v[k]);
 }
 const intervals=Object.fromEntries(Object.entries(dist).map(([k,v])=>{v.sort((a,b)=>a-b);return [k,{lower:v[Math.floor(.025*draws)],upper:v[Math.floor(.975*draws)]}]}));
 return {games:pairs.length,delta:summarize(pairs),by_season:bySeason,paired_bootstrap_95ci:intervals,bootstrap_draws:draws,warning:'Exploratory paired bootstrap with season-stratified game resampling. Does not account for within-team dependence, retrospective feature leakage, or prospective betting performance.'};
}
if(process.argv[1]?.endsWith('paired-calibration-uncertainty.mjs')){
 try{if(process.argv.length!==4)throw Error('Usage: paired-calibration-uncertainty.mjs original.csv calibrated.csv');console.log(JSON.stringify(pairedAudit(parseCSV(fs.readFileSync(process.argv[2],'utf8')),parseCSV(fs.readFileSync(process.argv[3],'utf8'))),null,2))}catch(e){console.error(e.message);process.exitCode=1}
}
