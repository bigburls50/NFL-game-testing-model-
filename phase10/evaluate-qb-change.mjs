import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {readEfficiencyFiles} from './efficiency-data.mjs';
import {evaluateQBChanges,indexDatedDepthCSV} from './qb-change-research.mjs';
const [schedule,statsDir,depthDir,output]=process.argv.slice(2);if(!schedule||!statsDir||!depthDir)throw Error('Pass schedule CSV, weekly stats directory, dated depth chart directory, optional output');
const raw=await readFile(schedule,'utf8'),sources=[{url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',sha256:createHash('sha256').update(raw).digest('hex')}],depth=new Map();
for(const year of [2025,2026]){const text=await readFile(depthDir+'/depth-'+year+'.csv','utf8');depth.set(year,indexDatedDepthCSV(text));sources.push({url:'https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_'+year+'.csv',sha256:createHash('sha256').update(text).digest('hex')})}
const {player,sources:statsSources}=await readEfficiencyFiles(statsDir,Array.from({length:11},(_,i)=>2016+i));
const report={...evaluateQBChanges(parseCSV(raw),player,depth),sources:[...sources,...statsSources.filter(s=>s.url.includes('/stats_player/'))]};console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
