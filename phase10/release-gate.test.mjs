import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseGate} from './release-gate.mjs';
const report={threshold:.75,games:1000,accuracy:.65,brier:.22,log_loss:.63,high_confidence_games:150,high_confidence_coverage:.15,high_confidence_accuracy:.83,high_confidence_95ci:{lower:.77,upper:.89}};
const evidence={prospective:true,point_in_time_features:true,no_test_season_tuning:true,android_pwa_verified:true,ci_passed:true};
test('valid independent evidence clears research gate',()=>assert.equal(releaseGate(report,evidence).ready,true));
test('historical 25/26 at 3% coverage cannot pass',()=>{
 const r=releaseGate({...report,games:854,high_confidence_games:26,high_confidence_coverage:26/854,high_confidence_accuracy:25/26,high_confidence_95ci:{lower:.81,upper:.99}},{});
 assert.equal(r.ready,false);assert.ok(r.issues.length>=4);
});
test('missing prospective evidence fails closed',()=>assert.equal(releaseGate(report,{}).ready,false));
test('lower confidence bound below target fails',()=>assert.equal(releaseGate({...report,high_confidence_95ci:{lower:.70,upper:.90}},evidence).ready,false));
test('inconsistent coverage and invalid metrics fail',()=>{
 assert.equal(releaseGate({...report,high_confidence_coverage:.20},evidence).ready,false);
 assert.equal(releaseGate({...report,brier:NaN},evidence).ready,false);
});

test('missing metrics and threshold changes cannot pass',()=>{
 assert.equal(releaseGate({...report,accuracy:null},evidence).ready,false);
 assert.equal(releaseGate({...report,high_confidence_accuracy:null},evidence).ready,false);
 assert.equal(releaseGate({...report,threshold:.70},evidence).ready,false);
});
