// Validate a current-season pregame forecast archive before any dashboard picks are shown.
// This is a provenance/quality gate, NOT evidence of predictive accuracy.
const utcInstant=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return false;
 const ms=Date.parse(value);
 if(!Number.isFinite(ms))return false;
 // Date.parse normalizes impossible dates (e.g. February 30); require a true UTC calendar instant.
 return new Date(ms).toISOString().slice(0,19)===value.slice(0,19);
};
export function auditPregameForecasts(rows,{asOf=new Date().toISOString(),season,expectedGameIds=[],expectedGames=null}={}){
 if(!Number.isInteger(season)||season<2000)throw Error('Explicit target season required');
 const now=Date.parse(asOf);if(!utcInstant(asOf))throw Error('Invalid as-of timestamp');
 const errors=[],accepted=[],ids=new Set();
 const scheduleRows=expectedGames===null?null:expectedGames;
 if(scheduleRows!==null&&!Array.isArray(scheduleRows))throw Error('expectedGames must be an array');
 const schedule=new Map();
 if(scheduleRows!==null){
  for(const g of scheduleRows){
   const id=String(g?.game_id??'').trim(),home=String(g?.home_team??'').trim(),away=String(g?.away_team??'').trim(),kickoff=Date.parse(g?.kickoff_utc);
   if(!id||!home||!away||home===away||!utcInstant(g?.kickoff_utc)||schedule.has(id))throw Error('Invalid or duplicate verified schedule entry');
   schedule.set(id,{home,away,kickoff});
  }
 }
 const requiredIds=scheduleRows===null?expectedGameIds:[...schedule.keys()];
 if(!Array.isArray(requiredIds)||requiredIds.length===0)errors.push({row:null,game_id:null,reasons:['missing_verified_schedule']});
 if(new Set(requiredIds).size!==requiredIds.length)errors.push({row:null,game_id:null,reasons:['duplicate_schedule_game_id']});
 for(const [i,r] of rows.entries()){
  const e=[],id=String(r.game_id??'').trim();
  if(!id||ids.has(id))e.push('missing_or_duplicate_game_id');else ids.add(id);
  if(Number(r.season)!==season)e.push('wrong_season');
  const home=String(r.home_team??'').trim(),away=String(r.away_team??'').trim();
  if(!home||!away||home===away)e.push('invalid_teams');
  const scheduled=schedule.get(id);
  if(scheduleRows!==null&&scheduled&& (home!==scheduled.home||away!==scheduled.away||Date.parse(r.kickoff_utc)!==scheduled.kickoff))e.push('verified_schedule_details_mismatch');
  const kickoff=Date.parse(r.kickoff_utc),generated=Date.parse(r.generated_at_utc),features=Date.parse(r.features_asof_utc);
  if(!utcInstant(r.kickoff_utc)||!utcInstant(r.generated_at_utc)||!utcInstant(r.features_asof_utc))e.push('invalid_timestamps');
  else{
   if(generated>=kickoff||features>generated)e.push('not_pregame_or_future_features');
   if(kickoff<=now)e.push('game_not_upcoming_as_of_audit');
   if(generated>now||features>now)e.push('future_dated_forecast');
  }
  const p=r.home_win_probability;
  if(p===null||p===undefined||String(p).trim()===''||!Number.isFinite(Number(p))||Number(p)<=0||Number(p)>=1)e.push('invalid_probability');
  if(!String(r.model_version??'').trim())e.push('missing_model_version');
  // A digest must be an actual 256-bit SHA-256 value, not a placeholder label.
  if(!/^sha256:[0-9a-f]{64}$/i.test(String(r.source_digest??'').trim()))e.push('invalid_source_digest');
  if(e.length)errors.push({row:i+1,game_id:id||null,reasons:e});else accepted.push({...r,home_win_probability:Number(p)});
 }
 const expected=new Set(requiredIds),missing=[...expected].filter(id=>!ids.has(id));
 const extra=expected.size?[...ids].filter(id=>!expected.has(id)):[];
 if(missing.length||extra.length)errors.push({row:null,game_id:null,reasons:['schedule_mismatch'],missing,extra});
 return {ready:errors.length===0&&accepted.length>0,season,as_of_utc:new Date(now).toISOString(),accepted_games:accepted.length,total_games:rows.length,errors,warning:'Archive integrity only; does not validate accuracy or authorize wagering.'};
}
