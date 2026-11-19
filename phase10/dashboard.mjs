// Phase 10 is independent of the legacy ESPN heuristic and odds availability.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const section=el('section',undefined,'card');section.id='phase10';
const title=el('h2','Phase 10 · Model predictions');const summary=el('p','Loading current model snapshot…','muted');summary.setAttribute('aria-live','polite');
const refresh=el('button','Refresh Phase 10');refresh.type='button';
const grid=el('div',undefined,'value-results');section.append(title,el('p','Ranked by estimated win probability. Projected quarterbacks and recent injury data are not final official confirmations. All selections are research only; HOLD until Ontario odds and final evidence are verified.','muted'),refresh,summary,grid);
document.querySelector('main').prepend(section);
document.querySelector('header h1').textContent='🏈 NFL Auto Research · Phase 10';
document.title='NFL Auto Research · Phase 10';
const pct=p=>(p*100).toFixed(1)+'%';
async function load(){refresh.disabled=true;summary.textContent='Retrieving fitted model predictions…';grid.replaceChildren();
 try{
  const r=await fetch('/api/predictions',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();
  const predictions=(data.predictions??[]).filter(p=>['verified','provisional'].includes(p.status)&&Number.isFinite(p.home_win_probability)&&p.home_win_probability>0&&p.home_win_probability<1&&Date.parse(p.kickoff_utc)>Date.now()).map(p=>({...p,selection:p.home_win_probability>=.5?p.home_team:p.away_team,probability:Math.max(p.home_win_probability,1-p.home_win_probability)})).sort((a,b)=>b.probability-a.probability);
  const abstain=(data.games??[]).filter(g=>g.status==='abstain'&&!predictions.some(p=>p.game_id===g.game_id));
  summary.textContent=`${predictions.length} model predictions · ${abstain.length} abstaining · ${data.model_metadata?.training_games??'—'} historical games · ${data.snapshot_generated_at_utc?new Date(data.snapshot_generated_at_utc).toLocaleString('en-CA'):'No current snapshot'}`;
  for(const p of predictions){const card=el('article',undefined,'ev-card');const score=Math.round(p.probability*10);if(score>=7)card.classList.add('ev-highlight');if(p.status==='verified')card.classList.add('ev-model-verified');
   card.append(el('span',p.status==='verified'?'VERIFIED MODEL':'PHASE 10 · PROVISIONAL','ev-badge'),el('h3',p.selection),el('p',`${score}/10 · ${pct(p.probability)} estimated win probability`,'ev-rating'),el('p',`${p.away_team} @ ${p.home_team} · ${new Date(p.kickoff_utc).toLocaleString('en-CA')}`,'ev-meta'),el('p','Model: '+p.model_version,'source-note'));
   if(p.status==='provisional'){const qbs=Object.values(p.team_evidence??{}).map(e=>e.projected_qb_name).filter(Boolean);if(qbs.length)card.append(el('p','Projected QBs: '+qbs.join(' / '),'source-note'));}
   card.append(el('p','HOLD · Not an actionable Ontario bet','ev-caution'));grid.append(card);
  }
  for(const g of abstain){const card=el('article',undefined,'ev-card');card.append(el('h3',`${g.away_team} @ ${g.home_team}`),el('p','ABSTAIN · No model probability','orange'),el('p',(g.reasons??[]).join(' · ').replaceAll('_',' '),'muted'));grid.append(card);}
  if(!predictions.length&&!abstain.length)grid.append(el('p',data.reason||'No eligible live Phase 10 predictions.','muted'));
 }catch(e){summary.textContent='Phase 10 unavailable · '+e.message+' · ABSTAIN'}finally{refresh.disabled=false}}
refresh.addEventListener('click',load);load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!refresh.disabled)load()});
