// Fixed-horizon, prospective injury comparison. Never select a snapshot based on its prediction or outcome.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {scorePredictions} from './learned-matchup.mjs';
import {matchFinalScores} from './run-efficiency-shadow-settlement.mjs';
import {resultDate} from './paper-ledger.mjs';
export function selectObservations(observations){
 const chosen=new Map();
 for(const obs of observations){const time=Date.parse(obs.observed_at_utc);if(!Number.isFinite(time))continue;for(const g of obs.games??[]){const lead=Date.parse(g.kickoff_utc)-time;if(lead<3*3600000||lead>24*3600000)continue;const prev=chosen.get(g.game_id);if(!prev||time>Date.parse(prev.observed_at_utc))chosen.set(g.game_id,{...g,observed_at_utc:obs.observed_at_utc,baseline_model_digest:obs.baseline_model_digest})}}
 return [...chosen.values()].sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc)||a.game_id.localeCompare(b.game_id));
}
export function scoreObservations(games,finalScores){
 const final=new Map(finalScores.map(r=>[r.game_id,r])),paired=[],pending=[],excluded=[];
 for(const g of games){const r=final.get(g.game_id);if(!r){pending.push(g.game_id);continue}const p=g.baseline_home_win_probability,q=g.injury_shadow?.home_win_probability;if(r.home_score===r.away_score||![p,q].every(v=>Number.isFinite(v)&&v>0&&v<1)){excluded.push(g.game_id);continue}paired.push({game_id:g.game_id,y:Number(r.home_score>r.away_score),p,q})}
 return {selected_games:games.length,scored_games:paired.length,pending,excluded,metrics:{v2:scorePredictions(paired.map(r=>({p:r.p,y:r.y}))),injury:scorePredictions(paired.map(r=>({p:r.q,y:r.y})))},policy:'Latest archived observation 3–24 hours before kickoff, fixed independent of predictions and outcomes. Score only paired eligible probabilities and official final non-tie results.'};
}
if(process.argv[1]?.endsWith('score-pregame-observations.mjs')){
 const dir=new URL('./pregame-observations/',import.meta.url),file=new URL('./pregame-observation-results.json',import.meta.url);
 const files=(await readdir(dir)).filter(f=>f.endsWith('.json')).sort(),observations=[];
 for(const f of files){const {sha256,...obs}=JSON.parse(await readFile(new URL(f,dir),'utf8'));if(sha256!==createHash('sha256').update(JSON.stringify(obs)).digest('hex'))throw Error('Observation integrity check failed: '+f);observations.push(obs)}
 const games=selectObservations(observations);let previous={final_scores:[]};try{previous=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const pending=games.filter(g=>Date.parse(g.kickoff_utc)<Date.now()&&!previous.final_scores.some(r=>r.game_id===g.game_id)),results=[];
 for(const day of new Set(pending.map(g=>resultDate(g.kickoff_utc))))try{const r=await fetch('https://nfl-game-testing-model.iprorealtydave.workers.dev/api/results?date='+day,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);results.push(...(await r.json()).games)}catch(e){console.warn('Final scores unavailable for '+day+': '+e.message)}
 const final_scores=matchFinalScores({games},results,previous.final_scores),next={...scoreObservations(games,final_scores),final_scores,source:'Cloudflare /api/results (ESPN final scoreboard)',real_money_stake:0};
 if(JSON.stringify(next)!==JSON.stringify(previous))await writeFile(file,JSON.stringify(next,null,2)+'\n');console.log(JSON.stringify({selected_games:next.selected_games,scored_games:next.scored_games,pending:next.pending.length,metrics:next.metrics}));
}
