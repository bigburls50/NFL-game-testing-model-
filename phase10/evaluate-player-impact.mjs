import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {evaluatePlayerImpact} from './player-impact-research.mjs';
const [schedule,statsDir,injuryDir,output]=process.argv.slice(2);if(!schedule||!statsDir||!injuryDir)throw Error('Pass schedule CSV, snap counts directory, injury directory, optional output');
const sources=[],snap=[],injuries=[];
async function read(path,url){const raw=await readFile(path,'utf8');sources.push({url,sha256:createHash('sha256').update(raw).digest('hex')});return parseCSV(raw)}
const games=await read(schedule,'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv'),players=await read(statsDir+'/players.csv','https://github.com/nflverse/nflverse-data/releases/download/players/players.csv');
for(let y=2016;y<=2026;y++){
 snap.push(...await read(statsDir+'/snap-'+y+'.csv','https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_'+y+'.csv'));
 injuries.push(...await read(injuryDir+'/injuries-'+y+'.csv','https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_'+y+'.csv'));
}
const report={...evaluatePlayerImpact(games,snap,players,injuries),sources};console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
