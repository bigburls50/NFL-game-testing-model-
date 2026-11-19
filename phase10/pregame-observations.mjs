// Immutable prospective observations. Undated injury records are observed, not retroactively verified.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {completedRows} from './learned-matchup.mjs';
import {indexInjuryReports,pregameInjuries,predictInjuryOffset,latestInjuryRows,injurySeverity} from './injury-impact-research.mjs';
import {buildRoleHistory,roleBurden,roleVector,PLAYER_IMPACT_VERSION} from './player-impact-research.mjs';
import injuryValidation from './injury-impact-validation.json' with {type:'json'};
import roleValidation from './player-impact-validation.json' with {type:'json'};
const id=v=>/^00-\d{7}$/.test(v??'');
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function weatherObservation(event){
 const w=event?.weather,v=event?.competitions?.[0]?.venue;
 if(!w&&!v)return null;
 return {source_event_id:String(event.id??''),venue_id:v?.id??null,venue_name:v?.fullName??null,venue_indoor_designation:typeof v?.indoor==='boolean'?v.indoor:null,condition:typeof w?.displayValue==='string'?w.displayValue:null,temperature_source_value:finite(w?.temperature)?w.temperature:null,temperature_units:'not_explicit_in_source',wind_speed:null,forecast_issued_at_utc:null,warning:'Scoreboard weather indication observed before kickoff, not a verified roof position or timestamped meteorological forecast.'};
}
export function buildPregameObservation(feed,{historicalGames=[],weatherByGame=new Map(),observedAt=new Date().toISOString(),roleEvidence=null}={}){
 const now=Date.parse(observedAt),evidence=feed.research_evidence;if(!Number.isFinite(now)||!Number.isFinite(Date.parse(feed.generated_at_utc))||Date.parse(feed.generated_at_utc)>now)throw Error('Invalid observation time');
 const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)),prior=new Map();
 const roles=roleEvidence&&Date.parse(roleEvidence.retrieved_at_utc)<=now?buildRoleHistory(historicalGames,roleEvidence.snaps,cutoff):null;
 for(const g of completedRows(historicalGames).filter(g=>g.gameday<cutoff))for(const [team,qb] of [[g.home_team,g.home_qb_id],[g.away_team,g.away_qb_id]]){if(id(qb))prior.set(team,qb);else prior.delete(team)}
 const games=[];
 for(const g of feed.games??[]){if(g.schedule_conflict||!Number.isFinite(Date.parse(g.kickoff_utc))||Date.parse(g.kickoff_utc)<=now)continue;
  const teams={};for(const team of [g.home_team,g.away_team]){
   const depth=(evidence?.depthChart??[]).filter(r=>r.team===team&&id(r.player_id)&&Number.isFinite(Date.parse(r.snapshot_at_utc))&&Date.parse(r.snapshot_at_utc)<=now),report=(evidence?.injuryReports??[]).find(r=>r.team===team&&r.source_verified===true);
   const injuries=report?report.players.filter(p=>id(p.player_id)&&(!p.report_date||(Number.isFinite(Date.parse(p.report_date))&&Date.parse(p.report_date)<=now))).map(p=>({player_id:p.player_id,position:p.position??null,game_status:p.game_status??null,practice_status:p.practice_status??null,source_report_at_utc:p.report_date??null})):null;
   teams[team]={projected_qb:depth.length===1?{player_id:depth[0].player_id,snapshot_at_utc:depth[0].snapshot_at_utc}:null,prior_completed_game_qb_id:prior.get(team)??null,injury_report:report?{source_url:report.source_url,source_dataset_or_report_updated_at_utc:report.report_updated_at_utc,timestamp_basis:report.timestamp_basis,rows:injuries}:null};
  }
  let candidate=null,roleShadow=null;
  if(g.status==='provisional'&&finite(g.home_win_probability)&&g.home_win_probability>0&&g.home_win_probability<1&&Object.values(teams).every(t=>t.prior_completed_game_qb_id&&t.injury_report?.rows?.length)){
   const rows=Object.entries(teams).flatMap(([team,t])=>t.injury_report.rows.map(p=>({season:g.season,week:g.week,team,gsis_id:p.player_id,position:p.position,report_status:p.game_status,date_modified:p.source_report_at_utc??observedAt}))),index=indexInjuryReports(rows);
   const h=pregameInjuries(index,g,g.home_team,now,prior.get(g.home_team)),a=pregameInjuries(index,g,g.away_team,now,prior.get(g.away_team));
   if(h&&a){const x=[(h.offense-a.offense)/3,(h.defense-a.defense)/3,h.prior_qb_status-a.prior_qb_status];candidate={version:injuryValidation.model_version,home_win_probability:predictInjuryOffset(g.home_win_probability,x,injuryValidation.coefficients),features:x,warning:'Shadow candidate only: observations not independently certified, not an approved model.'}}
   if(roles&&candidate&&Object.values(teams).every(t=>t.injury_report.rows.some(p=>injurySeverity(p.game_status)>0))&&roleValidation.model_version===PLAYER_IMPACT_VERSION&&roleValidation.retrospective_gate.passed){
    const h=roleBurden(latestInjuryRows(index,g,g.home_team,now),roles,g.home_team,prior.get(g.home_team),cutoff),a=roleBurden(latestInjuryRows(index,g,g.away_team,now),roles,g.away_team,prior.get(g.away_team),cutoff);
    if(h&&a){const known=h.known_injured+a.known_injured,unknown=h.unknown_injured+a.unknown_injured;if(known+unknown>0&&known/(known+unknown)>=.8){const x=roleVector(h,a);roleShadow={version:PLAYER_IMPACT_VERSION,home_win_probability:predictInjuryOffset(g.home_win_probability,x,roleValidation.coefficients),features:x,role_coverage:{known,unknown},team_roles:{[g.home_team]:h,[g.away_team]:a},warning:'Research-only snap usage proxy, not certified causal player value or a betting recommendation.'}}}
   }
  }
  games.push({game_id:g.game_id,season:g.season,week:g.week,home_team:g.home_team,away_team:g.away_team,kickoff_utc:g.kickoff_utc,baseline_status:g.status,baseline_home_win_probability:g.status==='provisional'?g.home_win_probability:null,teams,weather:weatherByGame.get(g.game_id)??null,injury_shadow:candidate,player_impact_shadow:roleShadow});
 }
 return {schema_version:2,observed_at_utc:observedAt,base_feed_generated_at_utc:feed.generated_at_utc,baseline_model_version:feed.model?.version??null,baseline_model_digest:feed.model?.digest??null,source_provenance:feed.source_provenance??null,role_evidence:roles?{sources:roleEvidence.sources,retrieved_at_utc:roleEvidence.retrieved_at_utc,mapped_players:roleEvidence.mapped_players,valid_team_games:roleEvidence.valid_team_games}:null,weather_source:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50',games,warning:'Prospective research evidence only. Observation time is when data was seen; absent injury rows are unknown, not healthy. No real-money use.'};
}
export async function writePregameObservation(directory,observation){
 if(!observation.games.length)return null;await mkdir(directory,{recursive:true});
 const digest=createHash('sha256').update(JSON.stringify(observation)).digest('hex'),file=directory+'/'+observation.observed_at_utc.replaceAll(':','-').replaceAll('.','-')+'-'+digest.slice(0,10)+'.json';
 await writeFile(file,JSON.stringify({...observation,sha256:digest})+'\n',{flag:'wx'});return file;
}
