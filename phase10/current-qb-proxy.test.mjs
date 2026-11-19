import test from 'node:test';
import assert from 'node:assert/strict';
import {priorTeamQbProxy} from './current-qb-proxy.mjs';
const games=[{game_id:'past',gameday:'2026-11-10',home_score:'21',away_score:'17'},{game_id:'future',gameday:'2026-11-23',home_score:'35',away_score:'21'},{game_id:'incomplete',gameday:'2026-11-12',home_score:'',away_score:''}];
const stats=[{game_id:'past',team:'BUF',qb_epa_per_dropback:.25,qb_dropbacks:100},{game_id:'future',team:'BUF',qb_epa_per_dropback:9,qb_dropbacks:100},{game_id:'incomplete',team:'BUF',qb_epa_per_dropback:8,qb_dropbacks:100}];
const fixture=[{game_id:'upcoming',home_team:'BUF',away_team:'MIA',kickoff_utc:'2026-11-22T18:00:00Z'}];
test('current team QB proxy excludes future and incomplete games',()=>{
 const rows=priorTeamQbProxy(stats,games,fixture);
 assert.equal(rows[0].prior_games,1);assert.equal(rows[0].prior_team_dropback_epa,.25);
 assert.equal(rows[0].eligible_for_starter_gate,false);assert.equal(rows[1].prior_team_dropback_epa,null);
});
test('insufficient historical dropbacks abstains',()=>{
 const rows=priorTeamQbProxy(stats,games,fixture,{minDropbacks:101});
 assert.equal(rows[0].prior_team_dropback_epa,null);
});
test('future game result cannot alter pregame proxy',()=>{
 const baseline=priorTeamQbProxy(stats,games,fixture);
 const manipulated=priorTeamQbProxy([...stats,{game_id:'future',team:'MIA',qb_epa_per_dropback:100,qb_dropbacks:200}],games,fixture);
 assert.deepEqual(manipulated,baseline);
});
