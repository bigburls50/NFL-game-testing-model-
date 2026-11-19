// Verify roster identities from nflverse player IDs. A roster is identity evidence, not a starter designation.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseCSV} from './baseline.mjs';
export async function fetchVerifiedRosterIds({fetchImpl=fetch,url='https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'}={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='github.com'||!u.pathname.startsWith('/nflverse/nflverse-data/releases/download/players/'))throw Error('untrusted_roster_url');
 const response=await fetchImpl(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Roster HTTP '+response.status);
 const raw=Buffer.from(await response.arrayBuffer());
 if(raw.length>20_000_000)throw Error('Roster file too large');
 const data=(raw[0]===31&&raw[1]===139?gunzipSync(raw):raw).toString('utf8');
 const rows=parseCSV(data),columns=Object.keys(rows[0]??{});
 const idKey=['gsis_id','player_id'].find(k=>columns.includes(k));
 const nameKey=['display_name','full_name','player_name'].find(k=>columns.includes(k));
 const teamKey=['latest_team','team','recent_team'].find(k=>columns.includes(k));
 if(!idKey||!nameKey||!teamKey)throw Error('Roster identity schema unavailable');
 const players=rows.filter(r=>r[idKey]&&r[nameKey]&&r[teamKey]).map(r=>({player_id:r[idKey],player_name:r[nameKey],team:r[teamKey]}));
 return {players,source_url:url,source_digest:'sha256:'+createHash('sha256').update(raw).digest('hex'),warning:'nflverse IDs identify players but team assignment and QB status require current independent verification.'};
}
