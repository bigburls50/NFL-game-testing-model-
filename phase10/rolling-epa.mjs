#!/usr/bin/env node
// Derive pregame team and QB EPA features ONLY from earlier completed games.
// Input rows are postgame team-level aggregates from fetch-pbp.mjs.
import fs from 'node:fs';import {parseCSV} from './baseline.mjs';
const num=x=>x===''||x===undefined?null:Number.isFinite(Number(x))?Number(x):null;
export function rollingEpa(games,teamGames,{lookback=8}={}) {
 if(!Number.isInteger(lookback)||lookback<1)throw Error('Invalid lookback');
 const byGame=new Map(),gameDates=new Map();
 for(const g of games){if(!g.game_id||!/^\d{4}-\d{2}-\d{2}$/.test(g.gameday))throw Error('Invalid game/date');if(gameDates.has(g.game_id))throw Error('Duplicate game');gameDates.set(g.game_id,g.gameday)}
 for(const r of teamGames){if(!gameDates.has(r.game_id))continue;const key=r.game_id+'|'+r.team;if(byGame.has(key))throw Error('Duplicate team-game');byGame.set(key,r)}
 const history=new Map(),out=[];
 const ordered=[...games].sort((a,b)=>a.gameday.localeCompare(b.gameday)||a.game_id.localeCompare(b.game_id));
 for(let i=0;i<ordered.length;){const date=ordered[i].gameday,batch=[];while(i<ordered.length&&ordered[i].gameday===date)batch.push(ordered[i++]);
 const summary=team=>{const h=(history.get(team)??[]).slice(-lookback);const avg=k=>{const valid=h.map(r=>num(r[k])).filter(x=>x!==null);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:''};return {n:h.length,off:avg('offense_epa_per_play'),qb:avg('qb_epa_per_dropback'),cpoe:avg('qb_cpoe'),def:avg('defense_epa_allowed_per_play')}};
 for(const g of batch){const h=summary(g.home_team),a=summary(g.away_team);out.push({game_id:g.game_id,season:g.season,gameday:date,home_team:g.home_team,away_team:g.away_team,home_prior_games:h.n,away_prior_games:a.n,home_offense_epa_per_play:h.off,away_offense_epa_per_play:a.off,home_qb_epa_per_dropback:h.qb,away_qb_epa_per_dropback:a.qb,home_qb_cpoe:h.cpoe,away_qb_cpoe:a.cpoe,home_defense_epa_allowed_per_play:h.def,away_defense_epa_allowed_per_play:a.def})}
 for(const g of batch){for(const team of [g.home_team,g.away_team]){const own=byGame.get(g.game_id+'|'+team);if(!own)continue;const opponent=team===g.home_team?g.away_team:g.home_team,opp=byGame.get(g.game_id+'|'+opponent);const next={...own,defense_epa_allowed_per_play:opp?.offense_epa_per_play??''};history.set(team,[...(history.get(team)??[]),next])}}
 }return out;
}
if(process.argv[1]?.endsWith('rolling-epa.mjs')){try{const [games,team,outfile]=process.argv.slice(2);if(!games||!team||!outfile)throw Error('Usage: rolling-epa.mjs historical-games.csv team-qb-epa.csv output.csv');const out=rollingEpa(parseCSV(fs.readFileSync(games,'utf8')),parseCSV(fs.readFileSync(team,'utf8'))),keys=Object.keys(out[0]??{});fs.writeFileSync(outfile,[keys.join(','),...out.map(r=>keys.map(k=>r[k]).join(','))].join('\n')+'\n');console.log(JSON.stringify({games:out.length,with_prior_data:out.filter(r=>r.home_prior_games&&r.away_prior_games).length,warning:'Lagged historical game features; still requires validated source coverage and out-of-sample model training.'}))}catch(e){console.error(e.stack);process.exitCode=1}}
