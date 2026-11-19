// Research-only forecast eligibility. Never infer confirmed starters from EPA proxies.
import {confirmedStarterCoverage} from './confirmed-starters.mjs';
export function gateForecastInputs(schedule,{starterReports=[],injuryAudit=null,weatherAudit=null,asOf=new Date().toISOString()}={}){
 const starters=confirmedStarterCoverage(schedule,starterReports,{asOf});
 const injuryReady=injuryAudit?.ready_for_forecast===true;
 const weatherRows=weatherAudit?.forecast_rows??[];
 const weatherIds=new Set(weatherRows.map(r=>r.game_id));
 const checks=schedule.map(g=>{
  const starter=starters.coverage.find(r=>r.game_id===g.game_id);
  const reasons=[];
  if(!starter?.home_confirmed||!starter?.away_confirmed)reasons.push('unconfirmed_starter');
  if(!injuryReady)reasons.push('unverified_injury_report');
  if(!weatherIds.has(g.game_id))reasons.push('weather_unavailable');
  return {game_id:g.game_id,eligible:reasons.length===0,reasons,decision:reasons.length?'abstain':'eligible_for_model_scoring'};
 });
 return {ready:checks.length>0&&checks.every(g=>g.eligible),games:checks,warning:'Eligibility does not create a model probability, prediction or validated accuracy.'};
}
