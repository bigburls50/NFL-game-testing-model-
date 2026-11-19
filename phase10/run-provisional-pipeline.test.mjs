import test from 'node:test';
import assert from 'node:assert/strict';
import {runProvisionalPipeline} from './run-provisional-pipeline.mjs';

test('feed failure remains an explicit abstention with per-feed diagnostics',async()=>{
 const manifest={season:2026,week:11,games:[{game_id:'g1',home_team:'HOU',away_team:'IND'}]};
 const historicalGames=Array.from({length:100},(_,i)=>({game_id:'past-'+i,season:2025,home_score:21,away_score:14}));
 const fail=async()=>{throw Error('fixture feed unavailable');};
 const result=await runProvisionalPipeline(manifest,{historicalGames,rosterFetch:fail,depthFetch:fail,injuryFetch:fail});
 assert.equal(result.status,'integration_blocked_on_normalized_collector_evidence');
 assert.equal(result.games[0].status,'abstain');
 assert.ok(result.games[0].reasons.includes('pregame_collector_unavailable'));
 for(const feed of ['roster','depth_chart','injuries'])assert.ok(result.games[0].reasons.includes('feed_'+feed+'_unavailable'));
 assert.equal(result.games[0].home_win_probability,undefined);
});
