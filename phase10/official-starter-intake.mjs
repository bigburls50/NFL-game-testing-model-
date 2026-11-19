// Source-stamped official starter intake. A URL alone never confirms a starter.
import {createHash} from 'node:crypto';
import {confirmedStarterCoverage} from './confirmed-starters.mjs';
export function ingestOfficialStarters(schedule,documents,{asOf=new Date().toISOString()}={}){
 if(!Array.isArray(documents))throw Error('Starter documents required');
 const records=[],rejected=[];
 for(const [i,d] of documents.entries()){
  const source=d.source_url??'';
  const official=/^https:\/\/(?:www\.)?(?:nfl\.com|[a-z0-9-]+\.com)\//i.test(source)&&d.source_type==='official_team_or_league';
  const published=Date.parse(d.published_at_utc),retrieved=Date.parse(d.retrieved_at_utc),now=Date.parse(asOf);
  if(!official||!Number.isFinite(published)||!Number.isFinite(retrieved)||published>retrieved||retrieved>now||!d.source_excerpt||!d.player_id||!d.player_name||d.explicitly_named_starter!==true||d.confirmation_type!=='confirmed'){
   rejected.push({index:i,reason:'missing_official_confirmation_or_provenance'});continue;
  }
  records.push({game_id:d.game_id,team:d.team,player_id:d.player_id,player_name:d.player_name,status:'confirmed',source_url:source,confirmed_at_utc:d.published_at_utc,retrieved_at_utc:d.retrieved_at_utc,source_digest:'sha256:'+createHash('sha256').update(d.source_excerpt).digest('hex')});
 }
 const audit=confirmedStarterCoverage(schedule,records,{asOf});
 return {records:audit.accepted,coverage:audit.coverage,errors:[...rejected,...audit.errors],ready:audit.ready,warning:'This verifies supplied official evidence; it does not scrape or independently authenticate an official website. Never infer starters from depth charts.'};
}
