import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {acceptGameFeeds} from './game-feed-acceptance.mjs';
const evidence=JSON.parse(fs.readFileSync('phase10/data/colts-texans-source-provenance-2026-11-19.json','utf8'));
const game={game_id:evidence.game_id,away_team:'IND',home_team:'HOU',kickoff_utc:'2026-11-20T01:15:00Z'};
test('real published timestamps do not substitute for verified player IDs or complete final team injury reports',()=>{
 assert.equal(evidence.sources.length,4);
 assert.ok(evidence.sources.every(s=>Number.isFinite(Date.parse(s.published_at))));
 assert.ok(evidence.sources.every(s=>s.accepted===false));
 assert.equal(evidence.sources.filter(s=>s.kind==='starter'&&s.verified_roster_id).length,0);
 const audit=acceptGameFeeds([game],{starterReports:[],injuryReports:[],asOf:evidence.as_of_utc});
 assert.equal(audit.games[0].decision,'abstain');
 assert.deepEqual(audit.games[0].reasons,['home_qb_unconfirmed','away_qb_unconfirmed','home_injury_report_unverified','away_injury_report_unverified']);
});
