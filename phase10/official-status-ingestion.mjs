// Conservative parser for the NFL's weekly game-status news format.
// Extracts explicit OUT / DOUBTFUL / QUESTIONABLE entries only.
// A news summary is never treated as a certified complete final team report.
export function parseOfficialStatusNews(text,{sourceUrl,retrievedAt}={}){
 if(typeof text!=='string'||!/^https:\/\/www\.nfl\.com\//.test(sourceUrl||'')||!Number.isFinite(Date.parse(retrievedAt)))throw Error('Official source and retrieval timestamp required');
 const teams=[];let team=null,status=null;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim().replace(/^#+\s*/,'').replace(/^\*+|\*+$/g,'').trim();
  if(!line)continue;
  const heading=line.match(/^([A-Z][A-Z .'-]{2,28})$/);
  if(heading&&line.length<=28&&!/^(OUT|DOUBTFUL|QUESTIONABLE|SUNDAY|MONDAY|THURSDAY|SATURDAY|FRIDAY|WEDNESDAY|TUESDAY)$/.test(line)){
   team={team_label:line,players:[],source_url:sourceUrl,retrieved_at_utc:retrievedAt,complete_final_report:false,source_type:'official_status_news_summary'};teams.push(team);status=null;continue;
  }
  const m=line.match(/^(OUT|DOUBTFUL|QUESTIONABLE):\s*(.+)$/i);
  if(!m||!team)continue;
  status=m[1].toUpperCase();
  for(const entry of m[2].split(/,\s*(?=[A-Z]{1,4}\s+[A-Z])/)){
   const player=entry.trim().match(/^([A-Z]{1,4})\s+(.+?)\s*\(([^)]+)\)$/);
   if(player)team.players.push({position:player[1],name:player[2],injury:player[3],game_status:status,player_id:null,identity_verified:false});
  }
 }
 return {source_url:sourceUrl,retrieved_at_utc:retrievedAt,teams:teams.filter(t=>t.players.length),verified:false,warning:'Status news is partial; no roster IDs, complete final report, or starting QB confirmation.'};
}
export function matchQuarterbackIdentity({team,playerName,roster,confirmation}){
 if(!Array.isArray(roster)||!confirmation||confirmation.team!==team||confirmation.player_name!==playerName||confirmation.position!=='QB'||confirmation.confirmed_starter!==true||!confirmation.source_url||!Number.isFinite(Date.parse(confirmation.confirmed_at_utc)))return {verified:false,reason:'independent_starter_confirmation_missing'};
 const matches=roster.filter(r=>r.team===team&&r.position==='QB'&&r.player_name===playerName&&/^00-\d{7}$/.test(r.player_id||''));
 if(matches.length!==1||confirmation.player_id!==matches[0].player_id)return {verified:false,reason:'unique_roster_id_match_missing'};
 return {verified:true,player_id:matches[0].player_id,source_url:confirmation.source_url,confirmed_at_utc:confirmation.confirmed_at_utc};
}
