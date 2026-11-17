import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalPrediction,verifyCommitments} from './verify-commitments.mjs';
const row={game_id:'g1',kickoff_utc:'2026-11-20T18:00:00Z',prediction_locked_utc:'2026-11-20T16:00:00Z',model_version:'v1',home_team:'A',away_team:'B',home_win_probability:'0.6'};
const hash=createHash('sha256').update(canonicalPrediction(row)).digest('hex');
const signed={...row,prediction_sha256:hash};
const manifest={commitments:[{game_id:'g1',sha256:hash,published_at_utc:'2026-11-20T16:01:00Z'}]};
const opts={now:Date.parse('2026-11-21T00:00:00Z')};
test('matching canonical commitment verifies integrity',()=>assert.equal(verifyCommitments([signed],manifest,opts).ready,true));
test('modified prediction is rejected',()=>assert.equal(verifyCommitments([{...signed,home_win_probability:'0.7'}],manifest,opts).ready,false));
test('late publication claim is rejected',()=>assert.equal(verifyCommitments([signed],{commitments:[{...manifest.commitments[0],published_at_utc:'2026-11-20T19:00:00Z'}]},opts).ready,false));
test('missing or duplicate commitments rejected',()=>{
 assert.equal(verifyCommitments([signed],{},opts).ready,false);
 assert.equal(verifyCommitments([signed],{commitments:[...manifest.commitments,...manifest.commitments]},opts).ready,false);
});
test('extra commitment is rejected',()=>assert.equal(verifyCommitments([signed],{commitments:[...manifest.commitments,{game_id:'other',sha256:hash,published_at_utc:'2026-11-20T16:00:00Z'}]},opts).ready,false));
test('ambiguous timezone format rejected',()=>assert.throws(()=>canonicalPrediction({...row,kickoff_utc:'2026-11-20 18:00'})));

test('valid fractional-second UTC timestamps are canonicalized and verified',()=>{
 const fractional={...row,kickoff_utc:'2026-11-20T18:00:00.125Z',prediction_locked_utc:'2026-11-20T16:00:00.025Z'};
 const digest=createHash('sha256').update(canonicalPrediction(fractional)).digest('hex');
 const result=verifyCommitments([{...fractional,prediction_sha256:digest}],{commitments:[{game_id:'g1',sha256:digest,published_at_utc:'2026-11-20T16:01:00Z'}]},opts);
 assert.equal(result.ready,true,JSON.stringify(result.issues));
});
test('invalid UTC fractional precision and timezone are rejected',()=>{
 assert.throws(()=>canonicalPrediction({...row,kickoff_utc:'2026-11-20T18:00:00.1234Z'}));
 assert.throws(()=>canonicalPrediction({...row,prediction_locked_utc:'2026-11-20T16:00:00+00:00'}));
});

test('rejects impossible calendar dates rather than normalizing them',()=>{
 assert.throws(()=>canonicalPrediction({...row,kickoff_utc:'2026-02-30T18:00:00Z'}));
 assert.throws(()=>canonicalPrediction({...row,prediction_locked_utc:'2026-13-20T16:00:00Z'}));
});
test('rejects manifest publication before prediction lock',()=>{
 const changed={commitments:[{...manifest.commitments[0],published_at_utc:'2026-11-20T15:59:59Z'}]};
 assert.equal(verifyCommitments([signed],changed,opts).ready,false);
});
test('rejects future-dated and malformed manifest publication',()=>{
 assert.equal(verifyCommitments([signed],manifest,{now:Date.parse('2026-11-20T15:00:00Z')}).ready,false);
 assert.equal(verifyCommitments([signed],{commitments:[{...manifest.commitments[0],published_at_utc:'2026-11-20 16:01:00'}]},opts).ready,false);
});
