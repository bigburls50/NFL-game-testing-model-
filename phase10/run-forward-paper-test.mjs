import {readFile,writeFile} from 'node:fs/promises';
import {createTrial,updateTrial,pendingResultDates} from './forward-paper-test.mjs';
const base='https://nfl-game-testing-model.iprorealtydave.workers.dev';
const file=new URL('./forward-paper-results.json',import.meta.url);
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw Error(`${path} HTTP ${r.status}`);return r.json()}
if(process.argv.includes('--start')){
 // Explicit start only; never create a new slate during unattended settlement.
 const [model,market]=await Promise.all([get('/api/predictions'),get('/api/odds')]);const trial=createTrial(model,market);console.log(JSON.stringify(trial,null,2));
}else{
 const original=await readFile(file,'utf8'),trial=JSON.parse(original),results=[];
 for(const date of pendingResultDates(trial)){try{const data=await get('/api/results?date='+date);results.push(...(data.games??[]))}catch(e){console.warn(`Unconfirmed score date ${date}: ${e.message}`)}}
 const next=updateTrial(trial,results);if(JSON.stringify(trial)!==JSON.stringify(next))await writeFile(file,JSON.stringify(next,null,2)+'\n');
 console.log(`Paper settlement: ${next.summary.settled} settled, ${next.summary.pending} pending; realized P/L ${next.summary.pnl.toFixed(2)} CAD. No real-money bets.`);
}
