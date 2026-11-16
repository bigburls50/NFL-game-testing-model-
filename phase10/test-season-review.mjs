#!/usr/bin/env node
// Regression tests for season-level evaluation. No external services or paid data.
import assert from 'node:assert/strict';
import {audit,wilson} from './season-compare.mjs';

const row=(id,season,p,home=24,away=17)=>({
  game_id:id,season:String(season),home_team:'AAA',away_team:'BBB',
  home_score:String(home),away_score:String(away),home_win_probability:String(p)
});
const baseline=[row('g1',2023,.8),row('g2',2023,.3,10,21),row('g3',2024,.6)];
const epa=[row('g1',2023,.7),row('g2',2023,.2,10,21),row('g3',2024,.9)];
const result=audit({baseline,epa});
assert.equal(result.common_games,3);
assert.equal(result.seasons['2023'].baseline.games,2);
assert.equal(result.seasons['2024'].epa.games,1);
assert.equal(result.seasons['2023'].baseline.high_confidence_games,1);
assert.equal(result.seasons['2023'].epa.high_confidence_games,1);
assert.equal(result.seasons['2023'].baseline.accuracy,1);
assert.equal(result.seasons['2023'].epa.accuracy,1);
assert.equal(result.seasons['2024'].epa.high_confidence_coverage,1);
assert.equal(wilson(0,0),null);
assert.ok(wilson(1,1).lower>0 && wilson(1,1).lower<.5);
assert.ok(wilson(1,1).upper<=1);
assert.throws(()=>audit({baseline,epa:[...epa,epa[0]]}),/Duplicate/);
assert.throws(()=>audit({baseline,epa:epa.map((r,i)=>i===0?{...r,home_score:'99'}:r)}),/metadata mismatch/);
assert.throws(()=>audit({baseline,epa:epa.map((r,i)=>i===0?{...r,home_win_probability:'1.2'}:r)}),/Invalid result/);
assert.throws(()=>audit({baseline,epa},.5),/Invalid threshold/);
assert.throws(()=>audit({baseline,epa:[]}),/No overlapping games/);
console.log('season audit regression checks passed');
