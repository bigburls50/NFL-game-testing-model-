import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {publicPredictions} from './public-predictions.mjs';
import {createValueTrial,settleValueTrials,verifyValueTrial} from './value-paper-trial.mjs';
import {resultDate} from './paper-ledger.mjs';
const base='https://nfl-game-testing-model.iprorealtydave.workers.dev',dir=new URL('./value-paper-trials/',import.meta.url),resultFile=new URL('./value-paper-trial-results.json',import.meta.url);
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json()}
await mkdir(dir,{recursive:true});
if(process.argv.includes('--capture')){
 const feed=JSON.parse(await readFile(new URL('./live-predictions.json',import.meta.url),'utf8')),model=publicPredictions(feed),slate=model.predictions[0]?.game_id?.slice(0,7);
 if(slate&&/^\d{4}_\d{2}$/.test(slate)){
  const name=new URL(slate+'.json',dir);let exists=false;try{const trial=JSON.parse(await readFile(name,'utf8'));if(!verifyValueTrial(trial))throw Error('Locked slate failed integrity');exists=true}catch(e){if(e.code!=='ENOENT')throw e}
  if(!exists){const market=await get('/api/odds'),trial=createValueTrial(model,market);await writeFile(name,JSON.stringify(trial,null,2)+'\n',{flag:'wx'});console.log('Locked new prospectively priced paper slate '+trial.slate+' ('+trial.eligible_games+' games)')}else console.log('Existing slate remains locked: '+slate);
 }
}
const files=(await readdir(dir)).filter(f=>/^\d{4}_\d{2}\.json$/.test(f)).sort(),trials=[];for(const f of files)trials.push(JSON.parse(await readFile(new URL(f,dir),'utf8')));
let previous={slates:{}};try{previous=JSON.parse(await readFile(resultFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const pending=trials.flatMap(t=>Object.entries(t.strategies).flatMap(([k,v])=>(previous.slates?.[t.slate]?.[k]??v.tickets).filter(t=>t.status==='pending').flatMap(t=>t.legs))).filter(l=>Date.parse(l.kickoff_utc)<Date.now()),results=[];
for(const date of new Set(pending.map(l=>resultDate(l.kickoff_utc))))try{results.push(...(await get('/api/results?date='+date)).games)}catch(e){console.warn('Unconfirmed score date '+date+': '+e.message)}
const next=settleValueTrials(trials,previous,results);if(JSON.stringify(next)!==JSON.stringify(previous))await writeFile(resultFile,JSON.stringify(next,null,2)+'\n');console.log(JSON.stringify({slates:trials.length,summary:next.summary}));
