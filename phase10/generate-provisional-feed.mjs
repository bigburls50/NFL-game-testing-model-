import fs from 'node:fs/promises';
import {parseCSV} from './baseline.mjs';
import {runProvisionalPipeline} from './run-provisional-pipeline.mjs';

const SOURCE='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
export function kickoffUtc(day,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))return null;
 const local=Date.parse(`${day}T${time}:00Z`),format=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',timeZoneName:'shortOffset'});
 const offset=format.formatToParts(new Date(local+5*3600000)).find(p=>p.type==='timeZoneName')?.value.match(/^GMT([+-]\d+)$/);
 return offset?new Date(local-Number(offset[1])*3600000).toISOString():null;
}
export async function generateFeed({fetchImpl=fetch,asOf=new Date().toISOString()}={}){
 const response=await fetchImpl(SOURCE,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Schedule HTTP '+response.status);
 const rows=parseCSV(await response.text()),now=Date.parse(asOf);
 const upcoming=rows.filter(r=>['REG','WC','DIV','CON','SB'].includes(r.game_type)&&!r.home_score&&!r.away_score).map(r=>({game_id:r.game_id,season:Number(r.season),week:Number(r.week),home_team:r.home_team,away_team:r.away_team,kickoff_utc:kickoffUtc(r.gameday,r.gametime)})).filter(g=>Date.parse(g.kickoff_utc)>now&&Date.parse(g.kickoff_utc)<now+8*86400000).sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc));
 if(!upcoming.length)return {status:'unavailable',generated_at_utc:asOf,games:[],reason:'No upcoming schedule rows'};
 const {season,week}=upcoming[0],games=upcoming.filter(g=>g.season===season&&g.week===week);
 return await runProvisionalPipeline({season,week,games},{historicalGames:rows.filter(r=>Number(r.season)>=season-10),asOf});
}
if(process.argv[1]?.endsWith('generate-provisional-feed.mjs')){
 const feed=await generateFeed();
 await fs.writeFile(process.argv[2]??'phase10/live-predictions.json',JSON.stringify(feed,null,2)+'\n');
 console.log(JSON.stringify({status:feed.status,model:feed.model,games:feed.games.map(g=>({game:g.game_id,status:g.status,p:g.home_win_probability,reasons:g.reasons})),errors:feed.errors}));
}
