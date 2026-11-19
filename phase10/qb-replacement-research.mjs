// Research-only, prior-game QB production relative to recent team QB usage.
import {completedRows,buildCausalFeatures,fitLogistic,predictLogistic,scorePredictions} from './learned-matchup.mjs';
import {datedStarter} from './qb-change-research.mjs';
import {kickoffUtc} from './generate-provisional-feed.mjs';
export const QB_REPLACEMENT_VERSION='phase10-qb-replacement-research-v1';
const valid=id=>/^00-\d{7}$/.test(id??'');
const canon=t=>({OAK:'LV',SD:'LAC',STL:'LA',LAR:'LA',WSH:'WAS',JAC:'JAX'}[t]??t);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-35,35))),logit=p=>Math.log(p/(1-p));
const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
export function indexQBProduction(rows){
 const games=new Map();for(const r of rows){if(r.position!=='QB'||!valid(r.player_id)||!r.game_id||!r.team)continue;
  if(![r.attempts,r.sacks_suffered,r.carries].every(v=>numeric(v)&&Number(v)>=0&&Number.isInteger(Number(v))))continue;
  const pass=Number(r.attempts)+Number(r.sacks_suffered),rush=Number(r.carries),n=pass+rush;if(n<5||pass>0&&!numeric(r.passing_epa)||rush>0&&!numeric(r.rushing_epa))continue;
  const epa=(pass>0?Number(r.passing_epa):0)+(rush>0?Number(r.rushing_epa):0),record={id:r.player_id,team:canon(r.team),n,epa:clamp(epa/n,-1.5,1.5)*n};
  if(!games.has(r.game_id))games.set(r.game_id,[]);const list=games.get(r.game_id);if(list.some(p=>p.id===record.id))throw Error('Duplicate QB production record');list.push(record);
 }return games;
}
function rating(records,prior=100){let n=0,epa=0,raw=0;for(let i=0;i<records.length;i++){const r=records[i],w=.9**(records.length-1-i);n+=r.n*w;epa+=r.epa*w;raw+=r.n}return {epa_per_action:epa/(n+prior),prior_actions:raw,weighted_actions:n};}
export function buildQBHistory(schedule,players){
 const byGame=players instanceof Map?players:indexQBProduction(players),individual=new Map(),teams=new Map(),lastStarter=new Map();
 function update(g){const records=(byGame.get(g.game_id)??[]).filter(r=>[canon(g.home_team),canon(g.away_team)].includes(r.team));
  for(const r of records)individual.set(r.id,[...(individual.get(r.id)??[]),r].slice(-16));
  for(const [team,qb] of [[g.home_team,g.home_qb_id],[g.away_team,g.away_qb_id]]){const t=canon(team),p=records.filter(r=>r.team===t);const n=p.reduce((s,r)=>s+r.n,0);if(n>=5)teams.set(t,[...(teams.get(t)??[]),{n,epa:p.reduce((s,r)=>s+r.epa,0)}].slice(-8));else teams.delete(t);if(valid(qb))lastStarter.set(t,qb);else lastStarter.delete(t)}
 }
 function project(team,id){const t=canon(team),teamRecords=teams.get(t)??[],q=rating(individual.get(id)??[]),base=rating(teamRecords),prior=lastStarter.get(t);if(!valid(id)||!valid(prior)||teamRecords.length<3||q.prior_actions<50)return null;
  return {projected_qb_id:id,prior_qb_id:prior,changed:id!==prior,projected_rating:q,recent_team_qb_rating:base,replacement_delta:q.epa_per_action-base.epa_per_action};}
 for(const g of completedRows(schedule))update(g);
 return {project,update};
}
export const replacementFeatures=(h,a)=>[(h.projected_rating.epa_per_action-a.projected_rating.epa_per_action)*5,(h.replacement_delta-a.replacement_delta)*5];
export function buildReplacementFeatures(schedule,players,depthBySeason){
 const rows=completedRows(schedule),history=buildQBHistory([],players),out=new Map();
 for(let i=0;i<rows.length;){const day=rows[i].gameday,batch=[];while(i<rows.length&&rows[i].gameday===day){const g=rows[i++];batch.push(g);const depth=depthBySeason.get(Number(g.season)),kick=kickoffUtc(g.gameday,g.gametime);if(!depth||!kick)continue;const cutoff=Date.parse(kick)-3*3600000,h=datedStarter(depth,g.home_team,cutoff),a=datedStarter(depth,g.away_team,cutoff);if(!h||!a)continue;const home=history.project(g.home_team,h.id),away=history.project(g.away_team,a.id);if(home&&away)out.set(g.game_id,{x:replacementFeatures(home,away),changed:home.changed||away.changed,home,away,cutoff_utc:new Date(cutoff).toISOString()})}for(const g of batch)history.update(g)}return out;
}
export function fitReplacementOffset(rows){if(rows.length<100)throw Error('Insufficient prior QB records');let w=[0,0];for(let i=0;i<500;i++){const grad=[0,0];for(const r of rows){const d=predictReplacementOffset(r.v2,r.x,w)-r.y;for(let j=0;j<2;j++)grad[j]+=d*r.x[j]}w=w.map((b,j)=>clamp(b-.3*(grad[j]/rows.length+.02*b),0,2))}return w;}
export const predictReplacementOffset=(v2,x,w)=>sigmoid(logit(v2)+x[0]*w[0]+x[1]*w[1]);
export function evaluateReplacement(schedule,players,depthBySeason){
 const history=completedRows(schedule).filter(r=>Number(r.season)>=2016),f=buildCausalFeatures(history).data,q=buildReplacementFeatures(history,players,depthBySeason),records=[];
 for(const season of [2025,2026]){const weights=fitLogistic(f.filter(r=>r.season>2016&&r.season<season));for(const r of f.filter(r=>r.season===season)){const replacement=q.get(r.game_id);if(replacement)records.push({...replacement,game_id:r.game_id,season,y:r.y,v2:predictLogistic(r.x,weights)})}}
 const train=records.filter(r=>r.season===2025),test=records.filter(r=>r.season===2026),weights=fitReplacementOffset(train),metrics=rows=>({v2:scorePredictions(rows.map(r=>({p:r.v2,y:r.y}))),replacement:scorePredictions(rows.map(r=>({p:predictReplacementOffset(r.v2,r.x,weights),y:r.y})))}),holdout=metrics(test),changed_holdout=metrics(test.filter(r=>r.changed)),total=f.filter(r=>r.season===2026).length;
 const passes=m=>m.replacement.brier<m.v2.brier&&m.replacement.log_loss<m.v2.log_loss;
 const passed=test.length/total>=.8&&changed_holdout.v2.n>=30&&passes(holdout)&&passes(changed_holdout);
 return {version:QB_REPLACEMENT_VERSION,train_season:2025,holdout_season:2026,training_games:train.length,holdout_total:total,coverage:test.length/total,weights,holdout,changed_holdout,retrospective_gate:{passed,requirements:'80% coverage, at least 30 changed-QB games, improved Brier and log loss on both sets'},production_gate:{passed:false,reason:'Prior-game statistics publication times were not independently captured; retrospective holdout reused. Prospective verification required.'},warning:'EPA per QB action (passing attempts, sacks and carries), not isolated causal player value; current and same-day results never enter features. Unseen or low-sample QBs remain unknown.'};
}
