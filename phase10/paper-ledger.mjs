// Local simulation. No account interaction or real-money transactions.
const round=n=>Math.round(n*100)/100;
const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const resultDate=utc=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(utc)).filter(p=>['year','month','day'].includes(p.type)).map(p=>p.value).join('');
export const ticketKey=t=>t.kind+':'+t.legs.map(l=>l.gameId+':'+l.team).sort().join('|');
export function settleTicket(ticket,results){
 if(ticket.status!=='pending')return ticket;
 const outcomes=ticket.legs.map(l=>{
  const matches=results.filter(r=>r.final===true&&normalize(r.home_team)===normalize(l.home_team)&&normalize(r.away_team)===normalize(l.away_team)&&Math.abs(Date.parse(r.kickoff_utc)-Date.parse(l.kickoff_utc))<3600000);
  if(matches.length!==1)return null;
  const r=matches[0];if(!Number.isInteger(r.home_score)||!Number.isInteger(r.away_score)||r.home_score<0||r.away_score<0)return null;
  if(r.home_score===r.away_score)return 'push';
  return normalize(r.home_score>r.away_score?r.home_team:r.away_team)===normalize(l.team)?'win':'loss';
 });
 if(outcomes.includes(null))return ticket;
 const status=outcomes.includes('loss')?'lost':outcomes.every(s=>s==='push')?'push':'won';
 const decimal=ticket.legs.reduce((d,l,i)=>d*(outcomes[i]==='push'?1:l.decimal),1);
 const pnl=status==='lost'?-ticket.stake:status==='push'?0:round(ticket.stake*(decimal-1));
 return {...ticket,status,pnl,settled_at:new Date().toISOString()};
}
export function ledgerSummary(tickets){
 const settled=tickets.filter(t=>t.status!=='pending'),staked=settled.reduce((s,t)=>s+t.stake,0),pnl=round(settled.reduce((s,t)=>s+t.pnl,0));
 return {settled:settled.length,won:settled.filter(t=>t.status==='won').length,pending:tickets.length-settled.length,openExposure:round(tickets.filter(t=>t.status==='pending').reduce((s,t)=>s+t.stake,0)),pnl,roi:staked?pnl/staked:null};
}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const cash=n=>n.toLocaleString('en-CA',{style:'currency',currency:'CAD'});
const KEY='nfl_phase10_paper_tickets_v1';
export function createPaperLedger(){
 let tickets=[];try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))tickets=saved}catch{}
 const root=el('section',undefined,'p10-featured'),heading=el('h3','Paper performance tracker'),summary=el('p'),list=el('div'),message=el('p','No real-money wagers. Saved on this device.','p10-feature-note'),refresh=el('button','Check final scores','p10-feature-load');refresh.type='button';root.append(heading,summary,list,refresh,message);
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(tickets));return true}catch{message.textContent='Local storage unavailable; paper records are retained only for this session.';return false}}
 function render(){const s=ledgerSummary(tickets);summary.textContent=`${s.settled} settled · ${s.won} won · ${s.pending} pending · P/L ${cash(s.pnl)} · ROI ${s.roi===null?'—':(100*s.roi).toFixed(1)+'%'} · Open risk ${cash(s.openExposure)}`;list.replaceChildren();for(const t of tickets.slice().reverse().slice(0,20)){const row=el('p',`${t.kind.toUpperCase()} · ${t.legs.map(l=>l.team).join(' + ')} · ${t.book} · ${cash(t.stake)} · ${t.status.toUpperCase()}${t.status==='pending'?'':' · '+cash(t.pnl)}`,'p10-feature-note');list.append(row)}refresh.disabled=!s.pending}
 function add(newTickets,budget){const existing=new Set(tickets.map(ticketKey));const unique=newTickets.filter(t=>!existing.has(ticketKey(t))&&t.stake>0&&t.legs.every(l=>Date.parse(l.kickoff_utc)>Date.now()));if(!unique.length)return 'No new positive-stake paper ticket to record (duplicate, stale, or $0).';const exposure=ledgerSummary(tickets).openExposure+unique.reduce((s,t)=>s+t.stake,0);if(exposure>budget*.03+.00001)return 'Open paper exposure would exceed 3% of your paper bankroll.';tickets.push(...unique.map(t=>({...t,status:'pending',recorded_at:new Date().toISOString()})));persist();render();return `${unique.length} paper ticket(s) recorded. Real-money stake $0.`}
 async function settle(){const pending=tickets.filter(t=>t.status==='pending');if(!pending.length)return;refresh.disabled=true;message.textContent='Checking completed NFL games…';let results=[];try{const days=[...new Set(pending.flatMap(t=>t.legs).filter(l=>Date.parse(l.kickoff_utc)<Date.now()).map(l=>resultDate(l.kickoff_utc)))];for(const date of days.slice(0,30)){const r=await fetch('/api/results?date='+date,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)continue;const body=await r.json();results.push(...(body.games??[]))}tickets=tickets.map(t=>settleTicket(t,results));message.textContent='Final-score settlement uses ESPN results and recorded prices; estimated parlays remove tied legs. Unmatched games remain pending.';persist()}catch{message.textContent='Could not retrieve all final scores. Unconfirmed tickets remain pending.'}finally{render()}}
 refresh.addEventListener('click',settle);render();if(tickets.some(t=>t.status==='pending'))settle();return {root,add,settle};
}
