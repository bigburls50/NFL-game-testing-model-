// Independently archived near-kickoff price benchmark. No wagers and no claim of closing odds.
import {createHash} from 'node:crypto';
import {completeQuotePairs,verifyValueTrial} from './value-paper-trial.mjs';
export const CHECKPOINT_VERSION='phase10-pregame-price-proxy-v1';
export const WINDOW_MS=4*3600000;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const stamp=x=>Date.parse(x);
const fresh=(x,now)=>Number.isFinite(stamp(x))&&stamp(x)<=now&&now-stamp(x)<=5*60000;
const strategies=['v2','market_anchor'];
const legs=trial=>strategies.flatMap(k=>trial.strategies[k].tickets.flatMap(t=>t.legs));
const eligible=(g,t,now)=>stamp(g.kickoff_utc)>now&&stamp(g.kickoff_utc)-now<=WINDOW_MS&&now>stamp(t.locked_at_utc);
export function needsCheckpoint(trials,now=Date.now()){
 return trials.some(t=>verifyValueTrial(t)&&legs(t).some(g=>eligible(g,t,now)));
}
export function createCheckpoint(trials,market,now=Date.now()){
 if(market.status!=='available'||market.primary_bookmaker!=='betmgm_ca_on'||!fresh(market.retrieved_at,now))throw Error('No fresh Ontario prices for benchmark');
 const games=[];
 for(const trial of trials){
  if(!verifyValueTrial(trial))throw Error('Locked value trial integrity failed: '+trial.slate);
  const unique=new Map(legs(trial).map(g=>[g.gameId,g]));
  for(const g of unique.values()){
   if(!eligible(g,trial,now))continue;
   const pairs=completeQuotePairs(g,market,now);
   if(pairs.length!==3||new Set(pairs.map(p=>p.book_key)).size!==3||pairs.some(p=>stamp(p.home.updated)<=stamp(trial.locked_at_utc)))continue;
   games.push({slate:trial.slate,trial_sha256:trial.sha256,game_id:g.gameId,kickoff_utc:g.kickoff_utc,quotes:pairs});
  }
 }
 const body={version:CHECKPOINT_VERSION,captured_at_utc:new Date(now).toISOString(),market_retrieved_at:market.retrieved_at,market_source:market.source,games,real_money_stake:0};
 return {...body,sha256:digest(body)};
}
export function verifyCheckpoint(c){const {sha256,...body}=c;return c.version===CHECKPOINT_VERSION&&c.real_money_stake===0&&digest(body)===sha256}
function benchmark(leg,trial,checkpoints){
 const candidates=[];
 for(const c of checkpoints){
  const now=stamp(c.captured_at_utc);
  if(!eligible(leg,trial,now)||!fresh(c.market_retrieved_at,now))continue;
  const g=c.games.find(x=>x.trial_sha256===trial.sha256&&x.slate===trial.slate&&x.game_id===leg.gameId&&x.kickoff_utc===leg.kickoff_utc);
  if(!g||g.quotes.length!==3||new Set(g.quotes.map(p=>p.book_key)).size!==3)continue;
  const side=leg.team===leg.home_team?'home':leg.team===leg.away_team?'away':null;
  if(!side)continue;
  const q=g.quotes.find(p=>p.book_key===leg.book_key),others=g.quotes.filter(p=>leg.reference_books.includes(p.book_key)&&p.book_key!==leg.book_key);
  if(!q||others.length!==2||g.quotes.some(p=>!fresh(p.home.updated,now)||p.home.updated!==p.away.updated||stamp(p.home.updated)<=stamp(trial.locked_at_utc)||!['home','away'].every(s=>Number.isFinite(p[s].decimal)&&p[s].decimal>1)))continue;
  const fair=others.reduce((sum,p)=>{const h=1/p.home.decimal,a=1/p.away.decimal;return sum+(side==='home'?h:a)/(h+a)},0)/others.length;
  candidates.push({captured_at_utc:c.captured_at_utc,minutes_before_kickoff:(stamp(leg.kickoff_utc)-now)/60000,locked_decimal:leg.decimal,later_decimal:q[side].decimal,same_book_price_edge:leg.decimal/q[side].decimal-1,reference_fair_probability:fair,fair_price_edge:leg.decimal*fair-1,checkpoint_sha256:c.sha256});
 }
 return candidates.sort((a,b)=>stamp(b.captured_at_utc)-stamp(a.captured_at_utc))[0]??null;
}
export function summarizeCheckpoints(trials,checkpoints){
 for(const t of trials)if(!verifyValueTrial(t))throw Error('Locked trial integrity failed');
 for(const c of checkpoints)if(!verifyCheckpoint(c))throw Error('Price checkpoint integrity failed');
 const summary={},slates={};
 for(const t of trials){slates[t.slate]={};for(const key of strategies){slates[t.slate][key]=t.strategies[key].tickets.map(ticket=>{const leg=ticket.legs[0];return {game_id:leg.gameId,team:leg.team,book_key:leg.book_key,kickoff_utc:leg.kickoff_utc,benchmark:benchmark(leg,t,checkpoints)}})}}
 for(const key of strategies){const rows=Object.values(slates).flatMap(s=>s[key]),b=rows.map(r=>r.benchmark).filter(Boolean),mean=field=>b.length?b.reduce((s,r)=>s+r[field],0)/b.length:null;summary[key]={tickets:rows.length,benchmarked:b.length,positive_same_book:b.filter(r=>r.same_book_price_edge>0).length,mean_same_book_price_edge:mean('same_book_price_edge'),mean_fair_price_edge:mean('fair_price_edge'),mean_minutes_before_kickoff:mean('minutes_before_kickoff')}}
 return {version:CHECKPOINT_VERSION,summary,slates,real_money_stake:0,warning:'Latest archived price within four hours before kickoff; NOT verified closing odds. Same-book price movement and other-book no-vig comparison are research signals, not proof of profit.'};
}
