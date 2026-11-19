#!/usr/bin/env node
// Point-in-time feature regression: no same-day results or future game EPA.
import assert from 'node:assert/strict';
import {rollingEpa} from './rolling-epa.mjs';
const games=[
 {game_id:'g3',gameday:'2025-09-15',season:2025,home_team:'A',away_team:'D'},
 {game_id:'g2',gameday:'2025-09-08',season:2025,home_team:'A',away_team:'C'},
 {game_id:'g1',gameday:'2025-09-08',season:2025,home_team:'A',away_team:'B'}
];
const teamGames=[
 {game_id:'g1',team:'A',offense_epa_per_play:10,qb_epa_per_dropback:11},
 {game_id:'g1',team:'B',offense_epa_per_play:-2,qb_epa_per_dropback:-3},
 {game_id:'g2',team:'A',offense_epa_per_play:20,qb_epa_per_dropback:21},
 {game_id:'g2',team:'C',offense_epa_per_play:-4,qb_epa_per_dropback:-5},
 {game_id:'g3',team:'A',offense_epa_per_play:1000,qb_epa_per_dropback:1000},
 {game_id:'g3',team:'D',offense_epa_per_play:1000,qb_epa_per_dropback:1000}
];
const rows=rollingEpa(games,teamGames),byId=Object.fromEntries(rows.map(r=>[r.game_id,r]));
assert.equal(byId.g1.home_prior_games,0);
assert.equal(byId.g2.home_prior_games,0);
assert.equal(byId.g1.home_qb_epa_per_dropback,'');
assert.equal(byId.g2.home_qb_epa_per_dropback,'');
assert.equal(byId.g3.home_prior_games,2);
assert.equal(byId.g3.home_qb_epa_per_dropback,16);
assert.equal(byId.g3.home_offense_epa_per_play,15);
assert.deepEqual(rollingEpa([...games].reverse(),[...teamGames].reverse()),rows);
assert.throws(()=>rollingEpa([...games,games[0]],teamGames),/Duplicate game/);
assert.throws(()=>rollingEpa(games,[...teamGames,teamGames[0]]),/Duplicate team-game/);
assert.throws(()=>rollingEpa(games,teamGames,{lookback:0}),/Invalid lookback/);
console.log('pregame EPA same-day and future leakage regression checks passed');
