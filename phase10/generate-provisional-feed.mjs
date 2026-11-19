import fs from 'node:fs/promises';
import {parseCSV} from './baseline.mjs';
import {runProvisionalPipeline} from './run-provisional-pipeline.mjs';

const SOURCE='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const SCOREBOARD='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50';
export function kickoffUtc(day,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))return null;
 const local=Date.parse(`${day}T${time}:00Z`),format=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',timeZoneName:'shortOffset'});
 const offset=format.formatToParts(new Date(local+5*3600000)).find(p=>p.type==='timeZoneName')?.value.match(/^GMT([+-]\d+)$/);
 return offset?new Date(local-Number(offset[1])*3600000).toISOString():null;
}
export async function generateFeed({fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 const [response,scoreboard]=await Promise.all([fetchImpl(SOURCE,{signal:AbortSignal.timeout(30000)}),fetchImpl(SCOREBOARD,{signal:AbortSignal.timeout(15000)})]);
 if(!response.ok)throw Error('Schedule HTTP '+response.status);
 if(!scoreboard.ok)throw Error('Scoreboard HTTP '+scoreboard.status);
 const rows=parseCSV(await response.text()),now=Date.parse(asOf),events=(await scoreboard.json()).events;
 if(!Array.isArray(events))throw Error('Scoreboard schema unavailable');
 const official=JSON.parse(await fs.readFile(new URL('./upcoming-week11-2026.json',import.meta.url),'utf8'));
 const canon=t=>({WSH:'WAS',LAR:'LA',JAC:'JAX'}[t]??t);
 const espn=events.filter(e=>e.status?.type?.completed!==true).map(e=>{const c=e.competitions?.[0]?.competitors??[],h=c.find(x=>x.homeAway==='home')?.team,a=c.find(x=>x.homeAway==='away')?.team;return {home_team:canon(h?.abbreviation),away_team:canon(a?.abbreviation),home_logo:h?.logo,away_logo:a?.logo,kickoff_utc:e.date}});
 const upcoming=rows.filter(r=>['REG','WC','DIV','CON','SB'].includes(r.game_type)&&!r.home_score&&!r.away_score).map(r=>{
  const g={game_id:r.game_id,season:Number(r.season),week:Number(r.week),home_team:r.home_team,away_team:r.away_team,kickoff_utc:kickoffUtc(r.gameday,r.gametime),location:r.location,home_rest:r.home_rest,away_rest:r.away_rest};
  const matches=espn.filter(e=>e.home_team===canon(g.home_team)&&e.away_team===canon(g.away_team)&&Math.abs(Date.parse(e.kickoff_utc)-Date.parse(g.kickoff_utc))<86400000);
  if(matches.length!==1)return null;const e=matches[0];
  const officialMatch=official.games.find(v=>v.game_id===g.game_id&&Date.parse(v.kickoff_utc)===Date.parse(e.kickoff_utc));
  const logos={home_logo:e.home_logo,away_logo:e.away_logo};
  if(Date.parse(e.kickoff_utc)!==Date.parse(g.kickoff_utc)&&!officialMatch)return {...g,...logos,kickoff_utc:new Date(Math.min(Date.parse(e.kickoff_utc),Date.parse(g.kickoff_utc))).toISOString(),schedule_conflict:true};
  return {...g,...logos,kickoff_utc:new Date(e.kickoff_utc).toISOString(),schedule_source:officialMatch?official.source:SOURCE};
 }).filter(g=>g&&Date.parse(g.kickoff_utc)>now&&Date.parse(g.kickoff_utc)<now+8*86400000).sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc));
 if(!upcoming.length)return {status:'unavailable',generated_at_utc:asOf,games:[],reason:'No upcoming schedule rows'};
 const {season,week}=upcoming[0],games=upcoming.filter(g=>g.season===season&&g.week===week);
 return await runProvisionalPipeline({season,week,games},{historicalGames:rows.filter(r=>Number(r.season)>=season-10),asOf});
}
if(process.argv[1]?.endsWith('generate-provisional-feed.mjs')){
 const feed=await generateFeed();
 await fs.writeFile(process.argv[2]??'phase10/live-predictions.json',JSON.stringify(feed,null,2)+'\n');
 console.log(JSON.stringify({status:feed.status,model:feed.model,games:feed.games.map(g=>({game:g.game_id,status:g.status,p:g.home_win_probability,reasons:g.reasons})),errors:feed.errors}));
}
