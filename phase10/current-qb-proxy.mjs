// Current-season team passing/QB EPA proxy from completed nflverse games.
// IMPORTANT: This is team dropback EPA, not identified starting-QB EPA.
// It cannot satisfy the live-feature-gate's identified-starter requirement.
import {fetchPbp} from './fetch-pbp.mjs';
export function priorTeamQbProxy(teamGames,completedGames,upcoming,{lookback=8,minDropbacks=50}={}){
 if(!Array.isArray(teamGames)||!Array.isArray(completedGames)||!Array.isArray(upcoming))throw Error('Arrays required');
 const byGame=new Map();
 for(const g of completedGames){
  if(!g.game_id||!g.gameday||g.home_score===''||g.away_score===''||!Number.isFinite(Number(g.home_score))||!Number.isFinite(Number(g.away_score)))continue;
  byGame.set(g.game_id,g);
 }
 const out=[];
 for(const fixture of upcoming){
  const kickoff=Date.parse(fixture.kickoff_utc);
  if(!Number.isFinite(kickoff))throw Error('Invalid kickoff');
  for(const team of [fixture.home_team,fixture.away_team]){
   const prior=teamGames.filter(r=>r.team===team&&byGame.has(r.game_id)&&Date.parse(byGame.get(r.game_id).gameday+'T23:59:59Z')<kickoff&&Number.isFinite(Number(r.qb_epa_per_dropback))&&r.qb_epa_per_dropback!==''&&Number(r.qb_dropbacks)>0).sort((a,b)=>byGame.get(a.game_id).gameday.localeCompare(byGame.get(b.game_id).gameday)).slice(-lookback);
   const dropbacks=prior.reduce((s,r)=>s+Number(r.qb_dropbacks),0);
   out.push({game_id:fixture.game_id,team,prior_games:prior.length,prior_dropbacks:dropbacks,prior_team_dropback_epa:dropbacks>=minDropbacks?prior.reduce((s,r)=>s+Number(r.qb_epa_per_dropback)*Number(r.qb_dropbacks),0)/dropbacks:null,feature_type:'team_dropback_proxy_not_starting_qb',eligible_for_starter_gate:false,latest_completed_game:prior.length?byGame.get(prior.at(-1).game_id).gameday:null});
  }
 }
 return out;
}
export async function fetchCurrentTeamQbProxy(season,completedGames,upcoming,{fetchImpl=fetch}={}){
 const pbp=await fetchPbp(season,{fetchImpl});
 return {source_url:pbp.url,season,rows:priorTeamQbProxy(pbp.rows,completedGames,upcoming),warning:'Team dropback EPA includes multiple quarterbacks and is not an independently confirmed starter. Never label it starting QB EPA.'};
}
