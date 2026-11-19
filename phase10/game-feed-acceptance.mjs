// Game-level acceptance: BOTH confirmed QB records and BOTH complete injury reports.
// An unverified record, duplicate or missing team always means abstain.
import {confirmedStarterCoverage} from './confirmed-starters.mjs';
import {auditTeamInjuryReports} from './official-injury-coverage.mjs';
export function acceptGameFeeds(schedule,{starterReports=[],injuryReports=[],asOf=new Date().toISOString()}={}){
 const starters=confirmedStarterCoverage(schedule,starterReports,{asOf});
 const injuries=auditTeamInjuryReports(schedule,injuryReports,{asOf});
 const games=schedule.map(game=>{
  const q=starters.coverage.find(x=>x.game_id===game.game_id);
  const teamInjuries=injuries.coverage.filter(x=>x.game_id===game.game_id);
  const reasons=[];
  if(!q?.home_confirmed)reasons.push('home_qb_unconfirmed');
  if(!q?.away_confirmed)reasons.push('away_qb_unconfirmed');
  if(!teamInjuries.some(x=>x.team===game.home_team&&x.verified))reasons.push('home_injury_report_unverified');
  if(!teamInjuries.some(x=>x.team===game.away_team&&x.verified))reasons.push('away_injury_report_unverified');
  return {game_id:game.game_id,decision:reasons.length?'abstain':'feeds_verified',reasons};
 });
 return {games,ready:games.length>0&&games.every(g=>g.decision==='feeds_verified'),starter_errors:starters.errors,injury_errors:injuries.errors,warning:'Feeds verified is necessary but not sufficient: weather and independently validated model gates must also pass before prediction.'};
}
