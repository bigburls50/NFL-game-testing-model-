import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOfficialInjuryTables} from './official-injury-table-extractor.mjs';
test('real NFL injuries/practice status/game status headings parse without treating practice status as final status',()=>{
 const html='<table><tr><th>Player</th><th>Position</th><th>Injuries</th><th>Practice Status</th><th>Game Status</th></tr><tr><td>Example Player</td><td>QB</td><td>Shoulder</td><td>LP</td><td>Questionable</td></tr></table>';
 const result=extractOfficialInjuryTables(html);
 assert.equal(result.tables.length,1);
 assert.equal(result.tables[0].players[0].game_status,'Questionable');
 assert.equal(result.tables[0].players[0].practice_status,'LP');
 assert.equal(result.tables[0].report_published_at_utc,null);
});
