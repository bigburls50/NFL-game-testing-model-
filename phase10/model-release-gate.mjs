// Conservative research-only release gate. Never turns backtests into live betting authorization.
// A 75% observed subset hit rate alone is insufficient to authorize forecasts.
export function assessModelRelease({predeclaredThreshold,highConfidence,allGames,calibration,prospective,feedsVerified=false}={}){
 const reasons=[];
 const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
 const validRate=x=>finite(x)&&x>=0&&x<=1;
 const validMetrics=m=>m&&Number.isInteger(m.n)&&m.n>0&&Number.isInteger(m.correct)&&m.correct>=0&&m.correct<=m.n&&validRate(m.accuracy)&&Math.abs(m.accuracy-m.correct/m.n)<1e-9&&finite(m.brier)&&m.brier>=0&&m.brier<=1&&finite(m.logLoss)&&m.logLoss>=0;
 if(!validRate(predeclaredThreshold)||predeclaredThreshold<=0.5)reasons.push('threshold_not_predeclared');
 if(!validMetrics(allGames))reasons.push('all_game_metrics_invalid');
 if(!validMetrics(highConfidence))reasons.push('subset_metrics_invalid');
 if(validMetrics(allGames)&&validMetrics(highConfidence)){
  if(highConfidence.n>allGames.n)reasons.push('subset_exceeds_all_games');
  if(highConfidence.correct>allGames.correct||highConfidence.n-highConfidence.correct>allGames.n-allGames.correct)reasons.push('subset_outcomes_inconsistent');
  if(!validRate(highConfidence.coverage)||Math.abs(highConfidence.coverage-highConfidence.n/allGames.n)>1e-9)reasons.push('coverage_inconsistent');
  if(!validRate(highConfidence.wilsonLower95)||!validRate(highConfidence.wilsonUpper95)||highConfidence.wilsonLower95>highConfidence.accuracy||highConfidence.wilsonUpper95<highConfidence.accuracy)reasons.push('uncertainty_missing_or_invalid');
  if(highConfidence.accuracy<0.75)reasons.push('subset_accuracy_below_target');
  if(highConfidence.wilsonLower95<0.75)reasons.push('subset_uncertainty_below_target');
 }
 if(!calibration?.chronological||!calibration?.leakageAuditPassed)reasons.push('calibration_not_leakage_verified');
 if(!prospective?.independentlyTimestamped||!Number.isInteger(prospective.n)||prospective.n<1)reasons.push('prospective_evidence_missing');
 if(!feedsVerified)reasons.push('live_feeds_not_verified');
 return {decision:reasons.length?'abstain':'research_release_candidate',reasons,warning:'Research release candidate is not wagering authorization; additional deployment and safety review required.'};
}
