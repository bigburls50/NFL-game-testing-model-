// Conservative official team injury coverage. A parser's self-declared completeness is not evidence.
export function auditTeamInjuryReports(schedule,reports,{asOf=new Date().toISOString()}={}){
 if(!Array.isArray(schedule)||!Array.isArray(reports))throw Error('Invalid report inputs');
 const now=Date.parse(asOf),coverage=[],errors=[];
 for(const game of schedule)for(const team of [game.home_team,game.away_team]){
  const matches=reports.filter(r=>r.game_id===game.game_id&&r.team===team);
  const r=matches[0],kickoff=Date.parse(game.kickoff_utc);
  let host=null;try{host=new URL(r?.source_url).hostname.toLowerCase();}catch{}
  const official=host==='nfl.com'||host==='www.nfl.com'||(r?.verified_team_domain===host&&host?.endsWith('.com')&&r?.source_verified_independently===true);
  const published=Date.parse(r?.published_at_utc),retrieved=Date.parse(r?.retrieved_at_utc);
  const provenance=matches.length===1&&official&&r?.source_type==='official_team_or_league'&&r?.source_digest?.startsWith('sha256:')&&Number.isFinite(published)&&Number.isFinite(retrieved)&&published<=retrieved&&retrieved<=now&&retrieved<kickoff;
  const explicitEmpty=r?.players?.length===0&&r?.explicit_no_injuries===true&&r?.explicit_no_injuries_source_verified===true;
  const populated=Array.isArray(r?.players)&&r.players.length>0&&r.players.every(p=>p.player_name&&p.injury&&p.practice_status);
  const complete=provenance&&r?.complete_report===true&&r?.team_section_verified===true&&r?.game_section_verified===true&&r?.report_date_verified===true&&(explicitEmpty||populated);
  coverage.push({game_id:game.game_id,team,verified:Boolean(complete)});
  if(!complete)errors.push({game_id:game.game_id,team,reason:'missing_or_incomplete_independently_verified_official_injury_report'});
 }
 return {ready:coverage.length>0&&errors.length===0,coverage,errors};
}
