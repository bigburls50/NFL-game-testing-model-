import {readFile,writeFile} from 'node:fs/promises';
import {TEAM_NAMES} from './public-predictions.mjs';
import {resultDate} from './paper-ledger.mjs';
import {scoreShadowSlate} from './efficiency-shadow.mjs';
const normalize=t=>String(t??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchFinalScores(slate,results,previous=[],now=Date.now()){
 const settled=new Map(previous.map(r=>[r.game_id,r]));
 for(const g of slate.games){
  if(settled.has(g.game_id)||Date.parse(g.kickoff_utc)>=now)continue;
  const matches=results.filter(r=>r.final===true&&normalize(r.home_team)===normalize(TEAM_NAMES[g.home_team])&&normalize(r.away_team)===normalize(TEAM_NAMES[g.away_team])&&Math.abs(Date.parse(r.kickoff_utc)-Date.parse(g.kickoff_utc))<3600000&&[r.home_score,r.away_score].every(n=>Number.isInteger(n)&&n>=0));
  if(matches.length!==1)continue;const r=matches[0];
  settled.set(g.game_id,{game_id:g.game_id,gameday:resultDate(g.kickoff_utc).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),game_type:'REG',season:Number(g.season??g.game_id.split('_')[0])||2026,home_team:g.home_team,away_team:g.away_team,home_score:r.home_score,away_score:r.away_score});
 }
 return slate.games.flatMap(g=>settled.has(g.game_id)?[settled.get(g.game_id)]:[]);
}
if(process.argv[1]?.endsWith('run-efficiency-shadow-settlement.mjs')){
 const slate=JSON.parse(await readFile(new URL('./efficiency-shadow-week11-2026.json',import.meta.url),'utf8')),file=new URL('./efficiency-shadow-week11-2026-results.json',import.meta.url);
 let previous={final_scores:[]};try{previous=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const pending=slate.games.filter(g=>Date.parse(g.kickoff_utc)<Date.now()&&!previous.final_scores.some(r=>r.game_id===g.game_id));
 const results=[];for(const day of new Set(pending.map(g=>resultDate(g.kickoff_utc))))try{const r=await fetch('https://nfl-game-testing-model.iprorealtydave.workers.dev/api/results?date='+day,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();results.push(...data.games)}catch(e){console.warn('Final scores unavailable: '+day+' '+e.message)}
 const final_scores=matchFinalScores(slate,results,previous.final_scores),next={...scoreShadowSlate(slate,final_scores),final_scores,source:'Cloudflare /api/results (ESPN final scoreboard)',real_money_stake:0};
 if(JSON.stringify(previous)!==JSON.stringify(next))await writeFile(file,JSON.stringify(next,null,2)+'\n');
 console.log(JSON.stringify({scored_games:next.scored_games,pending:next.pending.length,metrics:next.metrics}));
}
