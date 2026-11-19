import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {evaluateFavouriteCalibration} from './favourite-calibration.mjs';
const [input,output]=process.argv.slice(2);if(!input)throw Error('Pass nflverse schedule CSV');
const raw=await readFile(input,'utf8'),report={...evaluateFavouriteCalibration(parseCSV(raw)),source:{url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',sha256:createHash('sha256').update(raw).digest('hex')}};
console.log(JSON.stringify(report,null,2));if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
