// Prospective Ontario price-shopping test. Independent of existing fixed paper trial; no money or orders.
import {createHash} from 'node:crypto';
import {moneylinesByBook} from './moneyline.mjs';
import {paperStake} from './paper-math.mjs';
import {settleTicket,ledgerSummary} from './paper-ledger.mjs';
import {blendProbability,VALUE_POLICY,VALUE_VERSION} from './value-research.mjs';
import report from './value-research-validation.json' with {type:'json'};
const BOOKS=new Set(['betmgm_ca_on','betano_ca_on','betrivers_ca_on']);
const fresh=(t,now,ms)=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=now&&now-Date.parse(t)<=ms;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const STRATEGIES=['v2','market_anchor'];
export function completeQuotePairs(game,market,now){
 const q=moneylinesByBook(game,market,now),paired=[];
 for(const home of q.home??[]){const away=(q.away??[]).find(a=>a.bookKey===home.bookKey);if(BOOKS.has(home.bookKey)&&away&&home.updated===away.updated&&fresh(home.updated,now,5*60000)){const h=1/home.decimal,a=1/away.decimal;paired.push({book_key:home.bookKey,home,away,no_vig_home_probability:h/(h+a)})}}
 return paired;
}
export function bestTrialLeg(game,pairs,weight,key,policy=VALUE_POLICY){
 const candidates=[];
 for(const pair of pairs){const others=pairs.filter(v=>v.book_key!==pair.book_key);if(others.length<2)continue;
  const reference=others.reduce((s,v)=>s+v.no_vig_home_probability,0)/others.length;
  const homeProbability=key==='v2'?game.home_win_probability:blendProbability(game.home_win_probability,reference,weight);
  for(const side of ['home','away']){const q=pair[side],p=side==='home'?homeProbability:1-homeProbability,edge=p*q.decimal-1;if(edge<policy.min_ev)continue;const projection=paperStake(p,q.decimal,policy.virtual_weekly_bankroll);if(!projection||projection.stake<=0)continue;
   candidates.push({gameId:game.game_id,team:game[side+'_team'],home_team:game.home_team,away_team:game.away_team,kickoff_utc:game.kickoff_utc,probability:p,model_version:game.model_version,model_digest:game.model_digest,prediction_created_utc:game.prediction_created_utc,book:q.book,book_key:q.bookKey,decimal:q.decimal,price:q.price,quote_updated:q.updated,reference_books:others.map(v=>v.book_key),reference_home_probability:reference,edge,stake:projection.stake})
  }
 }
 return candidates.sort((a,b)=>b.edge-a.edge||b.decimal-a.decimal||a.book_key.localeCompare(b.book_key))[0]??null;
}
export function createValueTrial(model,market,now=Date.now()){
 if(model.model_metadata?.version!=='phase10-causal-logistic-v2'||market.status!=='available'||market.primary_bookmaker!=='betmgm_ca_on'||!fresh(market.retrieved_at,now,5*60000))throw Error('Missing current V2 or Ontario market evidence');
 const games=(model.predictions??[]).filter(g=>g.model_version===model.model_metadata.version&&g.model_digest===model.model_metadata.digest&&/^sha256:[a-f0-9]{64}$/.test(g.model_digest)&&['provisional','verified'].includes(g.status)&&fresh(g.prediction_created_utc,now,24*3600000)&&Date.parse(g.kickoff_utc)-now>=3*3600000&&g.home_win_probability>0&&g.home_win_probability<1&&/^\d{4}_\d{2}_/.test(g.game_id));
 if(!games.length)throw Error('No eligible pregame V2 fixtures');const slate=games[0].game_id.slice(0,7),season=Number(slate.slice(0,4)),weight=report.fit_weights_by_season[season];
 if(!Number.isFinite(weight)||games.some(g=>g.game_id.slice(0,7)!==slate))throw Error('Missing prior-season blend or mixed week');
 const gamesWithQuotes=games.map(g=>({g,pairs:completeQuotePairs(g,market,now)})).filter(r=>r.pairs.length===BOOKS.size);
 if(!gamesWithQuotes.length||gamesWithQuotes.length/games.length<.8)throw Error('Incomplete three-book quote coverage');
 const strategies={};for(const key of STRATEGIES){const legs=gamesWithQuotes.map(({g,pairs})=>bestTrialLeg(g,pairs,weight,key)).filter(Boolean).sort((a,b)=>b.edge-a.edge||a.gameId.localeCompare(b.gameId)).slice(0,VALUE_POLICY.max_singles);
  strategies[key]={tickets:legs.map(l=>({kind:'single',book:l.book,stake:l.stake,legs:[l],status:'pending',recorded_at:new Date(now).toISOString()})),eligible_selections:legs.length}}
 const trial={version:VALUE_VERSION,slate,locked_at_utc:new Date(now).toISOString(),model_metadata:model.model_metadata,market_retrieved_at:market.retrieved_at,market_source:market.source,policy:VALUE_POLICY,blend_model_weight:weight,model_games:games.length,eligible_games:gamesWithQuotes.length,games:gamesWithQuotes.map(({g,pairs})=>({game_id:g.game_id,home_team:g.home_team,away_team:g.away_team,kickoff_utc:g.kickoff_utc,home_win_probability:g.home_win_probability,model_version:g.model_version,model_digest:g.model_digest,quotes:pairs})),strategies,real_money_stake:0,warning:'Paper trial only; indicative Ontario quotes, no execution. Market anchor uses other books as reference, not true known probability. No wagers. Weekly stakes fixed to virtual $1,000.'};
 return {...trial,sha256:digest(trial)};
}
export function verifyValueTrial(trial){const {sha256,...body}=trial;return digest(body)===sha256}
export function settleValueTrials(trials,previous,finalScores){
 const updates={};for(const trial of trials){if(!verifyValueTrial(trial))throw Error('Locked value trial integrity failed: '+trial.slate);updates[trial.slate]={};for(const key of STRATEGIES){const original=trial.strategies[key].tickets,existing=previous?.slates?.[trial.slate]?.[key]??original;
   if(existing.length!==original.length||existing.some((t,i)=>t.stake!==original[i].stake||JSON.stringify(t.legs)!==JSON.stringify(original[i].legs)))throw Error('Locked tickets altered');
   updates[trial.slate][key]=existing.map(t=>settleTicket(t,finalScores))
 }}
 const summary={};for(const key of STRATEGIES){const tickets=Object.values(updates).flatMap(s=>s[key]);const realized=ledgerSummary(tickets);let equity=1000,peak=1000,maxDrawdown=0;for(const slate of Object.values(updates)){const t=slate[key];if(t.some(r=>r.status==='pending'))continue;equity+=ledgerSummary(t).pnl;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,(peak-equity)/peak)}
  summary[key]={...realized,tickets:tickets.length,turnover:tickets.filter(t=>t.status!=='pending').reduce((s,t)=>s+t.stake,0),flat_unit_roi:realized.settled?tickets.filter(t=>t.status!=='pending').reduce((s,t)=>s+(t.status==='won'?t.legs[0].decimal-1:t.status==='lost'?-1:0),0)/realized.settled:null,completed_week_drawdown:maxDrawdown}}
 return {version:VALUE_VERSION,slates:updates,summary,real_money_stake:0,warning:'Locked quotes and paper stakes; results from final-score feed only. No real-money betting.'};
}
