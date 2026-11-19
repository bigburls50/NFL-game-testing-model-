// Strict starter extraction from a fetched official announcement, not a depth chart.
// Requires source publication metadata, an explicit starting-QB sentence, and a trusted ID roster.
const clean=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot);/g,' ').replace(/\s+/g,' ').trim();
export function extractConfirmedStarter(document,{game,team,roster,asOf=new Date().toISOString()}={}){
 const reject=reason=>({status:'unconfirmed',reason});
 if(!document||!game||!team||!Array.isArray(roster))return reject('missing_inputs');
 if(document.status!=='unconfirmed'||document.review_status!=='pending_explicit_starter_confirmation'||!document.document_sha256?.startsWith('sha256:'))return reject('missing_source_evidence');
 const published=Date.parse(document.published_at_utc),retrieved=Date.parse(document.retrieved_at_utc);
 if(!Number.isFinite(published)||!Number.isFinite(retrieved)||published>retrieved||retrieved>Date.parse(asOf)||retrieved>=Date.parse(game.kickoff_utc)||Date.parse(asOf)-published>48*3600000)return reject('stale_or_invalid_timestamp');
 if(document.game_id!==game.game_id||document.team!==team)return reject('game_mismatch');
 if(team!==game.home_team&&team!==game.away_team)return reject('team_not_in_game');
 let sourceHost=null;try{const u=new URL(document.source_url);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port)sourceHost=u.hostname.toLowerCase();}catch{}
 const sourceOfficial=sourceHost==='nfl.com'||sourceHost==='www.nfl.com'||(document.source_verified_independently===true&&document.verified_team_domain===sourceHost&&sourceHost?.endsWith('.com'));
 if(!sourceOfficial)return reject('unverified_source_domain');
 if(!document.html)return reject('source_text_not_archived');
 const text=clean(document.html);
 const candidates=roster.filter(r=>r.team===team&&r.player_id&&r.player_name&&(!r.position||String(r.position).toUpperCase()==='QB')).filter(r=>{
  const escaped=r.player_name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const name=new RegExp('\\b'+escaped+'\\b','i');
  if(!name.test(text))return false;
  const explicit=new RegExp('(?:'+escaped+'\\s+(?:will\\s+be|is|has\\s+been\\s+named|was\\s+named)\\s+(?:the\\s+)?(?:starting|starter)\\s+(?:quarterback|QB)|(?:starting|starter)\\s+(?:quarterback|QB)\\s+(?:will be|is|:|—|-)\\s+'+escaped+')','i');
  return explicit.test(text);
 });
 if(candidates.length!==1)return reject('no_unique_explicit_starter');
 const qb=candidates[0];
 return {status:'confirmed',game_id:game.game_id,team,player_id:qb.player_id,player_name:qb.player_name,source_url:document.source_url,confirmed_at_utc:document.published_at_utc,retrieved_at_utc:document.retrieved_at_utc,source_digest:document.document_sha256};
}
