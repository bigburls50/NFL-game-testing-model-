// Research simulation only. Probabilities are estimates, not verified win chances.
export const PAPER_LIMITS=Object.freeze({single:.01,parlay:.0025,total:.03,kelly:.25});
const validProbability=p=>Number.isFinite(p)&&p>0&&p<1;
export const floorCents=n=>Math.floor(Math.max(0,n)*100+1e-8)/100;
export function paperStake(probability,decimal,budget,kind='single'){
 if(!validProbability(probability)||!Number.isFinite(decimal)||decimal<=1||!Number.isFinite(budget)||budget<0)return null;
 const edge=probability*decimal-1,kelly=Math.max(0,edge/(decimal-1)),cap=kind==='parlay'?PAPER_LIMITS.parlay:PAPER_LIMITS.single;
 const stake=floorCents(budget*Math.min(cap,kelly*PAPER_LIMITS.kelly));
 return {edge,breakEven:1/decimal,stake,decimal,probability,returnAmount:stake*decimal,profit:stake*(decimal-1),maxLoss:stake};
}
export function singlePortfolio(legs,budget){
 const rows=legs.map(leg=>({...leg,projection:paperStake(leg.probability,leg.quotes[0]?.decimal,budget)}));
 const total=rows.reduce((sum,r)=>sum+(r.projection?.stake??0),0),scale=total>0?Math.min(1,budget*PAPER_LIMITS.total/total):1;
 return rows.map(r=>{if(!r.projection)return r;const p=r.projection,stake=floorCents(p.stake*scale);return {...r,projection:{...p,stake,returnAmount:stake*p.decimal,profit:stake*(p.decimal-1),maxLoss:stake}}});
}
export function compareParlayPrices(legs){
 if(!Array.isArray(legs)||legs.length<2||legs.length>4||new Set(legs.map(l=>l.gameId)).size!==legs.length||legs.some(l=>!validProbability(l.probability)||!l.quotes?.length))return [];
 const books=[...new Set(legs[0].quotes.map(q=>q.bookKey))].filter(key=>legs.every(l=>l.quotes.some(q=>q.bookKey===key)));
 return books.map(key=>{const quotes=legs.map(l=>l.quotes.find(q=>q.bookKey===key));return {book:quotes[0].book,bookKey:key,quotes,decimal:quotes.reduce((d,q)=>d*q.decimal,1),allPositive:legs.every((l,i)=>l.probability*quotes[i].decimal>1)}}).filter(p=>Number.isFinite(p.decimal)&&p.decimal>1).sort((a,b)=>b.decimal-a.decimal);
}
export function parlayProjection(legs,budget){
 if(legs.length<2||legs.length>4)return {reason:'Select 2–4 games.'};
 if(new Set(legs.map(l=>l.gameId)).size!==legs.length)return {reason:'Only one selection from each game.'};
 if(legs.some(l=>!validProbability(l.probability)||!l.quotes?.length))return {reason:'A leg is missing an eligible probability or fresh quote.'};
 // Never manufacture an executable parlay from prices at different sportsbooks.
 const comparison=compareParlayPrices(legs);if(!comparison.length)return {reason:'No sportsbook has fresh quotes for every leg.'};
 const candidates=[...comparison].sort((a,b)=>Number(b.allPositive)-Number(a.allPositive)||b.decimal-a.decimal);
 const best=candidates[0],probability=legs.reduce((p,l)=>p*l.probability,1),projection=paperStake(probability,best.decimal,budget,'parlay');
 if(!projection)return {reason:'Invalid parlay inputs.'};
 // Require each leg to offer positive modeled value at the selected book.
 const allPositive=legs.every((l,i)=>l.probability*best.quotes[i].decimal>1);
 return {...best,...projection,stake:allPositive?projection.stake:0,returnAmount:allPositive?projection.returnAmount:0,profit:allPositive?projection.profit:0,maxLoss:allPositive?projection.maxLoss:0,allPositive,comparison,independenceAssumed:true};
}

// Rank all distinct-game three-leg combinations by estimated joint win chance.
// Positive modeled value is a separate optional filter, not a win probability.
export function rankThreeGameParlay(legs,budget,{valueOnly=false}={}){
 let best=null;
 const eligible=legs.filter(l=>l?.gameId&&validProbability(l.probability)&&l.quotes?.length);
 for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++)for(let k=j+1;k<eligible.length;k++){
  const picks=[eligible[i],eligible[j],eligible[k]];if(new Set(picks.map(l=>l.gameId)).size!==3)continue;
  const p=parlayProjection(picks,budget);if(p.reason||valueOnly&&(!p.allPositive||p.edge<=0))continue;
  if(!best||p.probability>best.probability+1e-12||Math.abs(p.probability-best.probability)<=1e-12&&p.edge>best.edge)best={...p,legs:picks};
 }
 return best??{reason:valueOnly?'No three-game combination passes the modeled value screen.':'Three eligible games with fresh prices at a common sportsbook are required.'};
}
export function combinedAmerican(decimal){if(!Number.isFinite(decimal)||decimal<=1)return null;return decimal>=2?Math.round((decimal-1)*100):-Math.round(100/(decimal-1))}
