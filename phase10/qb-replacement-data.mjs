import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {indexQBProduction} from './qb-replacement-research.mjs';
export async function fetchQBReplacementEvidence(season,{fetchImpl=fetch}={}){
 if(!Number.isInteger(season)||season<2017||season>2100)throw Error('Invalid QB evidence season');
 const results=await Promise.all([season-1,season].map(async y=>{const url=`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${y}.csv`,r=await fetchImpl(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('QB stats HTTP '+r.status);const raw=await r.text();if(raw.length>20_000_000)throw Error('QB stats source exceeds size limit');const rows=parseCSV(raw);if(!['game_id','player_id','position','team','passing_epa','rushing_epa','attempts','sacks_suffered','carries'].every(k=>k in(rows[0]??{})))throw Error('QB stats schema unavailable');return {rows:rows.filter(r=>r.position==='QB'),source:{url,sha256:createHash('sha256').update(raw).digest('hex')}}}));
 const production=indexQBProduction(results.flatMap(r=>r.rows));if(production.size<200)throw Error('Insufficient prior QB stats');return {production,sources:results.map(r=>r.source),retrieved_at_utc:new Date().toISOString(),game_count:production.size};
}
