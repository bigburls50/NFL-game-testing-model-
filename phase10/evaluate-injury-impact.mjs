import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {evaluateInjuryImpact} from './injury-impact-research.mjs';
const [schedule,dir,output]=process.argv.slice(2);if(!schedule||!dir)throw Error('Pass schedule CSV and injuries directory');
const raw=await readFile(schedule,'utf8'),sources=[{url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',sha256:createHash('sha256').update(raw).digest('hex')}],injuries=[];
for(let year=2016;year<=2026;year++){const text=await readFile(dir+'/injuries-'+year+'.csv','utf8');injuries.push(...parseCSV(text));sources.push({url:'https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_'+year+'.csv',sha256:createHash('sha256').update(text).digest('hex')})}
const report={...evaluateInjuryImpact(parseCSV(raw),injuries),sources};console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
