// Verify complete team-level injury-report provenance, including explicit zero-injury reports.
export function auditTeamInjuryReports(schedule,reports,{asOf=new Date().toISOString()}={}){
 const now=Date.parse(asOf),coverage=[],errors=[];
 for(const game of schedule)for(const team of [game.home_team,game.away_team]){
  const matches=reports.filter(r=>r.game_id===game.game_id&&r.team===team);
  const r=matches[0],kickoff=Date.parse(game.kickoff_utc);
  const valid=matches.length===1&&r.source_type==='official_team_or_league'&&/^https:\/\//.test(r.source_url??'')&&Number.isFinite(Date.parse(r.published_at_utc))&&Number.isFinite(Date.parse(r.retrieved_at_utc))&&Date.parse(r.published_at_utc)<=Date.parse(r.retrieved_at_utc)&&Date.parse(r.retrieved_at_utc)<=now&&Date.parse(r.retrieved_at_utc)<kickoff&&Array.isArray(r.players)&&r.complete_report===true&&((r.players.length>0&&r.explicit_no_injuries!==true)||(r.players.length===0&&r.explicit_no_injuries===true));
  coverage.push({game_id:game.game_id,team,verified:valid});
  if(!valid)errors.push({game_id:game.game_id,team,reason:'missing_or_incomplete_official_injury_report'});
 }
 return {ready:coverage.length>0&&errors.length===0,coverage,errors};
}
