// Causal team features and a fitted regularized logistic model.
// Current-game scores, bookmaker prices and retrospectively known starters never enter x.
const TYPES=new Set(['REG','WC','DIV','CON','SB']);
const sigmoid=z=>1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
export const LEARNED_VERSION='phase10-causal-logistic-v2';
export const FEATURE_NAMES=['home_venue','elo_difference','point_rating_difference','recent_margin_difference','opponent_adjusted_margin_difference','rest_difference'];
export const completedRows=rows=>rows.filter(r=>TYPES.has(r.game_type)&&String(r.home_score??'').trim()!==''&&String(r.away_score??'').trim()!==''&&Number.isInteger(Number(r.home_score))&&Number.isInteger(Number(r.away_score))&&Number(r.home_score)>=0&&Number(r.away_score)>=0&&/^\d{4}-\d{2}-\d{2}$/.test(r.gameday??'')).sort((a,b)=>a.gameday.localeCompare(b.gameday)||a.game_id.localeCompare(b.game_id));
function teamHistory(){return {elo:1500,points:0,recent:[],adjusted:[]}}
function average(values){return values.reduce((s,v,i)=>s+v*.88**(values.length-1-i),0)/(4+values.reduce((s,_,i)=>s+.88**(values.length-1-i),0))}
function venue(g){return g.location==='Neutral'?0:1}
function rest(g){const h=Number(g.home_rest),a=Number(g.away_rest);return String(g.home_rest??'').trim()&&String(g.away_rest??'').trim()&&Number.isFinite(h)&&Number.isFinite(a)&&h>0&&a>0?clamp(h-a,-7,7)/7:0}
function features(g,h,a){return [venue(g),(h.elo-a.elo)/400,(h.points-a.points)/10,(average(h.recent)-average(a.recent))/14,(average(h.adjusted)-average(a.adjusted))/14,rest(g)]}
export function buildCausalFeatures(rows,{forecasts=[],includeTies=false}={}){
 const state=new Map(),get=team=>state.get(team)??teamHistory(),data=[],ids=new Set();let lastSeason=null;
 function transition(season){if(lastSeason===null){lastSeason=season;return}if(season<lastSeason)throw Error('Nonchronological season');if(season>lastSeason){const shrink=.67**(season-lastSeason);for(const t of state.values()){t.elo=1500+(t.elo-1500)*shrink;t.points*=shrink;t.recent=t.recent.map(x=>x*shrink);t.adjusted=t.adjusted.map(x=>x*shrink)}lastSeason=season}}
 const games=completedRows(rows);for(let i=0;i<games.length;){const date=games[i].gameday,season=Number(games[i].season);transition(season);const batch=[];while(i<games.length&&games[i].gameday===date){const g=games[i++];if(Number(g.season)!==season||!g.game_id||ids.has(g.game_id)||!g.home_team||!g.away_team||g.home_team===g.away_team)throw Error('Invalid historical fixture');ids.add(g.game_id);const h=get(g.home_team),a=get(g.away_team),margin=Number(g.home_score)-Number(g.away_score),x=features(g,h,a),expected=2.2*venue(g)+h.points-a.points;const p=1/(1+10**(-(h.elo-a.elo+55*venue(g))/400));if(margin!==0||includeTies)data.push({game_id:g.game_id,season,date,x,y:margin===0?null:Number(margin>0),home_moneyline:g.home_moneyline,away_moneyline:g.away_moneyline});batch.push({g,margin,expected,p,homePoints:h.points,awayPoints:a.points})}
  for(const {g,margin,expected,p,homePoints,awayPoints} of batch){for(const team of [g.home_team,g.away_team])if(!state.has(team))state.set(team,teamHistory());const h=get(g.home_team),a=get(g.away_team),y=margin===0?.5:Number(margin>0),eloDelta=20*(y-p),pointDelta=.075*clamp(margin-expected,-28,28);h.elo+=eloDelta;a.elo-=eloDelta;h.points+=pointDelta;a.points-=pointDelta;h.recent=[...h.recent,clamp(margin,-35,35)].slice(-10);a.recent=[...a.recent,clamp(-margin,-35,35)].slice(-10);h.adjusted=[...h.adjusted,clamp(margin+awayPoints-2.2*venue(g),-35,35)].slice(-10);a.adjusted=[...a.adjusted,clamp(-margin+homePoints+2.2*venue(g),-35,35)].slice(-10)}
 }
 const future=forecasts.map(g=>{if(Number(g.season)<lastSeason||!state.has(g.home_team)||!state.has(g.away_team))throw Error('Missing team history');const factor=.67**(Number(g.season)-lastSeason);const adjust=t=>({...t,elo:1500+(t.elo-1500)*factor,points:t.points*factor,recent:t.recent.map(x=>x*factor),adjusted:t.adjusted.map(x=>x*factor)});return {game_id:g.game_id,x:features(g,adjust(get(g.home_team)),adjust(get(g.away_team)))}});
 return {data,forecasts:future};
}
export function fitLogistic(data,{lambda=.003,iterations=450,rate=.55}={}){
 if(data.length<100||lambda<0)throw Error('Insufficient labeled training games');
 const n=data[0].x.length;if(!n||data.some(r=>r.x.length!==n||r.x.some(v=>!Number.isFinite(v))||![0,1].includes(r.y)))throw Error('Invalid feature matrix');let w=Array(n+1).fill(0);
 for(let i=0;i<iterations;i++){const gradient=Array(n+1).fill(0);for(const r of data){const p=sigmoid(w[0]+r.x.reduce((z,v,j)=>z+w[j+1]*v,0)),d=p-r.y;gradient[0]+=d;for(let j=0;j<n;j++)gradient[j+1]+=d*r.x[j]}
  w=w.map((v,j)=>v-rate*(gradient[j]/data.length+(j===0?0:lambda*v)));}
 if(w.some(v=>!Number.isFinite(v)))throw Error('Nonfinite fitted coefficients');return w;
}
export function predictLogistic(x,w){return sigmoid(w[0]+x.reduce((z,v,i)=>z+w[i+1]*v,0))}
export function scorePredictions(rows){if(!rows.length)return {n:0,accuracy:null,brier:null,log_loss:null};const n=rows.length;return {n,accuracy:rows.reduce((s,r)=>s+Number((r.p>=.5)===(r.y===1)),0)/n,brier:rows.reduce((s,r)=>s+(r.p-r.y)**2,0)/n,log_loss:rows.reduce((s,r)=>s-(r.y?Math.log(clamp(r.p,1e-9,1-1e-9)):Math.log(1-clamp(r.p,1e-9,1-1e-9))),0)/n}}
export function noVigProbability(home,away){const h=Number(home),a=Number(away);if(!Number.isInteger(h)||!Number.isInteger(a)||Math.abs(h)<100||Math.abs(a)<100)return null;const implied=p=>p>0?100/(p+100):Math.abs(p)/(Math.abs(p)+100);return implied(h)/(implied(h)+implied(a))}
