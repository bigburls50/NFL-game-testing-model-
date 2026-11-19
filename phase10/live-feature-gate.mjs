// Point-in-time gate for live QB, injury and weather feature snapshots.
// Only independently sourced, pre-kickoff observations can enter the model.
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const statuses=new Set(['out','doubtful','questionable','active','unknown']);
export function auditLiveFeatures(schedule,features,{asOf=new Date().toISOString(),maxAgeHours=48}={}){
 if(!iso(asOf)||!Array.isArray(schedule)||!Array.isArray(features)||!Number.isFinite(maxAgeHours)||maxAgeHours<=0)throw Error('Invalid feature audit inputs');
 const now=Date.parse(asOf),games=new Map(),errors=[],accepted=[];
 for(const g of schedule){if(!g.game_id||!iso(g.kickoff_utc)||games.has(g.game_id))throw Error('Invalid verified schedule');games.set(g.game_id,g);}
 const seen=new Set();
 for(const [i,r] of features.entries()){
 const issues=[],g=games.get(r.game_id),key=r.game_id+'|'+r.kind+'|'+r.team;
 if(seen.has(key))issues.push('duplicate_feature');seen.add(key);
 if(!g||![g?.home_team,g?.away_team].includes(r.team))issues.push('schedule_mismatch');
 if(!['qb','injury','weather'].includes(r.kind))issues.push('invalid_kind');
 if(!iso(r.observed_at_utc)||!iso(r.retrieved_at_utc))issues.push('invalid_timestamp');
 else{
 const observed=Date.parse(r.observed_at_utc),retrieved=Date.parse(r.retrieved_at_utc),kickoff=Date.parse(g?.kickoff_utc??'');
 if(observed>retrieved||retrieved>now||retrieved>=kickoff)issues.push('future_or_postkickoff_data');
 if(now-observed>maxAgeHours*3600000)issues.push('stale_data');
 }
 if(typeof r.source_url!=='string'||!/^https:\/\//.test(r.source_url))issues.push('missing_source');
 if(r.kind==='qb'&&(!r.player_id||!r.player_name||!finite(r.prior_epa_per_dropback)||!Number.isInteger(r.prior_dropbacks)||r.prior_dropbacks<1))issues.push('unverified_qb');
 if(r.kind==='injury'&&(!r.player_id||!r.player_name||!statuses.has(r.game_status)||!r.report_date))issues.push('invalid_injury');
 if(r.kind==='weather'&&(!finite(r.wind_mph)||r.wind_mph<0||!finite(r.temperature_f)||!finite(r.precip_probability)||r.precip_probability<0||r.precip_probability>1||!['outdoor','indoor','retractable'].includes(r.venue_type)))issues.push('invalid_weather');
 if(issues.length)errors.push({row:i+1,game_id:r.game_id,reasons:issues});else accepted.push(r);
 }
 const coverage=schedule.map(g=>({game_id:g.game_id,home_qb:accepted.some(r=>r.game_id===g.game_id&&r.kind==='qb'&&r.team===g.home_team),away_qb:accepted.some(r=>r.game_id===g.game_id&&r.kind==='qb'&&r.team===g.away_team),home_injuries:accepted.some(r=>r.game_id===g.game_id&&r.kind==='injury'&&r.team===g.home_team),away_injuries:accepted.some(r=>r.game_id===g.game_id&&r.kind==='injury'&&r.team===g.away_team),weather:accepted.some(r=>r.game_id===g.game_id&&r.kind==='weather')}));
 return {ready:errors.length===0&&coverage.length>0&&coverage.every(g=>g.home_qb&&g.away_qb&&g.home_injuries&&g.away_injuries&&g.weather),accepted,coverage,errors,warning:'Provenance gate only. Injury absence must be explicitly sourced; QB starter must be independently confirmed. Weather forecasts can change.'};
}
