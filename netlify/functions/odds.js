exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return {statusCode:405,body:'Method not allowed'};
  const key=process.env.ODDS_API_KEY;
  const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
  if (!key) return {statusCode:503,headers,body:JSON.stringify({error:'ODDS_API_KEY is not configured in Netlify environment variables.'})};
  try {
    const url=new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/');
    url.searchParams.set('apiKey',key);
    url.searchParams.set('regions','us,ca');
    url.searchParams.set('markets','h2h');
    url.searchParams.set('oddsFormat','american');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    let response;
    try {response=await fetch(url,{signal:controller.signal})} finally {clearTimeout(timer)}
    if(!response.ok) return {statusCode:502,headers,body:JSON.stringify({error:'Odds provider returned '+response.status})};
    const data=await response.json();
    if(!Array.isArray(data)) throw Error('Unexpected odds response');
    // Region-specific availability is not established by this endpoint's bookmaker key alone.
    // Never label these quotes as verified Ontario prices.
    const allowed=new Set(['fanduel','draftkings','betmgm','betmgm_ontario','bet365','bet365_ca']);
    const games=data.map(g=>({
      id:String(g.id||''),home_team:g.home_team,away_team:g.away_team,commence_time:g.commence_time,
      bookmakers:(g.bookmakers||[]).filter(b=>allowed.has(b.key)).map(b=>({
        key:b.key,title:b.title,last_update:b.last_update,
        outcomes:(b.markets||[]).filter(m=>m.key==='h2h').flatMap(m=>m.outcomes||[]).filter(o=>Number.isFinite(o.price)).map(o=>({name:o.name,price:o.price}))
      }))
    }));
    return {statusCode:200,headers,body:JSON.stringify({source:'The Odds API',jurisdiction:'Unverified: US/Canada regional feed; NOT confirmed Ontario offers',retrieved_at:new Date().toISOString(),games})};
  } catch(e){return {statusCode:502,headers,body:JSON.stringify({error:'Could not retrieve odds data. Try again later.'})}}
};