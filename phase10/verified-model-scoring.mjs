// Research-only scoring bridge: only call a fitted model after all pregame gates pass.
import {gateForecastInputs} from './forecast-input-gate.mjs';
export async function scoreVerifiedGames(schedule,inputs,{model,asOf=new Date().toISOString()}={}){
 if(typeof model!=='function')throw Error('A fitted, versioned scoring model must be supplied');
 const gate=gateForecastInputs(schedule,{...inputs,asOf});
 const output=[];
 for(const game of schedule){
  const decision=gate.games.find(g=>g.game_id===game.game_id);
  if(!decision.eligible){output.push({game_id:game.game_id,status:'abstain',reasons:decision.reasons});continue;}
  const features=inputs.featuresByGame?.[game.game_id];
  if(!features||features.asof_utc===undefined||Date.parse(features.asof_utc)>=Date.parse(game.kickoff_utc)||Date.parse(features.asof_utc)>Date.parse(asOf)){
   output.push({game_id:game.game_id,status:'abstain',reasons:['unverified_model_features']});continue;
  }
  const prediction=await model(game,features);
  if(!prediction||!Number.isFinite(prediction.home_win_probability)||prediction.home_win_probability<=0||prediction.home_win_probability>=1||!prediction.model_version||!prediction.model_digest){
   output.push({game_id:game.game_id,status:'abstain',reasons:['invalid_model_output']});continue;
  }
  output.push({game_id:game.game_id,status:'research_prediction',home_win_probability:prediction.home_win_probability,model_version:prediction.model_version,model_digest:prediction.model_digest,generated_at_utc:asOf,warning:'Not a validated betting recommendation'});
 }
 return {games:output,coverage:output.filter(x=>x.status==='research_prediction').length/output.length};
}
