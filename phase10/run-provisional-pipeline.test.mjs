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

test('non-Error feed rejection fails closed rather than crashing pipeline',async()=>{
 const manifest={season:2026,week:11,games:[{game_id:'g1',home_team:'HOU',away_team:'IND'}]};
 const historicalGames=Array.from({length:100},(_,i)=>({game_id:'past-'+i,season:2025,home_score:21,away_score:14}));
 const result=await runProvisionalPipeline(manifest,{historicalGames,rosterFetch:async()=>{throw null;},depthFetch:async()=>{throw 'offline';},injuryFetch:async()=>{throw {code:'offline'};}});
 assert.equal(result.games[0].status,'abstain');
 assert.equal(result.games[0].home_win_probability,undefined);
 for(const feed of ['roster','depth_chart','injuries'])assert.ok(result.games[0].reasons.includes('feed_'+feed+'_unavailable'));
});

test('successful preliminary feeds still cannot authorize a forecast',async()=>{
 const manifest={season:2026,week:11,games:[{game_id:'g1',home_team:'HOU',away_team:'IND'}]};
 const historicalGames=Array.from({length:100},(_,i)=>({game_id:'past-'+i,season:2025,home_score:21,away_score:14}));
 const rosterFetch=async()=>({players:[],source_url:'https://example.test/roster',source_digest:'fixture'});
 const depthFetch=async()=>({rows:[],source_url:'https://example.test/depth',source_digest:'fixture',columns:[]});
 const injuryFetch=async()=>({rows:[],source_url:'https://example.test/injuries',source_digest:'fixture'});
 const result=await runProvisionalPipeline(manifest,{historicalGames,rosterFetch,depthFetch,injuryFetch});
 assert.equal(result.games[0].status,'abstain');
 assert.equal(result.games[0].home_win_probability,undefined);
 assert.ok(result.games[0].reasons.includes('collector_does_not_expose_normalized_evidence'));
});

test('collector provenance is exposed for audit without enabling a forecast',async()=>{
 const manifest={season:2026,week:11,games:[{game_id:'g1',home_team:'HOU',away_team:'IND'}]};
 const historicalGames=Array.from({length:100},(_,i)=>({game_id:'past-'+i,season:2025,home_score:21,away_score:14}));
 const rosterFetch=async()=>({players:[],source_url:'https://github.com/nflverse/rosters',source_digest:'roster-fixture'});
 const depthFetch=async()=>({rows:[],source_url:'https://github.com/nflverse/depth',source_digest:'depth-fixture',columns:[]});
 const injuryFetch=async()=>({rows:[],source_url:'https://github.com/nflverse/injuries',source_digest:'injury-fixture'});
 const result=await runProvisionalPipeline(manifest,{historicalGames,rosterFetch,depthFetch,injuryFetch,asOf:'2026-11-19T21:00:00Z'});
 assert.equal(result.snapshot_checked_at_utc,'2026-11-19T21:00:00Z');
 assert.equal(result.source_provenance.roster.digest,'roster-fixture');
 assert.equal(result.source_provenance.injuries.digest,'injury-fixture');
 assert.deepEqual(result.feed_errors,[]);
 assert.equal(result.games[0].status,'abstain');
 assert.equal(result.games[0].home_win_probability,undefined);
});
test('failed feeds retain audit errors without leaking a probability',async()=>{
 const manifest={season:2026,week:11,games:[{game_id:'g1',home_team:'HOU',away_team:'IND'}]};
 const historicalGames=Array.from({length:100},(_,i)=>({game_id:'past-'+i,season:2025,home_score:21,away_score:14}));
 const fail=async()=>{throw Error('fixture unavailable');};
 const result=await runProvisionalPipeline(manifest,{historicalGames,rosterFetch:fail,depthFetch:fail,injuryFetch:fail});
 assert.equal(result.feed_errors.length,3);
 assert.equal(result.source_provenance,null);
 assert.equal(result.games[0].status,'abstain');
 assert.equal(result.games[0].home_win_probability,undefined);
});
