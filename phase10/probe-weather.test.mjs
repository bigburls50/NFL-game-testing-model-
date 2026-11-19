import test from 'node:test';
import assert from 'node:assert/strict';
import {probeWeather} from './probe-weather.mjs';
const manifest={schedule_verified:true,season:2026,week:11,games:[{game_id:'g',home_team:'BUF',away_team:'MIA',kickoff_utc:'2026-11-22T18:00:00Z'}]};
test('weather probe captures source failures without invented values',async()=>{
 const result=await probeWeather(manifest,{asOf:'2026-11-18T18:00:00Z',fetchImpl:async()=>({ok:false,status:503})});
 assert.equal(result.ready_for_forecast,false);assert.equal(result.forecast_rows.length,0);assert.equal(result.failures.length,1);
});
test('weather probe archives valid forecast coverage',async()=>{
 const result=await probeWeather(manifest,{asOf:'2026-11-18T18:00:00Z',fetchImpl:async()=>({ok:true,json:async()=>({hourly:{time:['2026-11-22T18:00'],temperature_2m:[32],wind_speed_10m:[10],precipitation_probability:[20]}})})});
 assert.equal(result.ready_for_forecast,true);assert.equal(result.forecast_rows[0].precip_probability,.2);
});
