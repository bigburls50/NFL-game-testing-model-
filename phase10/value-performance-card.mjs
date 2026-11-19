const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const cash=v=>Number(v).toLocaleString('en-CA',{style:'currency',currency:'CAD'});
const pct=v=>Number.isFinite(v)?(v*100).toFixed(1)+'%':'—';
const line=(name,value)=>{const r=el('div',undefined,'p10-slip-total');r.append(el('span',name),el('strong',value));return r};
export function createValuePerformanceCard(){
 const root=el('section',undefined,'p10-featured');root.id='value-performance';const header=el('div',undefined,'p10-feature-head'),title=el('div');title.append(el('span','PRICE SHOPPING · PAPER RESEARCH','p10-feature-kicker'),el('h3','Profitability lab'));const refresh=el('button','Refresh comparison','p10-feature-load');refresh.type='button';header.append(title,refresh);const content=el('div'),note=el('p','Loading profitability data…','p10-feature-note');root.append(header,content,note);
 async function load(){refresh.disabled=true;try{
   const get=async path=>{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.json()};
   const [history,live]=await Promise.all([get('./phase10/value-research-validation.json'),get('./phase10/value-paper-trial-results.json')]);
   if(history.version!=='phase10-market-anchor-research-v1'||live.version!==history.version||live.real_money_stake!==0)throw Error();
   const v=history.holdout.paper.v2,dev=history.development.paper.v2;
   content.replaceChildren(el('p','Historical moneyline replay (not verified executable Ontario odds)','p10-feature-note'),line('2023–24 simulated ROI',pct(dev.roi)),line('2025–26 simulated ROI',pct(v.roi)),line('Holdout simulated singles',String(v.bets)),line('Holdout maximum weekly drawdown',pct(v.weekly_drawdown)),el('p','Historical market probabilities were more accurate. The fitted blend retained no independent V2 weight.','p10-feature-note'),el('h4','Live paper price-shop comparison'));
   for(const [key,label] of [['v2','V2 model'],['market_anchor','Other-book consensus']]){const s=live.summary[key];content.append(line(label,`${s.settled} settled · ${s.pending} pending`),line('Realized P/L · ROI',cash(s.pnl)+' · '+pct(s.roi)),line('Paper exposure',cash(s.openExposure)))}
   note.textContent='Separate locked-price strategies · BetMGM, Betano and BetRivers Ontario · 3% minimum modeled EV · max 3 singles per weekly virtual $1,000 bankroll. Positive modeled EV is not demonstrated profit. Real-money stake $0.';
  }catch{content.replaceChildren();note.textContent='Profitability comparison unavailable. No simulated results invented.'}finally{refresh.disabled=false}}
 refresh.addEventListener('click',load);load();return root;
}
