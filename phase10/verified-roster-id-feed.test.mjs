import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchVerifiedRosterIds} from './verified-roster-id-feed.mjs';

test('verified roster parser accepts GSIS identifiers and rejects malformed IDs', async () => {
 const csv='gsis_id,display_name,latest_team\n00-1234567,Example Quarterback,HOU\nnot-a-gsis-id,Other Player,IND\n';
 const fetchImpl=async ()=>({ok:true,arrayBuffer:async()=>Buffer.from(csv)});
 const result=await fetchVerifiedRosterIds({fetchImpl});
 assert.deepEqual(result.players,[{player_id:'00-1234567',player_name:'Example Quarterback',team:'HOU'}]);
 assert.match(result.source_digest,/^sha256:[a-f0-9]{64}$/);
});

test('roster parser rejects duplicate GSIS identifiers', async () => {
 const csv='gsis_id,display_name,latest_team\n00-1234567,Example Quarterback,HOU\n00-1234567,Duplicate,IND\n';
 const fetchImpl=async()=>({ok:true,arrayBuffer:async()=>Buffer.from(csv)});
 await assert.rejects(fetchVerifiedRosterIds({fetchImpl}),/Duplicate GSIS identifiers/);
});

test('verified nflverse position is preserved for starter validation',async()=>{
 const csv='gsis_id,display_name,latest_team,position\n00-1234567,Example Quarterback,HOU,QB\n00-1234568,Example Receiver,HOU,WR\n';
 const fetchImpl=async()=>({ok:true,arrayBuffer:async()=>Buffer.from(csv)});
 const result=await fetchVerifiedRosterIds({fetchImpl});
 assert.deepEqual(result.players.map(p=>p.position),['QB','WR']);
});
