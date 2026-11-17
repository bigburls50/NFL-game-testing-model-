#!/usr/bin/env node
// Point-in-time rest days: only games strictly before this calendar date count.
// Date-level granularity intentionally excludes same-day outcomes.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
const day=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Invalid ISO game date');const n=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error('Invalid calendar date');return n/86400000};
export function pregameRest(games){
 const ids=new Set(),ordered=games.map(g=>{
  if(!g.game_id||ids.has(g.game_id)||!g.home_team||!g.away_team||g.home_team===g.away_team)throw Error('Invalid or duplicate game/team');
  const season=Number(g.season);if(!Number.isInteger(season)||season<1990||season>2100)throw Error('Invalid season');
  const gameDay=day(g.gameday);const year=Number(g.gameday.slice(0,4));const month=Number(g.gameday.slice(5,7));if(!((year===season&&month>=8)||(year===season+1&&month<=2)))throw Error('Game date outside NFL season window');
  ids.add(g.game_id);return {...g,_day:gameDay};
 }).sort((a,b)=>a._day-b._day||a.game_id.localeCompare(b.game_id));
 const last=new Map(),out=[];
 for(let i=0;i<ordered.length;){
  const today=ordered[i]._day,batch=[];
  while(i<ordered.length&&ordered[i]._day===today)batch.push(ordered[i++]);
  const seen=new Set();
  for(const g of batch){
   if(seen.has(g.home_team)||seen.has(g.away_team))throw Error('Team scheduled twice on same day');
   seen.add(g.home_team);seen.add(g.away_team);
   const home=last.get(g.home_team),away=last.get(g.away_team);
   // Offseason is not meaningful in-season rest; mark season openers unknown.
   const homePrior=home?.season===String(g.season)?home.day:undefined;
   const awayPrior=away?.season===String(g.season)?away.day:undefined;
   // A gap beyond four weeks is not credible ordinary NFL game-to-game rest.\n   // Fail closed rather than treating preseason-to-playoffs or missing schedules as rest.\n   const rest=prior=>prior===undefined||today-prior-1>28?'':today-prior-1;\n   const h=rest(homePrior),a=rest(awayPrior);
   if((h!==''&&h<0)||(a!==''&&a<0))throw Error('Negative rest');
   out.push({game_id:g.game_id,season:g.season,gameday:g.gameday,home_team:g.home_team,away_team:g.away_team,home_rest_days:h,away_rest_days:a,rest_days_edge:h===''||a===''?'':h-a,home_short_rest:h===''?'':Number(h<6),away_short_rest:a===''?'':Number(a<6)});
  }
  for(const g of batch){last.set(g.home_team,{day:today,season:String(g.season)});last.set(g.away_team,{day:today,season:String(g.season)})}
 }
 return out;
}
if(process.argv[1]?.endsWith('pregame-rest.mjs')){try{
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: pregame-rest.mjs historical-games.csv output.csv');
 const rows=pregameRest(parseCSV(fs.readFileSync(input,'utf8'))),cols=['game_id','season','gameday','home_team','away_team','home_rest_days','away_rest_days','rest_days_edge','home_short_rest','away_short_rest'];
 const esc=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
 fs.writeFileSync(output,[cols.join(','),...rows.map(r=>cols.map(k=>esc(r[k])).join(','))].join('\n')+'\n');
 console.log(JSON.stringify({games:rows.length,with_both_prior_games:rows.filter(r=>r.rest_days_edge!=='').length,warning:'Calendar-date-only in-season rest feature; season openers have unknown rest; historical team codes and schedule changes require audit. Not yet trained into model.'}));
}catch(e){console.error(e.message);process.exitCode=1}}
