import test from 'node:test';import assert from 'node:assert/strict';
import {extractOfficialInjuryTables} from './official-injury-table-extractor.mjs';
import {fetchVerifiedRosterIds} from './verified-roster-id-feed.mjs';
test('extract complete injury player table without inventing official publication timestamp',()=>{
 const html='<table><tr><th>Player</th><th>Pos</th><th>Injury</th><th>Game Status</th></tr><tr><td>Sample Player</td><td>QB</td><td>Knee</td><td>Questionable</td></tr></table>';
 const result=extractOfficialInjuryTables(html);
 assert.equal(result.tables.length,1);assert.equal(result.tables[0].players[0].game_status,'Questionable');assert.equal(result.tables[0].report_published_at_utc,null);
});
test('reject missing injury status columns',()=>{assert.equal(extractOfficialInjuryTables('<table><tr><th>Player</th><th>Injury</th></tr><tr><td>A</td><td>Knee</td></tr></table>').tables.length,0);});
test('verified roster feed rejects untrusted URL',async()=>{await assert.rejects(fetchVerifiedRosterIds({url:'https://example.com/players.csv'}),/untrusted_roster_url/);});
