// Prior-game, game-ID joined efficiency features. No current game player identity or stats enter a prediction.
import {buildCausalFeatures,completedRows,FEATURE_NAMES,fitLogistic,predictLogistic,scorePredictions,noVigProbability} from './learned-matchup.mjs';
export const EFFICIENCY_VERSION='phase10-efficiency-v3';
export const TEAM_FEATURES=[...FEATURE_NAMES,'pass_offense_difference','rush_offense_difference','pass_defense_difference','rush_defense_difference'];
export const QB_FEATURES=[...TEAM_FEATURES,'prior_starter_passing_epa_difference','prior_starter_cpoe_difference'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const numeric=v=>String(v??'').trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const teamKey=(game,team)=>game+'|'+team;
const canon=t=>({LAR:'LA',WSH:'WAS',JAC:'JAX',OAK:'LV',SD:'LAC',STL:'LA'}[t]??t);
function ratio(total,n){return numeric(total)!==null&&n>0?clamp(Number(total)/n,-1.5,1.5):null}
function passAttempts(r){return (numeric(r.attempts)??0)+(numeric(r.sacks_suffered)??0)}
export function indexEfficiency(teamRows,playerRows=[]){
 const teams=new Map(),players=new Map();
 for(const r of teamRows){if(!r.game_id||!r.team)throw Error('Missing team stats identity');const key=teamKey(r.game_id,canon(r.team));if(teams.has(key))throw Error('Duplicate team stats');const pass=ratio(r.passing_epa,passAttempts(r)),rush=ratio(r.rushing_epa,numeric(r.carries)??0);if(pass!==null&&rush!==null)teams.set(key,{opponent:canon(r.opponent_team),pass,rush})}
 for(const r of playerRows){if(r.position!=='QB'||!r.game_id||!/^00-\d{7}$/.test(r.player_id??''))continue;const key=r.game_id+'|'+r.player_id;if(players.has(key))throw Error('Duplicate QB game stats');const n=passAttempts(r),epa=ratio(r.passing_epa,n),cpoe=numeric(r.passing_cpoe);if(epa!==null&&n>=5)players.set(key,{team:canon(r.team),epa,cpoe:cpoe===null?0:clamp(cpoe/100,-.4,.4),n})}
 return {teams,players};
}
const weighted=(values,prior=3)=>values.reduce((s,v,i)=>s+v*.86**(values.length-1-i),0)/(prior+values.reduce((s,_,i)=>s+.86**(values.length-1-i),0));
const blank=()=>({pass:[],rush:[],passDef:[],rushDef:[],qb:null});
const add=(a,v)=>[...a,v].slice(-12);
export function buildEfficiencyFeatures(rows,stats,{forecasts=[]}={}){
 const history=completedRows(rows),base=buildCausalFeatures(history,{forecasts}),state=new Map(),qbHistory=new Map(),extra=new Map();let season=null,matched=0,qbMatched=0;
 const get=t=>state.get(canon(t))??blank(),qb=id=>qbHistory.get(id)??[];
 function transition(next){if(season!==null&&next>season){const factor=.65**(next-season);for(const t of state.values())for(const k of ['pass','rush','passDef','rushDef'])t[k]=t[k].map(v=>v*factor)}season=next}
 function features(g){
  const h=get(g.home_team),a=get(g.away_team);
  const qbr=id=>{const data=qb(id);return [weighted(data.map(v=>v.epa),4),weighted(data.map(v=>v.cpoe),4)]};
  const [he,hc]=qbr(h.qb),[ae,ac]=qbr(a.qb);
  return {x:['pass','rush','passDef','rushDef'].map(k=>2*(weighted(h[k])-weighted(a[k]))).concat(2*(he-ae),5*(hc-ac)),prior_qbs:{[g.home_team]:h.qb,[g.away_team]:a.qb},team_history_ready:h.pass.length>0&&a.pass.length>0};
 }
 for(let i=0;i<history.length;){const date=history[i].gameday;transition(Number(history[i].season));const batch=[];while(i<history.length&&history[i].gameday===date){const g=history[i++];extra.set(g.game_id,features(g));batch.push(g)}
  for(const g of batch){const h=canon(g.home_team),a=canon(g.away_team),hs=stats.teams.get(teamKey(g.game_id,h)),as=stats.teams.get(teamKey(g.game_id,a));if(hs&&as&&hs.opponent===a&&as.opponent===h){matched++;for(const [team,off,def] of [[h,hs,as],[a,as,hs]]){const t=get(team);t.pass=add(t.pass,off.pass);t.rush=add(t.rush,off.rush);t.passDef=add(t.passDef,def.pass);t.rushDef=add(t.rushDef,def.rush);state.set(team,t)}}
   for(const [team,id] of [[h,g.home_qb_id],[a,g.away_qb_id]]){const t=get(team);const val=stats.players.get(g.game_id+'|'+id);t.qb=val&&val.team===team?id:null;state.set(team,t);if(t.qb){qbMatched++;qbHistory.set(id,add(qb(id),val))}}
  }
 }
 const future=forecasts.map(g=>{if(Number(g.season)<season)throw Error('Forecast predates stats');if(Number(g.season)>season)transition(Number(g.season));return {...base.forecasts.find(x=>x.game_id===g.game_id),...{extra:features(g)}}});
 return {data:base.data.map(r=>({...r,extra:extra.get(r.game_id)})),forecasts:future,coverage:{team_games:matched,total_games:history.length,qb_starts:qbMatched,total_starts:history.length*2}};
}
export const expand=(r,kind)=>({...r,x:kind==='team'?r.x.concat(r.extra.x.slice(0,4)):kind==='qb'?r.x.concat(r.extra.x):r.x});
export function evaluateEfficiency(rows,stats,{development=[2023,2024],holdout=[2025,2026]}={}){
 const history=completedRows(rows).filter(r=>Number(r.season)>=2016),{data,coverage}=buildEfficiencyFeatures(history,stats);
 const records=[];for(const season of [...development,...holdout]){const train=data.filter(r=>r.season>2016&&r.season<season);const models=Object.fromEntries(['v2','team','qb'].map(k=>[k,fitLogistic(train.map(r=>expand(r,k)))]));for(const r of data.filter(r=>r.season===season)){records.push({season,y:r.y,...Object.fromEntries(Object.entries(models).map(([k,w])=>[k,predictLogistic(expand(r,k).x,w)])),market:noVigProbability(r.home_moneyline,r.away_moneyline)})}}
 const metrics=rs=>Object.fromEntries(['v2','team','qb','market'].map(k=>[k,scorePredictions(rs.filter(r=>r[k]!==null).map(r=>({p:r[k],y:r.y})))]));
 const dev=metrics(records.filter(r=>development.includes(r.season))),test=metrics(records.filter(r=>holdout.includes(r.season)));
 const better=(m,k)=>m[k].brier<m.v2.brier&&m[k].log_loss<m.v2.log_loss&&m[k].accuracy>=m.v2.accuracy-.01;
 const selected=['team','qb'].filter(k=>better(dev,k)).sort((a,b)=>dev[a].brier-dev[b].brier)[0]??null;
 const passed=Boolean(selected&&better(test,selected)&&coverage.team_games/coverage.total_games>=.98&&(selected!=='qb'||coverage.qb_starts/coverage.total_starts>=.90));
 return {model_version:EFFICIENCY_VERSION,history_last_date:history.at(-1)?.gameday,development_seasons:development,holdout_seasons:holdout,coverage,development:dev,holdout:test,selected, promotion_gate:{passed,requirements:'Select by development Brier only, improve Brier and log loss versus V2 on both splits, accuracy within 1pp, >=98% team coverage, >=90% prior starter coverage for QB variant.'},warning:'Retrospective prior-season fitting. QB features use previous completed-game starter, not actual or rumored future starter; no historical as-published timestamp archive. Historical moneylines only a benchmark, not a tradable result.'};
}
