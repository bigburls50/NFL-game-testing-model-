// Fetch and archive official NFL injury-report page with conservative, fail-closed coverage.
// The public HTML is not a documented API: a fetched page is NOT a complete team report.
import {createHash} from 'node:crypto';
import {extractOfficialInjuryTables} from './official-injury-table-extractor.mjs';
export async function collectOfficialInjuryPage(schedule,{fetchImpl=fetch,asOf=new Date().toISOString(),url='https://www.nfl.com/injuries/'}={}){
 const result={source_url:url,retrieved_at_utc:asOf,source_digest:null,teams:[],ready_for_forecast:false,errors:[]};
 try{
  if(new URL(url).hostname!=='www.nfl.com')throw Error('unapproved_injury_source');
  const response=await fetchImpl(url,{headers:{'User-Agent':'NFL-Auto-Research/1.0'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();
  if(!html||html.length>5_000_000)throw Error('invalid_document');
  result.source_digest='sha256:'+createHash('sha256').update(html).digest('hex');
  const parsed=extractOfficialInjuryTables(html);
  result.player_tables=parsed.tables;
  result.table_errors=parsed.errors;
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  for(const game of schedule)for(const team of [game.home_team,game.away_team]){
   result.teams.push({game_id:game.game_id,team,verified:false,complete_report:false,explicit_no_injuries:false,source_url:url,retrieved_at_utc:asOf,reason:'official_page_requires_verified_team_section_and_publication_timestamp'});
  }
  result.page_mentions_injury_report=/injur(?:y|ies)/i.test(text);
 }catch(e){result.errors.push({reason:e.message});}
 return result;
}
