import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSportradarWeeklyInjuries,fetchSportradarWeeklyInjuries} from './sportradar-weekly-injuries.mjs';
test('missing API key fails closed without network access',async()=>{
 const result=await fetchSportradarWeeklyInjuries({season:2026,week:11,apiKey:''});
 assert.equal(result.available,false);assert.equal(result.verified_final_reports,0);
});
test('structured injuries preserve status timestamp without asserting report publication',()=>{
 const data={season:{year:2026},week:{sequence:11},teams:[{alias:'IND',players:[{id:'provider-1',name:'Example QB',position:'QB',injury:{primary:'Ankle',status:'Questionable',status_date:'2026-11-18T20:00:00Z',practice:{status:'Limited Participation'}}}]}]};
 const teams=parseSportradarWeeklyInjuries(data,{season:2026,week:11});
 assert.equal(teams[0].players[0].game_status,'Questionable');
 assert.equal(teams[0].players[0].status_updated_at_utc,'2026-11-18T20:00:00Z');
 assert.equal(teams[0].players[0].published_at_utc,undefined);
 assert.throws(()=>parseSportradarWeeklyInjuries(data,{season:2026,week:12}),/week_mismatch/);
});
