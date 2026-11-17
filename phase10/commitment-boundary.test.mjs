import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalPrediction,verifyCommitments} from './verify-commitments.mjs';

const row={game_id:'boundary-1',kickoff_utc:'2026-11-20T18:00:00.000Z',prediction_locked_utc:'2026-11-20T17:00:00.000Z',model_version:'v1',home_team:'A',away_team:'B',home_win_probability:'0.6'};
const sha256=createHash('sha256').update(canonicalPrediction(row)).digest('hex');
const signed={...row,prediction_sha256:sha256};
const entry={game_id:row.game_id,sha256,published_at_utc:'2026-11-20T17:59:59.999Z'};
const now=Date.parse('2026-11-21T00:00:00Z');

test('publication one millisecond before kickoff passes integrity checks but is not prospectively verified',()=>{
 const report=verifyCommitments([signed],{commitments:[entry]},{now});
 assert.equal(report.ready,true,JSON.stringify(report.issues));
 assert.equal(report.prospective_verified,false);
});
test('publication exactly at kickoff is rejected',()=>{
 const report=verifyCommitments([signed],{commitments:[{...entry,published_at_utc:row.kickoff_utc}]},{now});
 assert.equal(report.ready,false);
});
test('tampered team identity fails the original commitment',()=>{
 const report=verifyCommitments([{...signed,away_team:'C'}],{commitments:[entry]},{now});
 assert.equal(report.ready,false);
});
test('empty prediction ledger cannot pass commitment validation',()=>{
 const report=verifyCommitments([],{commitments:[]},{now});
 assert.equal(report.ready,false);
 assert.equal(report.prospective_verified,false);
});
