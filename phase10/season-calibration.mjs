#!/usr/bin/env node
// Chronological season-by-season audit. Descriptive only: this does not retrain models.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
import {calibration} from './calibration-diagnostics.mjs';
export function seasonAudit(rows,{firstSeason=2023,threshold=.75}={}){
 if(!Number.isInteger(firstSeason))throw Error('Invalid first season');
 const ids=new Set(),years=new Map();
 for(const r of rows){
  const season=Number(r.season);
  if(!r.game_id||ids.has(r.game_id)||!Number.isInteger(season))throw Error('Missing/duplicate game or invalid season');
  ids.add(r.game_id);
  if(!years.has(season))years.set(season,[]);
  years.get(season).push(r);
 }
 const seasons=[...years.keys()].filter(s=>s>=firstSeason).sort((a,b)=>a-b);
 if(!seasons.length)throw Error('No evaluation seasons');
 const reports=Object.fromEntries(seasons.map(s=>[s,calibration(years.get(s),{threshold})]));
 const all=calibration(seasons.flatMap(s=>years.get(s)),{threshold});
 return {first_evaluation_season:firstSeason,years:seasons,by_season:reports,combined:all,
  warning:'Chronological descriptive reporting only. This script does not prove that models were trained solely on earlier seasons or that thresholds were predeclared. Freeze parameters before prospective evaluation.'};
}
if(process.argv[1]?.endsWith('season-calibration.mjs')){try{
 const [file,year]=process.argv.slice(2);if(!file)throw Error('Usage: season-calibration.mjs predictions.csv [first-season]');
 console.log(JSON.stringify(seasonAudit(parseCSV(fs.readFileSync(file,'utf8')),{firstSeason:year?Number(year):2023}),null,2));
}catch(e){console.error(e.message);process.exitCode=1}}
