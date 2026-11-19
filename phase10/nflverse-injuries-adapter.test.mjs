import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchNflverseInjuries,injuryCandidates} from './nflverse-injuries-adapter.mjs';
test('nflverse injury adapter filters week and teams and preserves unknown game status',async()=>{
 const csv='team,week,gsis_id,full_name,report_status,practice_status,date_modified\nBUF,11,00-1,Player One,Questionable,LP,2026-11-18\nMIA,10,00-2,Player Two,Out,DNP,2026-11-10\n';
 const source=await fetchNflverseInjuries(2026,{fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from(csv)})});
 const rows=injuryCandidates(source,11,['BUF','MIA']);
 assert.equal(rows.length,1);assert.equal(rows[0].game_status,'Questionable');assert.equal(rows[0].practice_status,'LP');assert.match(source.source_digest,/^sha256:[a-f0-9]{64}$/);
});
test('nflverse injury adapter fails closed on missing columns',async()=>{
 await assert.rejects(fetchNflverseInjuries(2026,{fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from('bad,column\na,b\n')})}),/schema/);
});
