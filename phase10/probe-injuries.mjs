#!/usr/bin/env node
// Live 2026 nflverse injury-source probe. Does not claim complete weekly coverage.
import fs from 'node:fs';
import path from 'node:path';
import {fetchNflverseInjuries,injuryCandidates} from './nflverse-injuries-adapter.mjs';
export async function probeInjurySource(manifest,{fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 if(manifest.schedule_verified!==true||!Array.isArray(manifest.games)||!manifest.games.length)throw Error('Verified schedule required');
 const teams=[...new Set(manifest.games.flatMap(g=>[g.home_team,g.away_team]))];
 try{
  const source=await fetchNflverseInjuries(manifest.season,{fetchImpl});
  const rows=injuryCandidates(source,manifest.week,teams);
  const teamsReported=[...new Set(rows.map(r=>r.team))];
  const incomplete=teams.filter(team=>!teamsReported.includes(team));
  return {status:incomplete.length?'incomplete':'candidate_rows_available',season:manifest.season,week:manifest.week,checked_at_utc:asOf,source_url:source.source_url,source_digest:source.source_digest,total_source_rows:source.rows.length,week_candidate_rows:rows.length,teams_with_candidate_rows:teamsReported,teams_without_candidate_rows:incomplete,confirmed_starters:0,ready_for_forecast:false,warning:'Candidates only. Source release timestamp, official report completeness and injury status must be verified before use; absence of rows does not mean healthy.'};
 }catch(e){
  return {status:'unavailable',season:manifest.season,week:manifest.week,checked_at_utc:asOf,error:e.message,ready_for_forecast:false};
 }
}
if(process.argv[1]?.endsWith('probe-injuries.mjs')){
 const input=process.argv[2]??'phase10/upcoming-week11-2026.json',output=process.argv[3]??'phase10/data/injury-source-audit.json';
 try{
  const result=await probeInjurySource(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,rows:result.week_candidate_rows??0,ready_for_forecast:false}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
