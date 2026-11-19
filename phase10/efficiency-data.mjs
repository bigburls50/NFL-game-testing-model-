import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
// Stable per-file provenance; retain only the relevant weekly QB rows in memory.
export async function readEfficiencyFiles(dir,years){
 const team=[],player=[],sources=[];
 for(const year of years)for(const kind of ['team','player']){
  const content=await readFile(dir+'/'+kind+'-'+year+'.csv','utf8'),rows=parseCSV(content);
  sources.push({url:'https://github.com/nflverse/nflverse-data/releases/download/stats_'+kind+'/stats_'+kind+'_week_'+year+'.csv',sha256:createHash('sha256').update(content).digest('hex')});
  (kind==='team'?team:player).push(...(kind==='player'?rows.filter(r=>r.position==='QB'):rows));
 }
 return {team,player,sources};
}
