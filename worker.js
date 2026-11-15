const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
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