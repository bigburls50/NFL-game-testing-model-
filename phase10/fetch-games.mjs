#!/usr/bin/env node
// Download real historical NFL game outcomes. Does NOT manufacture predictions.
import { writeFileSync, mkdirSync } from 'node:fs';
const URL='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const min=Number(process.argv[2]??2020), max=Number(process.argv[3]??2025);
if(!Number.isInteger(min)||!Number.isInteger(max)||min<1999||max>2026||min>max)throw Error('Usage: node phase10/fetch-games.mjs [first-season] [last-season]');
function csvRows(text){let rows=[],row=[],v='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){row.push(v);v=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x.trim()))rows.push(row);row=[];v=''}else v+=c}if(q)throw Error('Unclosed CSV quote');row.push(v);if(row.some(x=>x.trim()))rows.push(row);const [header,...data]=rows;return data.map(r=>Object.fromEntries(header.map((h,i)=>[h.trim(),(r[i]??'').trim()])));}
function esc(x){const s=String(x??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
const res=await fetch(URL,{headers:{'User-Agent':'NFL-Auto-Research-Historical-Importer'}});
if(!res.ok)throw Error('nflverse download failed: HTTP '+res.status);
const rows=csvRows(await res.text());
const required=['game_id','season','game_type','gameday','gametime','home_team','away_team','home_score','away_score'];
if(!rows.length||required.some(k=>!(k in rows[0])))throw Error('Unexpected nflverse CSV schema');
const eligible=rows.filter(r=>Number(r.season)>=min&&Number(r.season)<=max&&['REG','WC','DIV','CON','SB'].includes(r.game_type)&&r.home_score!==''&&r.away_score!==''&&Number.isInteger(Number(r.home_score))&&Number.isInteger(Number(r.away_score))&&r.gameday);
const unique=new Set();for(const r of eligible){if(unique.has(r.game_id))throw Error('Duplicate game_id '+r.game_id);unique.add(r.game_id)}
eligible.sort((a,b)=>a.gameday.localeCompare(b.gameday)||a.game_id.localeCompare(b.game_id));
const fields=['game_id','season','week','game_type','gameday','gametime','home_team','away_team','home_score','away_score','spread_line','home_moneyline','away_moneyline'];
mkdirSync('phase10/data',{recursive:true});
writeFileSync('phase10/data/historical-games.csv',[fields.join(','),...eligible.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\n')+'\n');
const summary={source:URL,season_start:min,season_end:max,completed_games:eligible.length,by_season:Object.fromEntries([...new Set(eligible.map(r=>r.season))].sort().map(s=>[s,eligible.filter(r=>r.season===s).length])),note:'Final results and closing-line fields are outcomes/reference data, NOT pregame model predictions. Never use current-game outcomes or closing odds as features in earlier predictions.'};
writeFileSync('phase10/data/source-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
