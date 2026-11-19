import test from 'node:test';
import assert from 'node:assert/strict';
import {calibration} from './calibration-diagnostics.mjs';
const row=(id,p,h=20,a=10)=>({game_id:id,home_win_probability:p,home_score:h,away_score:a});
test('fixed bins, Brier, selection coverage and Wilson uncertainty',()=>{
 const r=calibration([row('a',.8),row('b',.2,10,20),row('c',.6,10,20)]);
 assert.equal(r.games,3);assert.equal(r.high_confidence_games,2);assert.equal(r.high_confidence_accuracy,1);
 assert.equal(r.high_confidence_coverage,2/3);assert.equal(r.accuracy,2/3);
 assert.equal(r.calibration.reduce((n,b)=>n+b.count,0),3);
 assert.ok(r.expected_calibration_error>=0&&r.expected_calibration_error<=1);
 assert.ok(r.high_confidence_95ci.lower<1);
 assert.ok(Math.abs(r.brier-(.04+.04+.36)/3)<1e-12);
});
test('reject duplicates, malformed probabilities and missing observations',()=>{
 assert.throws(()=>calibration([]),/No predictions/);
 assert.throws(()=>calibration([row('a',.7),row('a',.6)]),/duplicate/);
 assert.throws(()=>calibration([row('a',1)]),/Invalid/);
 assert.throws(()=>calibration([row('a','NaN')]),/Invalid/);
 assert.throws(()=>calibration([row('a',.7,10,10)]),/Invalid/);
 assert.throws(()=>calibration([row('a',.7)],{bins:1}),/settings/);
});
