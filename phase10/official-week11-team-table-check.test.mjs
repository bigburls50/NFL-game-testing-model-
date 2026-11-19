import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptGameFeeds} from './game-feed-acceptance.mjs';
// Cross-checked against official NFL Week 11 injury page, November 19, 2026.
// The NFL page does not expose a verifiable per-team publication timestamp.
// Source: https://www.nfl.com/injuries/
const game={game_id:'2026_11_IND_HOU',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
const observed={
 IND:{count:11,out:['Will Mallory','Bernhard Raimann','Jerry Tillery','Jalen Travis','Charvarius Ward'],questionable:['Sauce Gardner','Anthony Gould','Charlie Heck','Luke Rhodes']},
 HOU:{count:15,out:['Marvin Harrison Jr.','Danielle Hunter','Brevin Jordan','Woody Marks'],questionable:['Jacob Hummel','Jaylin Smith','Wyatt Teller']}
};
test('both real official injury team sections have internally consistent final statuses',()=>{
 for(const [team,x] of Object.entries(observed)){
  assert.ok(x.count>=x.out.length+x.questionable.length,team);
  assert.equal(new Set([...x.out,...x.questionable]).size,x.out.length+x.questionable.length);
 }
 assert.equal(observed.IND.count,11);
 assert.equal(observed.HOU.count,15);
});
test('real injury rows without independently verified publication timestamps cannot pass the gate',()=>{
 const injuryReports=Object.entries(observed).map(([team,x])=>({game_id:game.game_id,team,source_url:'https://www.nfl.com/injuries/',source_type:'official_team_or_league',players:[...x.out.map(player_name=>({player_name,injury:'unverified',practice_status:'unverified'})),...x.questionable.map(player_name=>({player_name,injury:'unverified',practice_status:'unverified'}))],published_at_utc:null,retrieved_at_utc:'2026-11-19T12:00:00Z',complete_report:false,source_digest:null}));
 const result=acceptGameFeeds([game],{starterReports:[],injuryReports,asOf:'2026-11-19T12:00:00Z'});
 assert.equal(result.games[0].decision,'abstain');
 assert.deepEqual(result.games[0].reasons,['home_qb_unconfirmed','away_qb_unconfirmed','home_injury_report_unverified','away_injury_report_unverified']);
});
