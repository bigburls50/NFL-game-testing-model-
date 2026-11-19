#!/usr/bin/env node
// Research-only rest comparison: fixed adjustment, identical games, no model promotion.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
import {augmentWithRest} from './rest-model.mjs';
import {compare} from './compare-models.mjs';
export function compareRest(ensemble,rest){
 const prepared=ensemble.map(p=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p.kickoff_date??'')))throw Error('Missing ISO kickoff_date: '+p.game_id);
  return {...p,gameday:p.kickoff_date};
 });
 const adjusted=augmentWithRest(prepared,rest);
 const used=adjusted.filter(x=>x.rest_features_used===1).length;
 const result=compare({ensemble:prepared,ensemble_plus_rest:adjusted});
 return {...result,rest_feature_games:used,rest_feature_coverage:used/prepared.length,
 warning:'Research-only fixed rest coefficient. Historical comparison is not a prospective, leakage-free trained-model validation; do not promote.'};
}
if(process.argv[1]?.endsWith('compare-rest.mjs')){
 try{
  const [ensemblePath,restPath,outputPath]=process.argv.slice(2);
  if(!ensemblePath||!restPath||!outputPath)throw Error('Usage: compare-rest.mjs ensemble.csv rest.csv report.json');
  const report=compareRest(parseCSV(fs.readFileSync(ensemblePath,'utf8')),parseCSV(fs.readFileSync(restPath,'utf8')));
  fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }catch(e){console.error(e.message);process.exitCode=1}
}
