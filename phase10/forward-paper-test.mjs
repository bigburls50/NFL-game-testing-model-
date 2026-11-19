// Prospective, fixed-slate research simulation. No sportsbook account or order API.
import {moneylinesByBook} from './moneyline.mjs';
import {paperStake,rankThreeGameParlay,floorCents} from './paper-math.mjs';
import {settleTicket,ledgerSummary,resultDate} from './paper-ledger.mjs';

export const TEST_POLICY=Object.freeze({version:'forward-betmgm-v1',bankroll:1000,bookKey:'betmgm_ca_on',maxSingles:3,maxExposure:.03});
const timestamp=t=>Date.parse(t);
function snapshot(l,q){return {gameId:l.gameId,team:l.team,home_team:l.home_team,away_team:l.away_team,kickoff_utc:l.kickoff_utc,probability:l.probability,model_version:l.model_version,model_digest:l.model_digest,prediction_status:l.prediction_status,prediction_created_utc:l.prediction_created_utc,decimal:q.decimal,price:q.price,quote_updated:q.updated}}
export function createTrial(model,market,now=Date.now()){
 if(market?.primary_bookmaker!==TEST_POLICY.bookKey||!Array.isArray(market.games)||!Array.isArray(model?.predictions))throw Error('Current Ontario feed and model predictions are required');
 const retrieved=timestamp(market.retrieved_at);if(!Number.isFinite(retrieved)||retrieved>now||now-retrieved>5*60000)throw Error('Market snapshot is stale');
 const legs=[];for(const g of model.predictions){const created=timestamp(g.prediction_created_utc),kickoff=timestamp(g.kickoff_utc);if(!['provisional','verified'].includes(g.status)||!Number.isFinite(created)||created>now||now-created>24*3600000||!(kickoff>now)||!Number.isFinite(g.home_win_probability)||g.home_win_probability<=0||g.home_win_probability>=1||!g.model_version||!/^sha256:[a-f0-9]{64}$/.test(g.model_digest??''))continue;
  const prices=moneylinesByBook(g,market,now);for(const side of ['home','away']){const quote=prices[side]?.find(q=>q.bookKey===TEST_POLICY.bookKey);if(!quote)continue;const probability=side==='home'?g.home_win_probability:1-g.home_win_probability;legs.push({gameId:g.game_id,team:g[side+'_team'],home_team:g.home_team,away_team:g.away_team,kickoff_utc:g.kickoff_utc,probability,model_version:g.model_version,model_digest:g.model_digest,prediction_status:g.status,prediction_created_utc:g.prediction_created_utc,quotes:[quote]})}}
 if(!legs.length)throw Error('No matched fresh BetMGM Ontario quotes and model predictions');
 const bank=TEST_POLICY.bankroll,highest=rankThreeGameParlay(legs,bank),value=rankThreeGameParlay(legs,bank,{valueOnly:true});
 const parlayStake=value.reason?0:value.stake;
 const ranked=legs.map(l=>({...l,projection:paperStake(l.probability,l.quotes[0].decimal,bank)})).filter(l=>l.projection?.stake>0).sort((a,b)=>b.projection.edge-a.projection.edge||a.gameId.localeCompare(b.gameId)||a.team.localeCompare(b.team));
 const chosen=[];for(const leg of ranked){if(!chosen.some(x=>x.gameId===leg.gameId))chosen.push(leg);if(chosen.length===TEST_POLICY.maxSingles)break}
 const sum=chosen.reduce((s,l)=>s+l.projection.stake,0),scale=sum?Math.min(1,(bank*TEST_POLICY.maxExposure-parlayStake)/sum):0;
 const tickets=chosen.map(l=>({kind:'single',book:l.quotes[0].book,stake:floorCents(l.projection.stake*scale),legs:[snapshot(l,l.quotes[0])],status:'pending',recorded_at:new Date(now).toISOString()})).filter(t=>t.stake>0);
 if(parlayStake>0)tickets.push({kind:'parlay',book:value.book,stake:parlayStake,legs:value.legs.map((l,i)=>snapshot(l,value.quotes[i])),status:'pending',recorded_at:new Date(now).toISOString(),estimated_combo:true});
 const describe=p=>p.reason?{reason:p.reason}:{probability:p.probability,decimal:p.decimal,edge:p.edge,stake:p.stake,legs:p.legs.map((l,i)=>snapshot(l,p.quotes[i]))};
 const observations=[...new Set(legs.map(l=>l.gameId))].map(id=>{const l=legs.filter(v=>v.gameId===id).sort((a,b)=>b.probability-a.probability)[0];return {kind:'observation',stake:0,status:'pending',legs:[snapshot(l,l.quotes[0])]}});
 return {policy:TEST_POLICY,started_at:new Date(now).toISOString(),model_metadata:model.model_metadata,odds_retrieved_at:market.retrieved_at,eligible_games:observations.length,highest_chance_parlay:describe(highest),value_parlay:describe(value),tickets,observations,summary:ledgerSummary(tickets),accuracy:accuracySummary(observations),real_money_stake:0,warning:'Provisional model and indicative odds. Paper returns only; parlay prices multiply same-book moneylines, not an offered combo.'};
}
export function accuracySummary(observations){const decisions=observations.filter(t=>['won','lost'].includes(t.status)),correct=decisions.filter(t=>t.status==='won').length;return {decisions:decisions.length,correct,ties:observations.filter(t=>t.status==='push').length,pending:observations.filter(t=>t.status==='pending').length,accuracy:decisions.length?correct/decisions.length:null,brier:decisions.length?decisions.reduce((s,t)=>s+(t.legs[0].probability-Number(t.status==='won'))**2,0)/decisions.length:null}}
export function updateTrial(trial,results){const tickets=trial.tickets.map(t=>settleTicket(t,results)),observations=(trial.observations??[]).map(t=>settleTicket(t,results));return {...trial,tickets,observations,summary:ledgerSummary(tickets),accuracy:accuracySummary(observations)}}
export function pendingResultDates(trial,now=Date.now()){return [...new Set([...trial.tickets,...(trial.observations??[])].filter(t=>t.status==='pending').flatMap(t=>t.legs).filter(l=>timestamp(l.kickoff_utc)<now).map(l=>resultDate(l.kickoff_utc)))].sort()}
