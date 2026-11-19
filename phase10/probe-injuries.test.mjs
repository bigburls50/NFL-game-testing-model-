import test from 'node:test';
import assert from 'node:assert/strict';
import {probeInjurySource} from './probe-injuries.mjs';
const manifest={schedule_verified:true,season:2026,week:11,games:[{game_id:'g',home_team:'BUF',away_team:'MIA'}]};
const csv='team,week,gsis_id,full_name,report_status,practice_status,date_modified\nBUF,11,id1,Example Player,Out,DNP,2026-11-18\n';
test('source probe does not equate missing team report with healthy roster',async()=>{
 const r=await probeInjurySource(manifest,{fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from(csv)})});
 assert.equal(r.status,'incomplete');assert.deepEqual(r.teams_without_candidate_rows,['MIA']);assert.equal(r.ready_for_forecast,false);
});
test('provider outage is surfaced without inventing injury statuses',async()=>{
 const r=await probeInjurySource(manifest,{fetchImpl:async()=>({ok:false,status:404})});
 assert.equal(r.status,'unavailable');assert.equal(r.ready_for_forecast,false);
});
