import {createHash} from 'node:crypto';
import {collectPregameSnapshot} from './collect-pregame-snapshot.mjs';
import {assessProvisionalPrediction} from './provisional-prediction-gate.mjs';
import {eloPredict} from './elo.mjs';
import {predictMatchups} from './matchups.mjs';
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,LEARNED_VERSION,FEATURE_NAMES} from './learned-matchup.mjs';
import validation from './learned-matchup-validation.json' with {type:'json'};

export const MODEL_VERSION='phase10-elo-matchup-v1';
export function fitEnsemble(historicalGames,{asOf,season,minGames=100}={}){
 const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));
 const rows=historicalGames.filter(r=>Number(r.season)<=season&&r.gameday<cutoff&&['REG','WC','DIV','CON','SB'].includes(r.game_type)&&String(r.home_score??'').trim()!==''&&String(r.away_score??'').trim()!==''&&Number.isInteger(Number(r.home_score))&&Number.isInteger(Number(r.away_score))).sort((a,b)=>a.game_id.localeCompare(b.game_id));
 if(rows.length<minGames)throw Error('Insufficient completed historical games');
 const digest='sha256:'+createHash('sha256').update(JSON.stringify([MODEL_VERSION,rows.map(r=>[r.game_id,r.season,r.gameday,r.home_team,r.away_team,r.home_score,r.away_score])])).digest('hex');
 return {version:MODEL_VERSION,digest,training_games:rows.length,training_cutoff_date:cutoff,predict(game){const g={...game,season};const [e]=eloPredict(rows,{forecastGames:[g]});const [m]=predictMatchups(rows,{forecastGames:[g]});return {home_win_probability:(e.home_win_probability+m.home_win_probability)/2,model_version:MODEL_VERSION,model_digest:digest,generated_at_utc:asOf}}};
}
export function fitLearnedModel(historicalGames,{asOf,season,minGames=100}={}){
 const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));
 const rows=completedRows(historicalGames).filter(r=>Number(r.season)<=season&&r.gameday<cutoff);
 if(rows.length<minGames)throw Error('Insufficient historical games');const firstSeason=Math.min(...rows.map(r=>Number(r.season)));
 const data=buildCausalFeatures(rows).data;const training=data.filter(r=>r.season>firstSeason&&r.season<season);if(training.length<minGames)throw Error('Insufficient prior-season labels after warmup');
 const weights=fitLogistic(training);const digest='sha256:'+createHash('sha256').update(JSON.stringify([LEARNED_VERSION,FEATURE_NAMES,weights,rows.map(r=>[r.game_id,r.season,r.gameday,r.home_team,r.away_team,r.home_score,r.away_score,r.location,r.home_rest,r.away_rest])])).digest('hex');
 return {version:LEARNED_VERSION,digest,training_games:training.length,history_games:rows.length,training_cutoff_date:cutoff,training_last_season:season-1,feature_names:FEATURE_NAMES,coefficients:weights,validation:{holdout_seasons:validation.holdout_seasons,holdout:validation.holdout,promotion_gate:validation.promotion_gate,history_last_date:validation.history_last_date},predict(game){if(!['Home','Neutral'].includes(game.location)||![game.home_rest,game.away_rest].every(v=>Number.isFinite(Number(v))&&Number(v)>0))throw Error('Pregame venue/rest inputs missing');const [g]=buildCausalFeatures(rows,{forecasts:[{...game,season}]}).forecasts;return {home_win_probability:predictLogistic(g.x,weights),model_version:LEARNED_VERSION,model_digest:digest,generated_at_utc:asOf}}};
}
export function selectProductionModel(historicalGames,options){
 const seasons=new Set(completedRows(historicalGames).filter(r=>Number(r.season)<options.season).map(r=>Number(r.season)));
 if(validation.model_version===LEARNED_VERSION&&validation.promotion_gate.passed===true&&seasons.size>=5)return fitLearnedModel(historicalGames,options);
 return fitEnsemble(historicalGames,options);
}
export async function runProvisionalPipeline(manifest,{historicalGames,rosterFetch,depthFetch,injuryFetch,asOf=new Date().toISOString()}={}){
 const model=selectProductionModel(historicalGames,{asOf,season:manifest.season});
 const snapshot=await collectPregameSnapshot(manifest,{rosterFetch,depthFetch,injuryFetch,asOf});
 const games=manifest.games.map(game=>{
  if(game.schedule_conflict)return {...game,status:'abstain',reasons:['schedule_kickoff_conflict']};
  if(!snapshot.evidence)return {...game,status:'abstain',reasons:['pregame_collector_unavailable']};
  try{return {...game,...assessProvisionalPrediction(game,{prediction:model.predict(game),...snapshot.evidence,asOf})}}
  catch{return {...game,status:'abstain',reasons:['model_inputs_unavailable']}}
 });
 const {predict,...metadata}=model;
 return {status:games.some(g=>g.status==='provisional')?'available':'unavailable',generated_at_utc:asOf,model:metadata,source_provenance:snapshot.source_provenance,errors:snapshot.errors??[],games,warning:'Research-only versioned model. QB and injury inputs remain eligibility checks, not trained probability adjustments. Market prices are not model inputs. HOLD for real-money bets.'};
}
