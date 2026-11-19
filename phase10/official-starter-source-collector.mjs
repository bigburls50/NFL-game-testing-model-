// Retrieve official team/NFL announcement pages; derive publication timestamp from document metadata.
// Retrieved pages remain UNCONFIRMED until named starter, team, game and identity are verified.
import {createHash} from 'node:crypto';
function publishedFromHtml(html){
 const patterns=[/<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["']/i,/"datePublished"\s*:\s*"([^"]+)"/i];
 for(const p of patterns){const match=html.match(p);if(match&&Number.isFinite(Date.parse(match[1])))return new Date(match[1]).toISOString();}
 return null;
}
export async function collectOfficialStarterEvidence(sources,{fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 if(!Array.isArray(sources))throw Error('Official source configuration required');
 const evidence=[],errors=[];
 for(const [i,s] of sources.entries()){
  try{
   const url=new URL(s.url);
   if(url.protocol!=='https:'||!(url.hostname==='nfl.com'||url.hostname.endsWith('.nfl.com')||s.approved_team_hostname===url.hostname))throw Error('unapproved_host');
   const response=await fetchImpl(url.toString(),{redirect:'follow',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const html=await response.text();
   if(html.length>2000000)throw Error('oversized_document');
   const published=publishedFromHtml(html);
   if(!published||Date.parse(published)>Date.parse(asOf))throw Error('missing_or_future_publication_timestamp');
   evidence.push({game_id:s.game_id,team:s.team,source_url:url.toString(),published_at_utc:published,retrieved_at_utc:asOf,document_sha256:'sha256:'+createHash('sha256').update(html).digest('hex'),html,review_status:'pending_explicit_starter_confirmation',status:'unconfirmed'});
  }catch(e){errors.push({index:i,reason:e.message});}
 }
 return {evidence,errors,confirmed_starters:0,ready_for_forecast:false,warning:'Retrieval and publication timestamps are automatic. Do not treat a headline, depth chart or stale announcement as confirmation for this specific game.'};
}
