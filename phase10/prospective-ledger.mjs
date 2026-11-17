#!/usr/bin/env node
// Audit a precommitted prospective prediction ledger. No wagers, no model fitting.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
export function auditProspective(rows,{now=Date.now()}={}){
 if(!Number.isFinite(now))throw Error('Invalid audit time');
 const seen=new Set(),issues=[],valid=[];
 for(const [i,r] of rows.entries()){
  const id=String(r.game_id??'').trim(),p=Number(r.home_win_probability);
  const kickoff=Date.parse(r.kickoff_utc??''),locked=Date.parse(r.prediction_locked_utc??'');
  const source=String(r.model_version??'').trim(),digest=String(r.prediction_sha256??'').trim();
  const errors=[];
  if(!id||seen.has(id))errors.push('missing_or_duplicate_game_id');
  if(!(p>0&&p<1))errors.push('invalid_probability');
  if(!Number.isFinite(kickoff)||!Number.isFinite(locked)||locked>=kickoff)errors.push('not_locked_before_kickoff');
  if(!source)errors.push('missing_model_version');
  if(!/^[0-9a-f]{64}$/i.test(digest))errors.push('missing_sha256_commitment');
  if(Number.isFinite(locked)&&locked>now)errors.push('future_lock_timestamp');
  if(!r.home_team||!r.away_team||r.home_team===r.away_team)errors.push('invalid_teams');
  if(errors.length)issues.push({row:i+1,game_id:id,errors});else valid.push({...r});
  seen.add(id);
 }
 return {accepted:valid.length,rejected:issues.length,issues,ready:rows.length>0&&issues.length===0,warning:'CSV timestamps and claimed hashes are not independently trusted. Verify hash against an externally timestamped immutable commitment before prospective claims; this audit alone does not prove pregame provenance.'};
}
if(process.argv[1]?.endsWith('prospective-ledger.mjs')){try{
 const file=process.argv[2];if(!file)throw Error('Usage: prospective-ledger.mjs ledger.csv');
 const report=auditProspective(parseCSV(fs.readFileSync(file,'utf8')));
 console.log(JSON.stringify(report,null,2));if(!report.ready)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1}}
