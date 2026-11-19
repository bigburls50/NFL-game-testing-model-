// Connect the existing nflverse collector, provisional evidence gate and fitted model.
// Research-only output. No synthetic QB, injury, or model inputs.
import {collectPregameSnapshot} from './collect-pregame-snapshot.mjs';
import {fitHomeWinBaseline} from './fitted-home-baseline.mjs';
export async function runProvisionalPipeline(manifest,{historicalGames,rosterFetch,depthFetch,injuryFetch,asOf=new Date().toISOString()}={}){
 if(!Array.isArray(historicalGames))throw Error('Historical completed-game training rows required');
 const model=fitHomeWinBaseline(historicalGames,{targetSeason:manifest.season});
 const snapshot=await collectPregameSnapshot(manifest,{rosterFetch,depthFetch,injuryFetch,asOf});
 // The collector's audit currently exposes aggregate decisions, not normalized
 // roster/depth/injury rows. Do not infer those rows from counts or audit labels.
 const games=manifest.games.map(game=>{
  const audit=snapshot.games?.find(row=>row.game_id===game.game_id);
  const reasons=snapshot.errors?.length
   ? ['pregame_collector_unavailable',...snapshot.errors.map(error=>'feed_'+error.feed+'_unavailable')]
   : ['collector_does_not_expose_normalized_evidence',...(audit?.reasons??[])];
  return {game_id:game.game_id,status:'abstain',reasons:[...new Set(reasons)],model_version:model.model_version};
 });
 return {status:'integration_blocked_on_normalized_collector_evidence',model:{version:model.model_version,digest:model.model_digest,training_games:model.training_games,training_last_season:model.training_last_season},snapshot_status:snapshot.mode??'unavailable',snapshot_checked_at_utc:snapshot.checked_at_utc??null,source_provenance:snapshot.source_provenance??null,feed_errors:(snapshot.errors??[]).map(e=>({feed:e.feed,reason:e.reason})),games,warning:'Fitted model exists but no provisional prediction is emitted without original QB/roster/injury records.'};
}
