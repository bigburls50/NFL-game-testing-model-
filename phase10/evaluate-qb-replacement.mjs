import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {indexDatedDepthCSV} from './qb-change-research.mjs';
import {evaluateReplacement} from './qb-replacement-research.mjs';
const [schedule,dir,output]=process.argv.slice(2);if(!schedule||!dir)throw Error('Pass schedule CSV and player/depth CSV directory');
const base='https://github.com/nflverse/nflverse-data/releases/download/',sources=[],players=[],depth=new Map();
async function read(path,url){const raw=await readFile(path,'utf8');sources.push({url,sha256:createHash('sha256').update(raw).digest('hex')});return raw}
const rows=parseCSV(await read(schedule,base+'schedules/games.csv'));
for(let year=2020;year<=2026;year++){const raw=await read(dir+'/player-'+year+'.csv',base+'stats_player/stats_player_week_'+year+'.csv');players.push(...parseCSV(raw).filter(r=>r.position==='QB'))}
for(const year of [2025,2026])depth.set(year,indexDatedDepthCSV(await read(dir+'/depth-'+year+'.csv',base+'depth_charts/depth_charts_'+year+'.csv')));
const report={...evaluateReplacement(rows,players,depth),sources};console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
