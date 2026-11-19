// Timestamped depth-chart challenger: prior-game QB rating deltas, never actual upcoming starters.
import {parseCSV} from './baseline.mjs';
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,scorePredictions} from './learned-matchup.mjs';
import {kickoffUtc} from './generate-provisional-feed.mjs';
const canon=t=>({OAK:'LV',SD:'LAC',STL:'LA',LAR:'LA',WSH:'WAS',JAC:'JAX'}[t]??t);
const validId=id=>/^00-\d{7}$/.test(id??'');
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hours=3600000;
export function indexDatedDepthCSV(text){
 // Retain every team snapshot timestamp, even if its rank-one quarterback is absent.
 const [header,...lines]=text.split(/\r?\n/);
 if(header!=='dt,team,player_name,espn_id,gsis_id,pos_grp_id,pos_grp,pos_id,pos_name,pos_abb,pos_slot,pos_rank')throw Error('Unrecognized dated depth chart schema');
 const map=new Map(),qbLines=[];
 for(const line of lines){if(!line)continue;const m=line.match(/^([^,]+),([^,]+),/);if(!m)throw Error('Invalid depth chart record');const at=Date.parse(m[1]),team=canon(m[2]);if(!Number.isFinite(at))throw Error('Invalid dated depth timestamp');if(!map.has(team))map.set(team,new Map());const times=map.get(team);if(!times.has(at))times.set(at,new Set());if(/,QB,\d+,1$/.test(line))qbLines.push(line)}
 for(const r of parseCSV([header,...qbLines].join('\n')))if(validId(r.gsis_id))map.get(canon(r.team)).get(Date.parse(r.dt)).add(r.gsis_id);
 return new Map([...map].map(([t,m])=>[t,[...m].sort((a,b)=>b[0]-a[0])]));
}
export function datedStarter(index,team,cutoff){
 const c=typeof cutoff==='number'?cutoff:Date.parse(cutoff),latest=index.get(canon(team))?.find(([at])=>at<=c);
 if(!latest||c-latest[0]>7*24*hours||latest[1].size!==1)return null;
 return {id:[...latest[1]][0],snapshot_at_utc:new Date(latest[0]).toISOString()};
}
function playerIndex(rows){
 const byGame=new Map();
 for(const r of rows){if(r.position!=='QB'||!validId(r.player_id)||!r.game_id)continue;const n=Number(r.attempts)+Number(r.sacks_suffered),epa=Number(r.passing_epa);if(!Number.isFinite(n)||n<5||String(r.passing_epa??'').trim()===''||!Number.isFinite(epa))continue;if(!byGame.has(r.game_id))byGame.set(r.game_id,[]);const g=byGame.get(r.game_id);if(g.some(v=>v.id===r.player_id))throw Error('Duplicate QB stat record');g.push({id:r.player_id,team:canon(r.team),n,epa:clamp(epa/n,-1.5,1.5)*n})}
 return byGame;
}
export function buildQBChangeFeatures(schedule,players,depthBySeason){
 const rows=completedRows(schedule),stats=playerIndex(players),history=new Map(),previous=new Map(),out=new Map();
 function rating(id){const prior=history.get(id)??[];let epa=0,n=150;for(let i=0;i<prior.length;i++){const weight=.9**(prior.length-1-i);epa+=prior[i].epa*weight;n+=prior[i].n*weight}return {epa_per_dropback:epa/n, prior_dropbacks:prior.reduce((s,r)=>s+r.n,0)}}
 for(let i=0;i<rows.length;){const date=rows[i].gameday,batch=[];while(i<rows.length&&rows[i].gameday===date){const g=rows[i++];batch.push(g);const depth=depthBySeason.get(Number(g.season)),kick=kickoffUtc(g.gameday,g.gametime);if(!depth||!kick)continue;const cutoff=Date.parse(kick)-3*hours,teams={};for(const t of [g.home_team,g.away_team]){const projected=datedStarter(depth,t,cutoff),prior=previous.get(canon(t));if(!projected||!validId(prior))continue;const currentRating=rating(projected.id),priorRating=rating(prior);teams[t]={projected_qb_id:projected.id,prior_qb_id:prior,snapshot_at_utc:projected.snapshot_at_utc,projected_rating:currentRating,prior_rating:priorRating,delta:currentRating.epa_per_dropback-priorRating.epa_per_dropback}}
   const h=teams[g.home_team],a=teams[g.away_team];if(h&&a)out.set(g.game_id,{game_id:g.game_id,cutoff_utc:new Date(cutoff).toISOString(),teams,delta:(h.delta-a.delta)*5,changed:h.projected_qb_id!==h.prior_qb_id||a.projected_qb_id!==a.prior_qb_id});
  }
  for(const g of batch){for(const [team,id] of [[g.home_team,g.home_qb_id],[g.away_team,g.away_qb_id]]){if(validId(id))previous.set(canon(team),id);else previous.delete(canon(team))}
   for(const p of stats.get(g.game_id)??[]){if(![canon(g.home_team),canon(g.away_team)].includes(p.team))continue;history.set(p.id,[...(history.get(p.id)??[]),p].slice(-16))}
  }
 }
 return out;
}
const sigmoid=z=>1/(1+Math.exp(-clamp(z,-35,35)));
const logit=p=>Math.log(p/(1-p));
export function fitQBOffset(rows,{lambda=.01}={}){
 if(rows.length<100)throw Error('Insufficient quarterback training records');
 let beta=0;for(let i=0;i<450;i++){let grad=0;for(const r of rows)grad+=(sigmoid(logit(r.v2)+beta*r.delta)-r.y)*r.delta;beta-=.35*(grad/rows.length+lambda*beta)}return beta;
}
export const predictQBOffset=(v2,delta,beta)=>sigmoid(logit(v2)+beta*delta);
export function evaluateQBChanges(schedule,players,depthBySeason){
 const history=completedRows(schedule).filter(r=>Number(r.season)>=2016),features=buildCausalFeatures(history).data,changes=buildQBChangeFeatures(history,players,depthBySeason),records=[],fixtures=new Map(history.map(g=>[g.game_id,g]));
 for(const season of [2025,2026]){const weights=fitLogistic(features.filter(r=>r.season>2016&&r.season<season));for(const r of features.filter(v=>v.season===season)){const q=changes.get(r.game_id);if(q)records.push({...q,season,y:r.y,v2:predictLogistic(r.x,weights)})}}
 const train=records.filter(r=>r.season===2025),test=records.filter(r=>r.season===2026),beta=fitQBOffset(train);
 const metrics=rs=>({v2:scorePredictions(rs.map(r=>({p:r.v2,y:r.y}))),adjusted:scorePredictions(rs.map(r=>({p:predictQBOffset(r.v2,r.delta,beta),y:r.y})))});
 const scores=metrics(test),changed=metrics(test.filter(r=>r.changed)),coverage={train_games:train.length,train_total:features.filter(r=>r.season===2025).length,holdout_games:test.length,holdout_total:features.filter(r=>r.season===2026).length,changed_holdout_games:test.filter(r=>r.changed).length};
 let matched=0;for(const r of test){const g=fixtures.get(r.game_id);matched+=Number(r.teams[g.home_team].projected_qb_id===g.home_qb_id)+Number(r.teams[g.away_team].projected_qb_id===g.away_qb_id)}
 const passed=coverage.holdout_games/coverage.holdout_total>=.8&&coverage.changed_holdout_games>=30&&scores.adjusted.brier<scores.v2.brier&&scores.adjusted.log_loss<scores.v2.log_loss&&changed.adjusted.brier<changed.v2.brier;
 return {model_version:'phase10-qb-change-offset-research-v1',depth_cutoff_hours_before_kickoff:3,train_season:2025,holdout_season:2026,coverage,beta,holdout:scores,changed_holdout:changed,projected_starter_matches_final:{matched,total:2*test.length},promotion_gate:{passed,requirements:'80% holdout depth coverage, 30 changed-starter games and improved Brier/log loss overall and changed-game Brier.'},warning:'Retrospective timestamped snapshots, one season training and partial season holdout. Prior-game stat availability timestamps not independently archived. No real-money use.'};
}
