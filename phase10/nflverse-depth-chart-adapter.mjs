// Free nflverse depth-chart projections; never claim official starting confirmation.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseCSV} from './baseline.mjs';
export async function fetchNflverseDepthCharts(season,{fetchImpl=fetch}={}){
 if(!Number.isInteger(season)||season<2020||season>2100)throw Error('invalid_season');
 const url=`https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_${season}.csv`;
 const response=await fetchImpl(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('depth_chart_http_'+response.status);
 const raw=Buffer.from(await response.arrayBuffer());if(raw.length>20000000)throw Error('depth_chart_too_large');
 const rows=parseCSV((raw[0]===31&&raw[1]===139?gunzipSync(raw):raw).toString('utf8'));
 const columns=Object.keys(rows[0]??{});
 const pick=(...keys)=>keys.find(k=>columns.includes(k));
 const teamKey=pick('team','club_code','recent_team'),idKey=pick('gsis_id','player_id'),positionKey=pick('position','position_group'),rankKey=pick('depth_team','depth_chart_rank','depth_rank','rank'),weekKey=pick('week');
 if(!teamKey||!idKey||!positionKey||!rankKey||!weekKey)throw Error('depth_chart_schema_unavailable:'+columns.join(','));
 return {rows,columns,keys:{teamKey,idKey,positionKey,rankKey,weekKey},source_url:url,source_digest:'sha256:'+createHash('sha256').update(raw).digest('hex')};
}
export function projectedQuarterbacks(source,week){
 const {teamKey,idKey,positionKey,rankKey,weekKey}=source.keys;
 return source.rows.filter(r=>Number(r[weekKey])===Number(week)&&r[positionKey]==='QB'&&Number(r[rankKey])===1&&/^00-\\d{7}$/.test(r[idKey]??'')).map(r=>({team:r[teamKey],position:'QB',player_id:r[idKey],depth_rank:1}));
}
