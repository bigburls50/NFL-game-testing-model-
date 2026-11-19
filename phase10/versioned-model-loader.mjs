// Versioned fitted-model loader. Requires audited out-of-sample validation metadata.
import {createHash} from 'node:crypto';
export function loadValidatedLogisticModel(artifact){
 const {version,trained_through_utc,validation,feature_names,coefficients,intercept}=artifact??{};
 if(!version||!Number.isFinite(Date.parse(trained_through_utc))||validation?.status!=='verified_out_of_sample'||!Number.isInteger(validation.games)||validation.games<100||!validation.report_sha256?.startsWith('sha256:')||!Array.isArray(feature_names)||!feature_names.length||!Array.isArray(coefficients)||coefficients.length!==feature_names.length||!coefficients.every(Number.isFinite)||!Number.isFinite(intercept))throw Error('Unverified or invalid fitted model artifact');
 const digest='sha256:'+createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
 return (game,features)=>{
  if(Date.parse(features.asof_utc)<=Date.parse(trained_through_utc))throw Error('Model training cutoff overlaps feature snapshot');
  let z=intercept;
  for(let i=0;i<feature_names.length;i++){const v=features[feature_names[i]];if(!Number.isFinite(v))throw Error('Missing verified model feature '+feature_names[i]);z+=coefficients[i]*v;}
  return {home_win_probability:1/(1+Math.exp(-z)),model_version:version,model_digest:digest};
 };
}
