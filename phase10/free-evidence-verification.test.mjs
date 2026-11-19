import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyOfficialRosterCandidates} from './official-roster-verification.mjs';
import {certifyOfficialInjuryReport} from './certify-official-injury-report.mjs';
const game={game_id:'2026_11_IND_HOU',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
test('official roster requires independent source and does not designate a starter',()=>{
 const p={team:'IND',position:'QB',player_id:'00-0031234',player_name:'Example QB'};
 const opts={team:'IND',sourceUrl:'https://www.colts.com/team/players-roster/',retrievedAt:'2026-11-19T20:00:00Z',sourceDigest:'sha256:abc'};
 const r=verifyOfficialRosterCandidates([p],[{team:'IND',position:'QB',player_name:'Example QB'}],opts);
 assert.equal(r.verified,true);assert.equal(r.confirmed_starter,undefined);
 assert.equal(verifyOfficialRosterCandidates([p],[],opts).verified,false);
});
test('injury publication and complete report must be independently certified',()=>{
 const base={game,team:'IND',players:[{player_name:'Example',injury:'Knee',practice_status:'Full',game_status:'Questionable'}],sourceUrl:'https://www.nfl.com/injuries/',sourceDigest:'sha256:abc',retrievedAt:'2026-11-19T20:00:00Z',teamSectionVerified:true,gameSectionVerified:true,reportDateVerified:true,completeReportVerified:true};
 assert.equal(certifyOfficialInjuryReport(base).verified,false);
 assert.equal(certifyOfficialInjuryReport({...base,publishedAt:'2026-11-19T19:00:00Z'}).verified,true);
 assert.equal(certifyOfficialInjuryReport({...base,publishedAt:'2026-11-20T20:00:00Z'}).verified,false);
});
