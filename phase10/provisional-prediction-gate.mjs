// A provisional forecast is eligible for display only when actual model output
// and identifiable, timestamped pregame evidence exist. No fallback probabilities.
export function assessProvisionalPrediction(game,{prediction,roster=[],depthChart=[],injuryReports=[],asOf=new Date().toISOString()}={}){
 const reasons=[],now=Date.parse(asOf),kickoff=Date.parse(game?.kickoff_utc);
 if(!game||!Number.isFinite(now)||!Number.isFinite(kickoff)||now>=kickoff)return {status:'abstain',reasons:['game_not_upcoming']};
 if(!prediction||!Number.isFinite(prediction.home_win_probability)||prediction.home_win_probability<=0||prediction.home_win_probability>=1||!prediction.model_version||!prediction.model_digest||!Number.isFinite(Date.parse(prediction.generated_at_utc))||Date.parse(prediction.generated_at_utc)>now||now-Date.parse(prediction.generated_at_utc)>24*3600000)reasons.push('missing_fresh_versioned_model_output');
 const teamEvidence={};
 for(const team of [game.home_team,game.away_team]){
  const qbs=depthChart.filter(p=>p.team===team&&p.position==='QB'&&Number(p.depth_rank)===1);
  const matches=qbs.length===1?roster.filter(p=>p.team===team&&p.position==='QB'&&p.player_id===qbs[0].player_id&&/^00-\d{7}$/.test(p.player_id||'')):[];
  if(matches.length!==1){reasons.push(team+'_projected_qb_identity_unavailable');continue}
  const fresh=t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=now&&now-Date.parse(t)<=36*3600000;
  const report=injuryReports.find(r=>r.team===team&&r.source_verified===true&&Array.isArray(r.players)&&r.players.length>0&&r.source_url&&fresh(r.retrieved_at_utc)&&fresh(r.report_updated_at_utc));
  if(!report){reasons.push(team+'_recent_injury_feed_unavailable');continue}
  if(report.players.some(p=>p.player_id===matches[0].player_id&&['Out','Doubtful','Injured Reserve','IR'].includes(p.game_status)))reasons.push(team+'_projected_qb_unavailable');
  teamEvidence[team]={projected_qb_id:matches[0].player_id,projected_qb_name:matches[0].player_name??null,injury_source_url:report.source_url,injury_checked_at_utc:report.retrieved_at_utc,injury_updated_at_utc:report.report_updated_at_utc,injury_timestamp_basis:report.timestamp_basis,injury_rows:report.players.length};
 }
 if(reasons.length)return {status:'abstain',reasons};
 return {status:'provisional',home_win_probability:prediction.home_win_probability,model_version:prediction.model_version,model_digest:prediction.model_digest,generated_at_utc:prediction.generated_at_utc,team_evidence:teamEvidence,betting_status:'hold',warning:'Projected starters and recent injuries are not final confirmations. Not a verified betting recommendation.'};
}
