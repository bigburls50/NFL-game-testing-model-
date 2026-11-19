// Optional structured injury corroboration. This feed alone never certifies an official final report.
import {createHash} from 'node:crypto';
export function parseSportradarWeeklyInjuries(payload,{season,week}={}){
 if(!payload||Number(payload.season?.year)!==Number(season)||Number(payload.week?.sequence)!==Number(week))throw Error('sportradar_week_mismatch');
 const teams=payload.teams;
 if(!Array.isArray(teams))throw Error('sportradar_missing_teams');
 const aliases=new Set();
 return teams.map(t=>{
  if(!/^[A-Z]{2,3}$/.test(t.alias??'')||aliases.has(t.alias)||!Array.isArray(t.players))throw Error('sportradar_invalid_team');
  aliases.add(t.alias);
  return {team:t.alias,players:t.players.map(p=>{
   if(!p.id||!p.name||!p.position)throw Error('sportradar_invalid_player');
   const injury=p.injury??{};
   return {provider_player_id:p.id,player_name:p.name,position:p.position,injury:injury.primary??null,practice_status:injury.practice?.status??null,game_status:injury.status??null,status_updated_at_utc:injury.status_date??null};
  })};
 });
}
export async function fetchSportradarWeeklyInjuries({season,week,apiKey=process.env.SPORTRADAR_NFL_API_KEY,accessLevel='trial',fetchImpl=fetch}={}){
 if(!apiKey)return {available:false,reason:'missing_api_key',verified_final_reports:0};
 if(!['trial','production'].includes(accessLevel)||!Number.isInteger(Number(season))||!Number.isInteger(Number(week))||Number(week)<1||Number(week)>18)throw Error('invalid_sportradar_parameters');
 const url=`https://api.sportradar.com/nfl/official/${accessLevel}/v7/en/seasons/${season}/REG/${week}/injuries.json`;
 const response=await fetchImpl(url,{headers:{'x-api-key':apiKey},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('sportradar_http_'+response.status);
 const raw=await response.text();
 if(raw.length>5_000_000)throw Error('sportradar_response_too_large');
 const teams=parseSportradarWeeklyInjuries(JSON.parse(raw),{season,week});
 return {available:true,source_url:url,retrieved_at_utc:new Date().toISOString(),source_digest:'sha256:'+createHash('sha256').update(raw).digest('hex'),teams,verified_final_reports:0,warning:'Provider status_date is not official final-report publication time; player IDs are Sportradar IDs, not GSIS IDs.'};
}
