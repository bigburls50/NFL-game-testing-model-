import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './evaluate.mjs';

const game = (id, p, home, away, kickoff='2025-09-08T00:00:00Z', created='2025-09-07T00:00:00Z') => ({
  game_id:id, kickoff_utc:kickoff, prediction_created_utc:created,
  home_team:'Home',away_team:'Away',home_score:String(home),away_score:String(away),
  home_win_probability:String(p)
});

test('perfect predictions and baseline metrics', () => {
 const r=evaluate([game('1',.8,24,10),game('2',.2,7,14)]);
 assert.equal(r.n,2);
 assert.equal(r.accuracy,1);
 assert.equal(r.always_home_accuracy,.5);
 assert.ok(Math.abs(r.brier-.04)<1e-12);
 assert.ok(Math.abs(r.log_loss+Math.log(.8))<1e-12);
 assert.equal(r.calibration.reduce((s,b)=>s+b.n,0),2);
});
test('rejects late predictions, ties, duplicates, missing and invalid inputs',()=>{
 const r=evaluate([
 game('valid',.6,21,10),
 game('late',.6,21,10,'2025-09-08T00:00:00Z','2025-09-08T00:00:00Z'),
 game('tie',.6,10,10),
 game('valid',.7,17,10),
 {...game('missing',.6,21,10),home_team:''},
 game('invalid',1.2,21,10)
 ]);
 assert.equal(r.n,1);
 assert.deepEqual(r.excluded,{missing:1,invalid:1,late:1,tie:1,duplicate:1});
});
test('no eligible rows returns an explicit error',()=>{
 const r=evaluate([game('late',.7,20,10,'2025-09-08T00:00:00Z','2025-09-09T00:00:00Z')]);
 assert.equal(r.n,0);
 assert.match(r.error,/No eligible/);
});
test('numeric score validation excludes malformed results',()=>{
 const r=evaluate([game('bad',.6,'not-a-score',7)]);
 assert.equal(r.excluded.invalid,1);
});
