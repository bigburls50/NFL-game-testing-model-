// Free nflverse depth-chart projections; never claim official starting confirmation.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseCSV} from './baseline.mjs';
export async function fetchNflverseDepthCharts(season,{fetchImpl=fetch}={}){
 if(!Number.isInteger(season)||season<2020||season>2100)throw Error('invalid_season');
 const url=`https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_${season}.csv`;
 const response=await fetchImpl(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('depth_chart_http_'+response.status);
 const raw=Buffer.from(await response.arrayBuffer());if(raw.length>100000000)throw Error('depth_chart_too_large');
 const rows=parseCSV((raw[0]===31&&raw[1]===139?gunzipSync(raw):raw).toString('utf8'));
 const columns=Object.keys(rows[0]??{});
 const pick=(...keys)=>keys.find(k=>columns.includes(k));
 const teamKey=pick('team','club_code','recent_team'),idKey=pick('gsis_id','player_id'),positionKey=pick('position','position_group','pos_abb'),rankKey=pick('depth_team','depth_chart_rank','depth_rank','rank','pos_rank'),weekKey=pick('week','dt');
 if(!teamKey||!idKey||!positionKey||!rankKey||!weekKey)throw Error('depth_chart_schema_unavailable:'+columns.join(','));
 return {rows,columns,keys:{teamKey,idKey,positionKey,rankKey,weekKey},source_url:url,source_digest:'sha256:'+createHash('sha256').update(raw).digest('hex')};
}
export function projectedQuarterbacks(source,week,{asOf=new Date().toISOString()}={}){
 const {teamKey,idKey,positionKey,rankKey,weekKey}=source.keys;
 const dated=weekKey==='dt',cutoff=Date.parse(asOf);
 if(!Number.isFinite(cutoff))throw Error('invalid_as_of');
 const valid=source.rows.filter(r=>{
  const date=Date.parse(r[weekKey]);
  return (dated?(Number.isFinite(date)&&date<=cutoff&&cutoff-date<=14*86400000):Number(r[weekKey])===Number(week))&&r[positionKey]==='QB'&&Number(r[rankKey])===1&&/^00-\d{7}$/.test(r[idKey]??'');
 });
 if(!dated)return valid.map(r=>({team:r[teamKey],position:'QB',player_id:r[idKey],depth_rank:1}));
 const newest=new Map();for(const r of valid){const team=r[teamKey],date=Date.parse(r[weekKey]);if(!newest.has(team)||date>newest.get(team))newest.set(team,date)}
 return valid.filter(r=>Date.parse(r[weekKey])===newest.get(r[teamKey])).map(r=>({team:r[teamKey],position:'QB',player_id:r[idKey],depth_rank:1}));
}
