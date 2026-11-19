import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {indexPlayerIds,indexSnapCounts} from './player-impact-research.mjs';
const BASE='https://github.com/nflverse/nflverse-data/releases/download/';
export async function fetchRoleEvidence(season,{fetchImpl=fetch}={}){
 if(!Number.isInteger(season)||season<2017||season>2100)throw Error('Invalid role data season');
 const urls=[BASE+'players/players.csv',...([season-1,season].map(y=>BASE+'snap_counts/snap_counts_'+y+'.csv'))];
 const data=await Promise.all(urls.map(async url=>{const r=await fetchImpl(url,{signal:AbortSignal.timeout(30000),redirect:'follow'});if(!r.ok)throw Error('Player role source HTTP '+r.status);const raw=await r.text();if(raw.length>20_000_000)throw Error('Role source exceeds size limit');return {rows:parseCSV(raw),source:{url,sha256:createHash('sha256').update(raw).digest('hex')}}}));
 if(!['gsis_id','pfr_id'].every(k=>k in (data[0].rows[0]??{}))||data.slice(1).some(d=>!['game_id','pfr_player_id','team','opponent','offense_pct','defense_pct'].every(k=>k in(d.rows[0]??{}))))throw Error('Unexpected role source schema');
 const mapping=indexPlayerIds(data[0].rows),snaps=indexSnapCounts(data.slice(1).flatMap(d=>d.rows),mapping);
 if(mapping.size<1000||snaps.size<200)throw Error('Inadequate snap-count identity coverage');
 return {snaps,sources:data.map(d=>d.source),retrieved_at_utc:new Date().toISOString(),mapped_players:mapping.size,valid_team_games:snaps.size};
}
