// nflverse injury CSV adapter. Report dates are retained; no missing team is called healthy.
// Candidate observations remain research-only until player IDs and report timestamps verify.
import {parseCSV} from './baseline.mjs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
export async function fetchNflverseInjuries(season,{fetchImpl=fetch}={}){
 if(!Number.isInteger(season)||season<2020||season>2100)throw Error('Invalid season');
 const url='https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_'+season+'.csv';
 const response=await fetchImpl(url,{headers:{'User-Agent':'NFL-Auto-Research/1.0'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Injury source HTTP '+response.status);
 const raw=Buffer.from(await response.arrayBuffer());
 if(raw.length>15_000_000)throw Error('Injury file exceeds size limit');
 const decoded=raw[0]===0x1f&&raw[1]===0x8b?gunzipSync(raw):raw;
 const rows=parseCSV(decoded.toString('utf8'));
 const fields=rows[0]??{};
 if(!('team' in fields)||!('week' in fields))throw Error('Unexpected injury source schema');
 return {source_url:url,source_digest:'sha256:'+createHash('sha256').update(raw).digest('hex'),rows,warning:'Player injuries are candidate data, not a complete verified weekly team report. Confirm published dates and player IDs before forecast use.'};
}
export function injuryCandidates(source,week,teams){
 const teamSet=new Set(teams);
 return source.rows.filter(r=>Number(r.week)===week&&teamSet.has(r.team)).map(r=>({
 team:r.team,week:Number(r.week),player_id:r.gsis_id||r.player_id||null,player_name:r.full_name||r.player_name||null,
 practice_status:r.report_status||r.practice_status||null,game_status:r.game_status||null,
 report_date:r.date_modified||r.report_date||null,source_url:source.source_url,source_digest:source.source_digest
 }));
}
