// Experimental fixed-coefficient pregame rest adjustment; not approved for production.
const sigmoid=z=>1/(1+Math.exp(-z));
const logit=p=>Math.log(p/(1-p));
export function augmentWithRest(predictions,restFeatures,{weight=0.035,maxEdge=14}={}) {
 if(!Number.isFinite(weight)||weight<0||weight>1||!Number.isInteger(maxEdge)||maxEdge<1||maxEdge>28)throw Error('Invalid rest settings');
 const byId=new Map();
 for(const f of restFeatures){if(!f.game_id||byId.has(f.game_id))throw Error('Duplicate/missing rest game');byId.set(f.game_id,f)}
 const seen=new Set();
 return predictions.map(p=>{
  if(!p.game_id||seen.has(p.game_id))throw Error('Duplicate/missing prediction game');seen.add(p.game_id);
  const prob=Number(p.home_win_probability);
  if(!(prob>0&&prob<1))throw Error('Invalid base probability');
  const f=byId.get(p.game_id);
  if(f&&['season','gameday','home_team','away_team'].some(k=>!p[k]||!f[k]||String(p[k])!==String(f[k])))throw Error('Rest feature game mismatch: '+p.game_id);
  const raw=f?.rest_days_edge;
  const available=raw!==undefined&&raw!==null&&raw!==''&&Number.isFinite(Number(raw));
  const edge=available?Number(raw):0;
  if(available&&(!Number.isInteger(edge)||Math.abs(edge)>28))throw Error('Invalid rest edge');
  const adjustment=available?weight*Math.max(-maxEdge,Math.min(maxEdge,edge)):0;
  return {...p,home_win_probability:sigmoid(logit(prob)+adjustment),rest_features_used:available?1:0,rest_logit_adjustment:adjustment};
 });
}
