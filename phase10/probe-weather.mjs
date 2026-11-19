#!/usr/bin/env node
// Live weather probe for upcoming schedule, preserving partial coverage and failures.
import fs from 'node:fs';
import path from 'node:path';
import {collectStadiumWeather} from './open-meteo-adapter.mjs';
export async function probeWeather(manifest,options={}){
 if(manifest.schedule_verified!==true||!Array.isArray(manifest.games))throw Error('Verified schedule required');
 const result=await collectStadiumWeather(manifest.games,options);
 return {checked_at_utc:options.asOf??new Date().toISOString(),season:manifest.season,week:manifest.week,forecast_rows:result.rows,failures:result.failures,ready_for_forecast:result.failures.length===0&&result.rows.length===manifest.games.length,warning:'Weather is forecast-only; retractable roofs and indoor field conditions are unverified.'};
}
if(process.argv[1]?.endsWith('probe-weather.mjs')){
 const input=process.argv[2]??'phase10/upcoming-week11-2026.json',output=process.argv[3]??'phase10/data/weather-source-audit.json';
 try{
  const result=await probeWeather(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({forecasts:result.forecast_rows.length,failures:result.failures.length,ready:result.ready_for_forecast}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
