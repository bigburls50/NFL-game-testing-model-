#!/usr/bin/env node
// Collect externally sourced, timestamped QB, injury and weather observations.
// Provider adapters accept explicit JSON endpoints; never manufacture missing values.
// All output is research-only until the provenance gate and forecast model pass.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {auditLiveFeatures} from './live-feature-gate.mjs';

const MAX_BYTES=3_000_000;
export async function fetchJson(url,{fetchImpl=fetch,timeoutMs=15000}={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!Number.isInteger(timeoutMs)||timeoutMs<1)throw Error('Only credential-free HTTPS source URLs are supported');
 const response=await fetchImpl(u.href,{headers:{Accept:'application/json','User-Agent':'NFL-Auto-Research/1.0'},signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
 if(!response.ok)throw Error('Source HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>MAX_BYTES)throw Error('Source exceeds size limit');
 return {data:JSON.parse(bytes.toString('utf8')),digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),source_url:u.href};
}
export async function collectLiveFeatures(schedule,{sources={},fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 if(!Array.isArray(schedule)||!schedule.length)throw Error('Verified schedule required');
 const observations=[],sourcesAudit=[];
 for(const kind of ['qb','injury','weather']){
  const url=sources[kind];
  if(!url){sourcesAudit.push({kind,status:'unconfigured'});continue;}
  try{
   const result=await fetchJson(url,{fetchImpl});
   if(!Array.isArray(result.data))throw Error('Source must return a JSON array');
   // An adapter must provide true observed and retrieved timestamps, stable IDs,
   // and normalized units. Do not substitute collection time for observation time.
   const items=result.data.map(row=>({...row,kind,source_url:result.source_url,source_digest:result.digest}));
   observations.push(...items);
   sourcesAudit.push({kind,status:'retrieved',rows:items.length,digest:result.digest,source_url:result.source_url});
  }catch(e){sourcesAudit.push({kind,status:'failed',reason:e.message});}
 }
 const audit=auditLiveFeatures(schedule,observations,{asOf});
 return {collected_at_utc:asOf,ready:audit.ready,source_audit:sourcesAudit,coverage:audit.coverage,errors:audit.errors,accepted:audit.accepted,warning:'Data collection does not establish a confirmed starter, a complete injury report, accurate weather, or predictive accuracy. No wagering.'};
}
if(process.argv[1]?.endsWith('collect-live-features.mjs')){
 try{
  const schedulePath=process.argv[2]??'phase10/upcoming-week11-2026.json';
  const outPath=process.argv[3]??'phase10/data/live-features-audit.json';
  const manifest=JSON.parse(fs.readFileSync(schedulePath,'utf8'));
  if(manifest.schedule_verified!==true)throw Error('Unverified schedule');
  const sources={qb:process.env.NFL_QB_JSON_URL,injury:process.env.NFL_INJURY_JSON_URL,weather:process.env.NFL_WEATHER_JSON_URL};
  const report=await collectLiveFeatures(manifest.games,{sources});
  fs.mkdirSync((await import('node:path')).dirname(outPath),{recursive:true});
  // Never expose source tokens or credentials in the artifact.
  fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ready:report.ready,coverage:report.coverage.length,sources:report.source_audit.map(({kind,status,rows})=>({kind,status,rows})),errors:report.errors.length}));
 }catch(e){console.error(e.message);process.exitCode=1}
}
