// Score every independently frozen three-book game (not just the paper tickets).
import {verifyValueTrial} from './value-paper-trial.mjs';
import {scorePredictions} from './learned-matchup.mjs';
import {FAVOURITE_BANDS} from './favourite-calibration.mjs';
export const FORWARD_VERSION='phase10-favourite-forward-v1';
const valid=p=>Number.isFinite(p)&&p>0&&p<1;
const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const books=['betmgm_ca_on','betano_ca_on','betrivers_ca_on'];
const stamp=s=>Date.parse(s);
function frozenGames(trial){
 if(!verifyValueTrial(trial))throw Error('Trial integrity failed: '+trial.slate);
 const ids=new Set();return trial.games.map(g=>{
  if(ids.has(g.game_id)||!valid(g.home_win_probability)||!Number.isFinite(stamp(trial.locked_at_utc))||!Number.isFinite(stamp(g.kickoff_utc))||stamp(g.kickoff_utc)<=stamp(trial.locked_at_utc)||g.quotes.length!==3||new Set(g.quotes.map(p=>p.book_key)).size!==3||g.quotes.some(p=>!books.includes(p.book_key)||!['home','away'].every(s=>Number.isFinite(p[s]?.decimal)&&p[s].decimal>1&&Number.isFinite(stamp(p[s].updated))&&stamp(p[s].updated)<=stamp(trial.locked_at_utc)&&stamp(trial.locked_at_utc)-stamp(p[s].updated)<=300000)))throw Error('Invalid frozen game '+g.game_id);
  ids.add(g.game_id);const market=g.quotes.reduce((sum,p)=>{const h=1/p.home.decimal,a=1/p.away.decimal;return sum+h/(h+a)},0)/3;
  return {game_id:g.game_id,home_team:g.home_team,away_team:g.away_team,kickoff_utc:g.kickoff_utc,trial_sha256:trial.sha256,locked_at_utc:trial.locked_at_utc,v2:g.home_win_probability,market};
 });
}
export function scoreFavouriteForward(trials,previous={},results=[],now=Date.now()){
 if(previous.version&&previous.version!==FORWARD_VERSION)throw Error('Unknown forward version');
 const byId=new Map((previous.games??[]).map(r=>[r.game_id,r]));const games=trials.flatMap(frozenGames).map(g=>{
  const prior=byId.get(g.game_id);if(prior){const {outcome,...locked}=prior;if(JSON.stringify(locked)!==JSON.stringify(g)||!['pending','tie','home','away'].includes(outcome))throw Error('Frozen forward record altered: '+g.game_id);if(outcome!=='pending')return prior}
  if(stamp(g.kickoff_utc)>=now)return {...g,outcome:'pending'};
  const matched=results.filter(r=>r.final===true&&normalize(r.home_team)===normalize(g.home_team)&&normalize(r.away_team)===normalize(g.away_team)&&Math.abs(stamp(r.kickoff_utc)-stamp(g.kickoff_utc))<3600000&&Number.isInteger(r.home_score)&&Number.isInteger(r.away_score)&&r.home_score>=0&&r.away_score>=0);
  if(matched.length!==1)return {...g,outcome:'pending'};const r=matched[0];return {...g,outcome:r.home_score===r.away_score?'tie':r.home_score>r.away_score?'home':'away'};
 });
 if(new Set(games.map(g=>g.game_id)).size!==games.length||[...byId.keys()].some(id=>!games.some(g=>g.game_id===id)))throw Error('Missing or duplicate frozen fixture');
 const scored=games.filter(g=>['home','away'].includes(g.outcome)),metrics=Object.fromEntries(['market','v2'].map(k=>[k,scorePredictions(scored.map(g=>({p:g[k],y:Number(g.outcome==='home')})))]));
 const bands=FAVOURITE_BANDS.map(([label,min,max])=>{const all=games.filter(g=>Math.max(g.market,1-g.market)>=min&&Math.max(g.market,1-g.market)<max),r=all.filter(g=>['home','away'].includes(g.outcome));const mean=fn=>r.length?r.reduce((s,g)=>s+fn(g),0)/r.length:null;return {label,locked:all.length,scored:r.length,favourite_win_rate:mean(g=>Number(g.outcome===(g.market>=.5?'home':'away'))),market_favourite_probability:mean(g=>Math.max(g.market,1-g.market)),v2_favourite_probability:mean(g=>g.market>=.5?g.v2:1-g.v2)}});
 return {version:FORWARD_VERSION,games,summary:{locked:games.length,scored:scored.length,ties:games.filter(g=>g.outcome==='tie').length,pending:games.filter(g=>g.outcome==='pending').length,metrics,bands},real_money_stake:0,warning:'No new betting strategy. Scores frozen V2 and three-book no-vig consensus against confirmed finals; skips ties for binary accuracy.'};
}
