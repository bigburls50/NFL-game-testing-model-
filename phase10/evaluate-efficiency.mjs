import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {evaluateEfficiency,indexEfficiency} from './efficiency-model.mjs';
import {readEfficiencyFiles} from './efficiency-data.mjs';
const [schedule,dir,output]=process.argv.slice(2);if(!schedule||!dir)throw Error('Pass schedule CSV and stats directory');
const years=Array.from({length:11},(_,i)=>2016+i);
const [scheduleText,{team,player,sources}]=await Promise.all([readFile(schedule,'utf8'),readEfficiencyFiles(dir,years)]);
const report={...evaluateEfficiency(parseCSV(scheduleText),indexEfficiency(team,player)),sources:[{url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',sha256:createHash('sha256').update(scheduleText).digest('hex')},...sources]};console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
