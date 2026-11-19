// Preliminary projections are NOT verified starters or verified injury reports.
// This is a distinct advisory gate; the strict four-input acceptance remains unchanged.
export function assessPregameEvidence(game,{roster=[],depthChart=[],injuries=[],retrievedAt,asOf=new Date().toISOString()}={}){
 const reasons=[],teams={};const now=Date.parse(asOf),seen=Date.parse(retrievedAt),kick=Date.parse(game?.kickoff_utc);
 if(!game||!Number.isFinite(now)||!Number.isFinite(seen)||!Number.isFinite(kick)||seen>now||seen>=kick||now-seen>36*3600000)return {decision:'abstain',reasons:['missing_or_stale_pregame_snapshot']};
 for(const team of [game.home_team,game.away_team]){
  const candidates=depthChart.filter(p=>p.team===team&&p.position==='QB'&&Number(p.depth_rank)===1);
  if(candidates.length!==1){reasons.push(team+'_projected_qb_missing_or_ambiguous');continue;}
  const qb=candidates[0];const matches=roster.filter(p=>p.team===team&&p.player_id===qb.player_id&&p.position==='QB'&&/^00-\\d{7}$/.test(p.player_id));
  if(matches.length!==1){reasons.push(team+'_qb_roster_identity_unverified');continue;}
  const report=injuries.find(r=>r.team===team);
  if(!report||report.source_verified!==true||!Array.isArray(report.players)||!Number.isFinite(Date.parse(report.retrieved_at_utc))||Date.parse(report.retrieved_at_utc)>now){reasons.push(team+'_injury_snapshot_unavailable');continue;}
  const injury=report.players.find(p=>p.player_id===qb.player_id);
  if(injury&&['Out','Doubtful','Injured Reserve'].includes(injury.game_status)){reasons.push(team+'_projected_qb_unavailable');continue;}
  teams[team]={projected_qb:{player_id:qb.player_id,player_name:qb.player_name??matches[0].player_name,status:'projected_not_confirmed'},injury_report_status:'latest_available_not_final_certified',injury_rows:report.players.length};
 }
 return {decision:reasons.length?'abstain':'preliminary_inputs_available',reasons,teams,as_of_utc:asOf,warning:'Preliminary inputs are not verified final reports and do not establish model accuracy or permission to bet.'};
}
