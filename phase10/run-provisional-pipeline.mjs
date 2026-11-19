import {createHash} from 'node:crypto';
import {collectPregameSnapshot} from './collect-pregame-snapshot.mjs';
import {assessProvisionalPrediction} from './provisional-prediction-gate.mjs';
import {eloPredict} from './elo.mjs';
import {predictMatchups} from './matchups.mjs';

export const MODEL_VERSION='phase10-elo-matchup-v1';
export function fitEnsemble(historicalGames,{asOf,season,minGames=100}={}){
 const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));
 const rows=historicalGames.filter(r=>Number(r.season)<=season&&r.gameday<cutoff&&['REG','WC','DIV','CON','SB'].includes(r.game_type)&&String(r.home_score??'').trim()!==''&&String(r.away_score??'').trim()!==''&&Number.isInteger(Number(r.home_score))&&Number.isInteger(Number(r.away_score))).sort((a,b)=>a.game_id.localeCompare(b.game_id));
 if(rows.length<minGames)throw Error('Insufficient completed historical games');
 const digest='sha256:'+createHash('sha256').update(JSON.stringify([MODEL_VERSION,rows.map(r=>[r.game_id,r.season,r.gameday,r.home_team,r.away_team,r.home_score,r.away_score])])).digest('hex');
 return {version:MODEL_VERSION,digest,training_games:rows.length,training_cutoff_date:cutoff,predict(game){const g={...game,season};const [e]=eloPredict(rows,{forecastGames:[g]});const [m]=predictMatchups(rows,{forecastGames:[g]});return {home_win_probability:(e.home_win_probability+m.home_win_probability)/2,model_version:MODEL_VERSION,model_digest:digest,generated_at_utc:asOf}}};
}
export async function runProvisionalPipeline(manifest,{historicalGames,rosterFetch,depthFetch,injuryFetch,asOf=new Date().toISOString()}={}){
 const model=fitEnsemble(historicalGames,{asOf,season:manifest.season});
 const snapshot=await collectPregameSnapshot(manifest,{rosterFetch,depthFetch,injuryFetch,asOf});
 const games=manifest.games.map(game=>{
  if(!snapshot.evidence)return {...game,status:'abstain',reasons:['pregame_collector_unavailable']};
  try{return {...game,...assessProvisionalPrediction(game,{prediction:model.predict(game),...snapshot.evidence,asOf})}}
  catch{return {...game,status:'abstain',reasons:['model_inputs_unavailable']}}
 });
 const {predict,...metadata}=model;
 return {status:games.some(g=>g.status==='provisional')?'available':'unavailable',generated_at_utc:asOf,model:metadata,source_provenance:snapshot.source_provenance,errors:snapshot.errors??[],games,warning:'Research-only fixed ensemble; QB and injury inputs are eligibility checks, not trained injury adjustments. Ontario odds unverified; HOLD.'};
}
