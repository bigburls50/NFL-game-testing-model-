const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health')return reply({status:'ok',service:'nfl-game-testing-model',hosting:'cloudflare-workers',time:new Date().toISOString(),odds_configured:Boolean(env.ODDS_API_KEY)});
  if(url.pathname==='/api/live-sources'){
   if(request.method!=='GET')return reply({error:'Method not allowed'},405);
   const targets=[
    {id:'official_injury_report',url:'https://www.nfl.com/injuries/',official:true},
    {id:'official_weekly_status',url:'https://www.nfl.com/news/nfl-week-11-injury-report-2026-season',official:true},
    {id:'schedule',url:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50',official:false}
   ];
   const checks=await Promise.all(targets.map(async target=>{
    try{
     const response=await fetch(target.url,{signal:AbortSignal.timeout(8000),headers:{'Accept':'text/html,application/json'}});
     const contentType=response.headers.get('content-type')||'';
     const text=await response.text();
     const plausible=response.ok&&text.length>200&&(/json/i.test(contentType)?text.includes('events'):/(injur|questionable|out|game status)/i.test(text));
     return {id:target.id,source_url:target.url,official:target.official,reachable:response.ok,content_detected:plausible,checked_at_utc:new Date().toISOString(),certified:false,reason:plausible?'Source reachable; team-level completeness and timestamped identity not verified':'Source unavailable or unusable'};
    }catch{return {id:target.id,source_url:target.url,official:target.official,reachable:false,content_detected:false,checked_at_utc:new Date().toISOString(),certified:false,reason:'Provider request failed or timed out'}}
   }));
   return reply({status:'source_probes_only',checks,verified_games:0,warning:'Source reachability is not independent QB confirmation or complete final injury-report certification.'});
  }
  if(url.pathname==='/api/verification'){
   if(request.method!=='GET')return reply({error:'Method not allowed'},405);
   try{
    const upstream=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50',{signal:AbortSignal.timeout(10000),headers:{'Accept':'application/json'}});
    if(!upstream.ok)throw Error('Schedule provider HTTP '+upstream.status);
    const body=await upstream.json();
    if(!Array.isArray(body.events))throw Error('Invalid schedule provider response');
    const now=Date.now();
    const games=body.events.filter(e=>Date.parse(e.date)>now&&Date.parse(e.date)<now+21*86400000).map(e=>{
     const competitors=e.competitions?.[0]?.competitors||[];
     const home=competitors.find(c=>c.homeAway==='home')?.team?.displayName;
     const away=competitors.find(c=>c.homeAway==='away')?.team?.displayName;
     if(!home||!away)return null;
     return {game_id:String(e.id),kickoff_utc:e.date,home_team:home,away_team:away,decision:'abstain',checks:{home_qb:'unverified',away_qb:'unverified',home_final_injury_report:'unverified',away_final_injury_report:'unverified'},reasons:['home_qb_unconfirmed','away_qb_unconfirmed','home_injury_report_unverified','away_injury_report_unverified']};
    }).filter(Boolean);
    return reply({status:'preliminary_schedule_only',source:'ESPN unofficial scoreboard',retrieved_at_utc:new Date().toISOString(),verified_games:0,games,warning:'Schedule is not quarterback or injury verification. Fail-closed until independently certified evidence and model scoring are integrated.'});
   }catch{return reply({status:'unavailable',verified_games:0,games:[],reason:'Live schedule unavailable; no verification can be claimed.'},503)}
  }
  if(url.pathname==='/api/predictions'){
   if(request.method!=='GET')return reply({error:'Method not allowed'},405);
   // Phase 10 historical evaluation is not a live prediction feed.
   // Never manufacture a live pick from retrospective calibration artifacts.
   if(!env.VERIFIED_PREDICTIONS_JSON)return reply({status:'unavailable',model:'phase10',verified:false,predictions:[],reason:'No independently verified, timestamped live prediction feed is configured.'});
   let records;
   try{records=JSON.parse(env.VERIFIED_PREDICTIONS_JSON)}catch{return reply({error:'Invalid prediction feed configuration',predictions:[]},503)}
   if(!Array.isArray(records))return reply({error:'Prediction feed must be an array',predictions:[]},503);
   const now=Date.now(),seen=new Set(),predictions=[];
   for(const p of records){
    if(!p||typeof p!=='object'||typeof p.game_id!=='string'||!p.game_id||seen.has(p.game_id))continue;
    const kickoff=Date.parse(p.kickoff_utc),created=Date.parse(p.prediction_created_utc),qb=Date.parse(p.qb_verified_utc),injury=Date.parse(p.injuries_verified_utc);
    if(![kickoff,created,qb,injury].every(Number.isFinite)||created>=kickoff||qb>=kickoff||injury>=kickoff||now>=kickoff||now-created>24*3600000||now-qb>48*3600000||now-injury>48*3600000)continue;
    if(p.model_version!=='phase10'||p.qb_verified!==true||p.injuries_verified===undefined||p.injuries_verified!==true||p.source_verified!==true||!p.qb_source||!p.injury_source)continue;
    if(typeof p.home_team!=='string'||typeof p.away_team!=='string'||!Number.isFinite(p.home_win_probability)||p.home_win_probability<=0||p.home_win_probability>=1)continue;
    seen.add(p.game_id);predictions.push({game_id:p.game_id,kickoff_utc:p.kickoff_utc,home_team:p.home_team,away_team:p.away_team,home_win_probability:p.home_win_probability,model_version:p.model_version,prediction_created_utc:p.prediction_created_utc,status:'verified',qb_verified_utc:p.qb_verified_utc,injuries_verified_utc:p.injuries_verified_utc});
   }
   return reply({status:predictions.length?'available':'unavailable',model:'phase10',verified:predictions.length>0,predictions,reason:predictions.length?'':'No eligible independently verified upcoming predictions.'});
  }
  if(url.pathname==='/.netlify/functions/odds'||url.pathname==='/api/odds'){
   if(request.method!=='GET')return reply({error:'Method not allowed'},405);
   if(!env.ODDS_API_KEY)return reply({error:'ODDS_API_KEY is not configured as a Cloudflare Worker secret.'},503);
   try{
    const upstream=new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/');
    upstream.searchParams.set('apiKey',env.ODDS_API_KEY);
    upstream.searchParams.set('regions','us,ca');
    upstream.searchParams.set('markets','h2h');
    upstream.searchParams.set('oddsFormat','american');
    const response=await fetch(upstream.toString(),{signal:AbortSignal.timeout(12000)});
    if(!response.ok)return reply({error:'Odds provider returned HTTP '+response.status},502);
    const data=await response.json();
    if(!Array.isArray(data))return reply({error:'Unexpected odds provider response'},502);
    const allowed=new Set(['fanduel','draftkings','betmgm','betmgm_ontario','bet365','bet365_ca']);
    const games=data.map(g=>({
      id:String(g.id||''),home_team:g.home_team,away_team:g.away_team,commence_time:g.commence_time,
      bookmakers:(g.bookmakers||[]).filter(b=>allowed.has(b.key)).map(b=>({
        key:b.key,title:b.title,last_update:b.last_update,
        outcomes:(b.markets||[]).filter(m=>m.key==='h2h').flatMap(m=>m.outcomes||[]).filter(o=>Number.isFinite(o.price)).map(o=>({name:o.name,price:o.price}))
      }))
    }));
    return reply({source:'The Odds API',jurisdiction:'Unverified: US/Canada regional feed; NOT confirmed Ontario offers',retrieved_at:new Date().toISOString(),games});
   }catch(e){return reply({error:'Odds service unavailable: '+(e?.name==='TimeoutError'?'request timed out':'upstream request failed')},502);}
  }
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return reply({error:'Static assets binding unavailable'},503);
 }
};