// Role-weighted injury estimates. Snap shares are playing-time proxies, not causal player value.
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,scorePredictions} from './learned-matchup.mjs';
import {indexInjuryReports,latestInjuryRows,pregameInjuries,injurySeverity,injurySide,predictInjuryOffset} from './injury-impact-research.mjs';
import {kickoffUtc} from './generate-provisional-feed.mjs';
const canon=t=>({OAK:'LV',SD:'LAC',STL:'LA',LAR:'LA',WSH:'WAS',JAC:'JAX'}[t]??t);
const id=v=>/^00-\d{7}$/.test(v??'');
export const PLAYER_IMPACT_VERSION='phase10-player-snap-injury-offset-research-v1';
export const ROLE_FEATURES=['offensive_snap_burden_difference','defensive_snap_burden_difference','prior_qb_status_difference','unknown_offense_burden_difference','unknown_defense_burden_difference'];
export function indexPlayerIds(rows){
 const pfr=new Map(),gsis=new Map();
 for(const r of rows){if(!id(r.gsis_id)||!r.pfr_id)continue;if(!pfr.has(r.pfr_id))pfr.set(r.pfr_id,new Set());pfr.get(r.pfr_id).add(r.gsis_id);if(!gsis.has(r.gsis_id))gsis.set(r.gsis_id,new Set());gsis.get(r.gsis_id).add(r.pfr_id)}
 const mapping=new Map();for(const [p,ids] of pfr){if(ids.size!==1)continue;const [g]=ids;if(gsis.get(g).size===1)mapping.set(p,g)}return mapping;
}
const share=v=>String(v??'').trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1?Number(v):null;
export function indexSnapCounts(rows,mapping){
 const games=new Map();
 for(const r of rows){if(!r.game_id||!r.team||!r.opponent)continue;const key=r.game_id+'|'+canon(r.team),off=share(r.offense_pct),def=share(r.defense_pct);
  if(!games.has(key))games.set(key,{opponent:canon(r.opponent),ids:new Map(),seen:new Set(),rows:0,off:0,def:0,mappedOff:0,mappedDef:0,bad:false});const g=games.get(key);g.rows++;
  if(off===null||def===null||g.opponent!==canon(r.opponent)||!r.pfr_player_id||g.seen.has(r.pfr_player_id)){g.bad=true;continue}g.seen.add(r.pfr_player_id);g.off+=off;g.def+=def;const player=mapping.get(r.pfr_player_id);
  if(player){g.ids.set(player,{offense:off,defense:def});g.mappedOff+=off;g.mappedDef+=def}
 }
 for(const [k,g] of games){if(g.bad||g.rows<35||g.off<10||g.off>12||g.def<10||g.def>12||g.mappedOff/g.off<.90||g.mappedDef/g.def<.90)games.delete(k)}
 return games;
}
function historyState(){return {teamGames:new Map(),previousQB:new Map()}}
function update(state,g,snaps){
 for(const [team,opponent,qb] of [[g.home_team,g.away_team,g.home_qb_id],[g.away_team,g.home_team,g.away_qb_id]]){const t=canon(team),snap=snaps.get(g.game_id+'|'+t),valid=snap&&snap.opponent===canon(opponent);state.teamGames.set(t,[...(state.teamGames.get(t)??[]),{date:g.gameday,snap:valid?snap:null}].slice(-8));if(id(qb))state.previousQB.set(t,qb);else state.previousQB.delete(t)}
}
export function roleShare(state,team,player,side,asOfDate){
 const games=(state.teamGames.get(canon(team))??[]).filter(g=>g.date<asOfDate&&Date.parse(asOfDate)-Date.parse(g.date)<=365*86400000);
 if(games.length<3||!games.at(-1)?.snap||!games.some(g=>g.snap?.ids.has(player)))return null;
 const recent=games.slice(-6);if(recent.filter(g=>g.snap).length<3)return null;
 let total=0,weight=0;for(let i=0;i<recent.length;i++){const snap=recent[i].snap;if(!snap)continue;const w=.85**(recent.length-1-i);total+=w*(snap.ids.get(player)?.[side]??0);weight+=w}
 return {share:total/weight,prior_games:recent.filter(g=>g.snap).length,prior_appearances:recent.filter(g=>g.snap?.ids.has(player)).length};
}
export function roleBurden(rows,state,team,priorQB,date){
 if(!rows?.length||!priorQB)return null;const result={offense:0,defense:0,unknown_offense:0,unknown_defense:0,prior_qb_status:0,known_injured:0,unknown_injured:0,players:[]};
 for(const r of rows){const severity=injurySeverity(r.report_status);if(!severity)continue;if(r.gsis_id===priorQB&&r.position==='QB')result.prior_qb_status=severity;const side=injurySide(r.position);if(!side)continue;
  const role=roleShare(state,team,r.gsis_id,side,date);if(role){result[side]+=severity*role.share;result.known_injured++}else{result['unknown_'+side]+=severity;result.unknown_injured++}
  result.players.push({player_id:r.gsis_id,position:r.position,status:r.report_status,side,prior_snap_share:role?.share??null,prior_games:role?.prior_games??null,prior_appearances:role?.prior_appearances??null});
 }return result;
}
export function roleVector(home,away){return [(home.offense-away.offense)/2,(home.defense-away.defense)/2,home.prior_qb_status-away.prior_qb_status,(home.unknown_offense-away.unknown_offense)/3,(home.unknown_defense-away.unknown_defense)/3]}
export function buildRoleHistory(schedule,snaps,cutoffDate){
 const state=historyState();for(const g of completedRows(schedule).filter(g=>g.gameday<cutoffDate))update(state,g,snaps);return state;
}
export function historicalRoleFeatures(schedule,snaps,injuries){
 const state=historyState(),games=completedRows(schedule),out=new Map();for(let i=0;i<games.length;){const date=games[i].gameday,batch=[];while(i<games.length&&games[i].gameday===date){const g=games[i++];batch.push(g);const kickoff=kickoffUtc(g.gameday,g.gametime),h=state.previousQB.get(canon(g.home_team)),a=state.previousQB.get(canon(g.away_team));if(!kickoff||!h||!a)continue;const cutoff=Date.parse(kickoff)-3*3600000,hr=latestInjuryRows(injuries,g,g.home_team,cutoff),ar=latestInjuryRows(injuries,g,g.away_team,cutoff),home=roleBurden(hr,state,g.home_team,h,date),away=roleBurden(ar,state,g.away_team,a,date);if(!home||!away)continue;
   const countH=pregameInjuries(injuries,g,g.home_team,cutoff,h),countA=pregameInjuries(injuries,g,g.away_team,cutoff,a);
   out.set(g.game_id,{x:roleVector(home,away),countX:[(countH.offense-countA.offense)/3,(countH.defense-countA.defense)/3,countH.prior_qb_status-countA.prior_qb_status],known:home.known_injured+away.known_injured,unknown:home.unknown_injured+away.unknown_injured})}
   for(const g of batch)update(state,g,snaps)
 }return out;
}
function fitOffset(rows,key){
 if(rows.length<100)throw Error('Insufficient injury history');let w=Array(rows[0][key].length).fill(0);
 for(let i=0;i<450;i++){const grad=w.map(()=>0);for(const r of rows){const e=predictInjuryOffset(r.v2,r[key],w)-r.y;for(let j=0;j<w.length;j++)grad[j]+=e*r[key][j]}w=w.map((v,j)=>v-.25*(grad[j]/rows.length+.01*v))}return w;
}
export function evaluatePlayerImpact(schedule,snapRows,idRows,injuryRows){
 const history=completedRows(schedule).filter(g=>Number(g.season)>=2016),mapping=indexPlayerIds(idRows),snaps=indexSnapCounts(snapRows,mapping),roles=historicalRoleFeatures(history,snaps,indexInjuryReports(injuryRows)),base=buildCausalFeatures(history).data,records=[],coverage={};
 for(let season=2019;season<=2026;season++){const rows=base.filter(r=>r.season===season),w=fitLogistic(base.filter(r=>r.season>2016&&r.season<season));const eligible=rows.filter(r=>roles.has(r.game_id));coverage[season]={games:rows.length,paired:eligible.length,known_injured:eligible.reduce((s,r)=>s+roles.get(r.game_id).known,0),unknown_injured:eligible.reduce((s,r)=>s+roles.get(r.game_id).unknown,0)};for(const r of eligible)records.push({season,y:r.y,v2:predictLogistic(r.x,w),...roles.get(r.game_id)})}
 const train=records.filter(r=>r.season<=2022),holdout=records.filter(r=>[2023,2024].includes(r.season)),w=fitOffset(train,'x'),countW=fitOffset(train,'countX'),metrics={v2:scorePredictions(holdout.map(r=>({p:r.v2,y:r.y}))),count:scorePredictions(holdout.map(r=>({p:predictInjuryOffset(r.v2,r.countX,countW),y:r.y}))),weighted:scorePredictions(holdout.map(r=>({p:predictInjuryOffset(r.v2,r.x,w),y:r.y})))};
 const known=holdout.reduce((s,r)=>s+r.known,0),unknown=holdout.reduce((s,r)=>s+r.unknown,0),better=metrics.weighted.brier<metrics.count.brier&&metrics.weighted.log_loss<metrics.count.log_loss&&metrics.weighted.brier<metrics.v2.brier&&metrics.weighted.log_loss<metrics.v2.log_loss&&known/(known+unknown)>=.8;
 return {model_version:PLAYER_IMPACT_VERSION,training_seasons:[2019,2020,2021,2022],holdout_seasons:[2023,2024],training_games:train.length,features:ROLE_FEATURES,coefficients:w,count_coefficients:countW,coverage,snap_team_game_coverage:{valid:snaps.size,expected:history.length*2},holdout_role_coverage:{known,unknown,fraction:known/(known+unknown)},holdout:metrics,retrospective_gate:{passed:better,requirements:'Lower Brier and log loss than count and V2, >=80% covered injury roles.'},promotion_gate:{passed:false,reason:'2025–26 injury rows lack individual timestamps; prospective evidence required. 2023–24 holdout reused from earlier injury experiment.'},warning:'Snap shares reflect recent usage, not causal player value. Unknown roles remain separate features, not zero impact. Research only; no betting.'};
}
