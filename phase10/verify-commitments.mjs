#!/usr/bin/env node
// Verify exact canonical prediction payloads against independently supplied SHA-256 commitments.
// This checks integrity, NOT when the commitment was published.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
import {auditProspective} from './prospective-ledger.mjs';
const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function strictUtc(value){return typeof value==='string'&&ISO_UTC.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19)}
export function canonicalPrediction(r){
 const fields=['game_id','kickoff_utc','prediction_locked_utc','model_version','home_team','away_team','home_win_probability'];
 const values=fields.map(k=>String(r[k]??'').trim());
 if(values.some(v=>!v))throw Error('Missing canonical prediction field');
 if(!strictUtc(values[1])||!strictUtc(values[2]))throw Error('UTC timestamps must be valid explicit ISO Z dates');
 const p=Number(values[6]);if(!(p>0&&p<1)||!Number.isFinite(p))throw Error('Invalid probability');
 values[6]=p.toString();
 return JSON.stringify(Object.fromEntries(fields.map((k,i)=>[k,values[i]])));
}
export function verifyCommitments(rows,manifest,{now=Date.now()}={}){
 const audit=auditProspective(rows,{now}),issues=[...audit.issues];
 const entries=manifest?.commitments;
 if(!Array.isArray(entries))return {ready:false,prospective_verified:false,issues:[...issues,{error:'Missing commitment manifest'}],warning:'Hash integrity alone does not establish external pre-kickoff publication'};
 const byId=new Map();
 for(const e of entries){if(!e||!e.game_id||byId.has(e.game_id)){issues.push({error:'Duplicate or invalid manifest game ID'});continue}byId.set(e.game_id,e)}
 for(const r of rows){
  try{
   const e=byId.get(r.game_id),hash=createHash('sha256').update(canonicalPrediction(r),'utf8').digest('hex');
   if(!e||e.sha256!==hash||r.prediction_sha256!==hash)issues.push({game_id:r.game_id,error:'Commitment hash mismatch or absent'});
   if(!strictUtc(e?.published_at_utc)||Date.parse(e.published_at_utc)<Date.parse(r.prediction_locked_utc)||Date.parse(e.published_at_utc)>=Date.parse(r.kickoff_utc)||Date.parse(e.published_at_utc)>now)issues.push({game_id:r.game_id,error:'Invalid, premature, future or late publication claim'});
  }catch(err){issues.push({game_id:r.game_id,error:err.message})}
 }
 for(const id of byId.keys())if(!rows.some(r=>r.game_id===id))issues.push({game_id:id,error:'Unmatched manifest commitment'});
 return {ready:audit.ready&&issues.length===0,prospective_verified:false,accepted:audit.accepted,issues,warning:'Manifest publication timestamps are self-asserted. Independent immutable third-party timestamp evidence is still mandatory before prospective performance claims.'};
}
if(process.argv[1]?.endsWith('verify-commitments.mjs')){try{
 const [ledger,manifest]=process.argv.slice(2);if(!ledger||!manifest)throw Error('Usage: verify-commitments.mjs ledger.csv manifest.json');
 const r=verifyCommitments(parseCSV(fs.readFileSync(ledger,'utf8')),JSON.parse(fs.readFileSync(manifest,'utf8')));
 console.log(JSON.stringify(r,null,2));if(!r.ready)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1}}
