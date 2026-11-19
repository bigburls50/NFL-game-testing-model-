import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptGameFeeds} from './game-feed-acceptance.mjs';
// Real game and source facts (Nov 18 2026), not simulated player confirmations.
const game={game_id:'2026_11_IND_HOU',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
const reports=['IND','HOU'].map(team=>({
 game_id:game.game_id,team,source_type:'official_team_or_league',
 source_url:'https://www.nfl.com/injuries/league/2026/reg11',
 published_at_utc:null,retrieved_at_utc:'2026-11-19T03:00:00Z',
 players:[],complete_report:false,team_section_verified:true,
 game_section_verified:true,report_date_verified:false,
 evidence_note:'NFL live Week 11 team player table exists; report timestamp and complete game-specific record not independently established.'
}));
test('real Colts Texans injury observations do not bypass four-input acceptance',()=>{
 const audit=acceptGameFeeds([game],{starterReports:[],injuryReports:reports,asOf:'2026-11-19T03:30:00Z'});
 assert.equal(audit.games[0].decision,'abstain');
 assert.deepEqual(audit.games[0].reasons,[
 'home_qb_unconfirmed','away_qb_unconfirmed','home_injury_report_unverified','away_injury_report_unverified'
 ]);
});
