// Confirmed-starter gate: depth-chart projections and team EPA proxies are NOT confirmations.
export function confirmedStarterCoverage(schedule,records,{asOf=new Date().toISOString()}={}){
 const now=Date.parse(asOf);if(!Number.isFinite(now)||!Array.isArray(schedule)||!Array.isArray(records))throw Error('Invalid inputs');
 const accepted=[],errors=[],coverage=[];
 for(const g of schedule){
  const kickoff=Date.parse(g.kickoff_utc),confirmed={};
  for(const team of [g.home_team,g.away_team]){
   const candidates=records.filter(r=>r.game_id===g.game_id&&r.team===team);
   if(candidates.length!==1){errors.push({game_id:g.game_id,team,reason:'missing_or_multiple_starter_reports'});continue;}
   const r=candidates[0],observed=Date.parse(r.confirmed_at_utc),retrieved=Date.parse(r.retrieved_at_utc);
   if(r.status!=='confirmed'||!r.player_id||!r.player_name||!/^https:\/\//.test(r.source_url??'')||!Number.isFinite(observed)||!Number.isFinite(retrieved)||observed>retrieved||retrieved>now||retrieved>=kickoff||now-observed>48*3600000){
    errors.push({game_id:g.game_id,team,reason:'unverified_or_stale_starter'});continue;
   }
   confirmed[team]={player_id:r.player_id,player_name:r.player_name,source_url:r.source_url,confirmed_at_utc:r.confirmed_at_utc};
   accepted.push({...r});
  }
  coverage.push({game_id:g.game_id,home_confirmed:Boolean(confirmed[g.home_team]),away_confirmed:Boolean(confirmed[g.away_team])});
 }
 return {ready:errors.length===0&&coverage.length>0,coverage,accepted,errors,warning:'Confirmation must come from a documented team or official pregame source. Team-level QB EPA is not player-specific.'};
}
