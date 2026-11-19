// Stadium-specific forecast adapter using Open-Meteo's free hourly forecast API.
// Values are forecasts, not observed stadium conditions; retrieval time is provenance.
const stadiums={
 HOU:{name:'NRG Stadium',lat:29.6847,lon:-95.4107,venue_type:'retractable'},
 BUF:{name:'Highmark Stadium',lat:42.7738,lon:-78.7868,venue_type:'outdoor'},
 CAR:{name:'Bank of America Stadium',lat:35.2258,lon:-80.8528,venue_type:'outdoor'},
 CHI:{name:'Soldier Field',lat:41.8623,lon:-87.6167,venue_type:'outdoor'},
 DAL:{name:'AT&T Stadium',lat:32.7473,lon:-97.0945,venue_type:'retractable'},
 DET:{name:'Ford Field',lat:42.34,lon:-83.0456,venue_type:'indoor'},
 KC:{name:'Arrowhead Stadium',lat:39.0489,lon:-94.4839,venue_type:'outdoor'},
 PHI:{name:'Lincoln Financial Field',lat:39.9008,lon:-75.1675,venue_type:'outdoor'},
 LAC:{name:'SoFi Stadium',lat:33.9535,lon:-118.3392,venue_type:'indoor'},
 DEN:{name:'Empower Field at Mile High',lat:39.7439,lon:-105.0201,venue_type:'outdoor'},
 NYG:{name:'MetLife Stadium',lat:40.8135,lon:-74.0745,venue_type:'outdoor'},
 SF:{name:"Levi's Stadium",lat:37.403,lon:-121.97,venue_type:'outdoor'},
 WAS:{name:'Northwest Stadium',lat:38.9077,lon:-76.8645,venue_type:'outdoor'}
};
export {stadiums};
export async function collectStadiumWeather(games,{fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 const now=Date.parse(asOf);if(!Number.isFinite(now))throw Error('Invalid collection time');
 const rows=[],failures=[];
 for(const g of games){
  const stadium=stadiums[g.home_team];
  if(!stadium){failures.push({game_id:g.game_id,reason:'unknown_stadium'});continue;}
  const kickoff=Date.parse(g.kickoff_utc);
  if(!Number.isFinite(kickoff)||kickoff<=now){failures.push({game_id:g.game_id,reason:'kickoff_not_future'});continue;}
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  for(const [key,val] of Object.entries({latitude:stadium.lat,longitude:stadium.lon,hourly:'temperature_2m,wind_speed_10m,precipitation_probability',temperature_unit:'fahrenheit',wind_speed_unit:'mph',timezone:'UTC',forecast_days:16}))url.searchParams.set(key,String(val));
  try{
   const response=await fetchImpl(url.href,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'},redirect:'error'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const payload=await response.json(),hourly=payload.hourly;
   if(!hourly||!Array.isArray(hourly.time))throw Error('Missing hourly forecast');
   const index=hourly.time.findIndex(t=>Date.parse(t+'Z')===Math.floor(kickoff/3600000)*3600000);
   if(index<0)throw Error('Kickoff outside forecast horizon');
   const temperature_f=Number(hourly.temperature_2m?.[index]),wind_mph=Number(hourly.wind_speed_10m?.[index]),prob=Number(hourly.precipitation_probability?.[index]);
   if(!Number.isFinite(temperature_f)||!Number.isFinite(wind_mph)||!Number.isFinite(prob)||prob<0||prob>100)throw Error('Invalid forecast measurement');
   rows.push({game_id:g.game_id,team:g.home_team,kind:'weather',observed_at_utc:asOf,retrieved_at_utc:asOf,source_url:'https://open-meteo.com/en/docs',forecast_request_url:url.href,stadium:stadium.name,venue_type:stadium.venue_type,temperature_f,wind_mph,precip_probability:prob/100,forecast_valid_at_utc:new Date(Math.floor(kickoff/3600000)*3600000).toISOString(),roof_status:'unknown'});
  }catch(e){failures.push({game_id:g.game_id,reason:e.message});}
 }
 return {rows,failures,warning:'Open-Meteo weather is a forecast; retractable roof status is unknown, and indoor measurements do not represent playing-surface conditions.'};
}
