import test from 'node:test';
import assert from 'node:assert/strict';
import {collectStadiumWeather,stadiums} from './open-meteo-adapter.mjs';
const game={game_id:'g',home_team:'BUF',away_team:'MIA',kickoff_utc:'2026-11-22T18:00:00Z'};
const asOf='2026-11-18T18:00:00Z';
test('all Week 11 home stadiums have explicit coordinates',()=>{
 const teams=['HOU','BUF','CAR','CHI','DAL','DET','KC','PHI','LAC','DEN','NYG','SF','WAS'];
 for(const team of teams){assert.ok(stadiums[team]);assert.ok(Math.abs(stadiums[team].lat)<=90);assert.ok(Math.abs(stadiums[team].lon)<=180);}
});
test('Open-Meteo maps hourly forecast to kickoff and normalizes precipitation',async()=>{
 const fetchImpl=async url=>{assert.match(url,/api.open-meteo.com/);assert.match(url,/timezone=UTC/);return {ok:true,json:async()=>({hourly:{time:['2026-11-22T18:00'],temperature_2m:[35],wind_speed_10m:[12],precipitation_probability:[70]}})};};
 const r=await collectStadiumWeather([game],{fetchImpl,asOf});
 assert.equal(r.failures.length,0);assert.equal(r.rows[0].precip_probability,.7);assert.equal(r.rows[0].temperature_f,35);assert.equal(r.rows[0].venue_type,'outdoor');
});
test('missing hourly forecast is an abstention, not a zero forecast',async()=>{
 const r=await collectStadiumWeather([game],{asOf,fetchImpl:async()=>({ok:true,json:async()=>({hourly:{time:[]}})})});
 assert.equal(r.rows.length,0);assert.equal(r.failures[0].reason,'Kickoff outside forecast horizon');
});
test('games after kickoff are not backfilled with future weather',async()=>{
 const r=await collectStadiumWeather([game],{asOf:'2026-11-23T00:00:00Z',fetchImpl:()=>{throw Error('should not fetch');}});
 assert.equal(r.rows.length,0);assert.equal(r.failures[0].reason,'kickoff_not_future');
});
