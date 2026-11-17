import test from 'node:test';
import assert from 'node:assert/strict';
import {pregameRest} from './pregame-rest.mjs';
const games=[
 {game_id:'g1',season:2025,gameday:'2025-09-01',home_team:'A',away_team:'B'},
 {game_id:'g2',season:2025,gameday:'2025-09-01',home_team:'C',away_team:'D'},
 {game_id:'g3',season:2025,gameday:'2025-09-08',home_team:'A',away_team:'C'},
 {game_id:'g4',season:2025,gameday:'2025-09-11',home_team:'B',away_team:'D'}
];
test('rest uses only earlier dates and excludes game day',()=>{
 const r=pregameRest([...games].reverse());
 assert.equal(r[0].home_rest_days,'');
 assert.equal(r[2].home_rest_days,6);
 assert.equal(r[2].away_rest_days,6);
 assert.equal(r[2].rest_days_edge,0);
 assert.equal(r[3].home_rest_days,9);
});
test('outcomes and future games cannot change prior rest features',()=>{
 const a=pregameRest(games);
 const b=pregameRest([...games,{game_id:'future',season:2025,gameday:'2025-09-20',home_team:'A',away_team:'B'}].map(x=>({...x,home_score:999,away_score:0})));
 assert.deepEqual(b.slice(0,a.length),a);
});
test('same-date double-booked team is rejected',()=>assert.throws(()=>pregameRest([...games,{game_id:'bad',season:2025,gameday:'2025-09-01',home_team:'A',away_team:'Z'}]),/twice/));
test('invalid date and duplicate game are rejected',()=>{
 assert.throws(()=>pregameRest([{...games[0],gameday:'2025-02-30'}]),/date/);
 assert.throws(()=>pregameRest([games[0],games[0]]),/duplicate/);
});
test('offseason is not counted as in-season rest',()=>{
 const r=pregameRest([{...games[0],season:2024,gameday:'2024-12-20'}, {...games[2],season:2025,gameday:'2025-09-01'}]);
 assert.equal(r[1].home_rest_days,'');
 assert.equal(r[1].away_rest_days,'');
 assert.equal(r[1].rest_days_edge,'');
});
test('rest resumes after a game in the new season',()=>{
 const r=pregameRest([{...games[0],season:2024,gameday:'2024-12-20'}, {...games[2],season:2025,gameday:'2025-09-01'}, {game_id:'new',season:2025,gameday:'2025-09-08',home_team:'A',away_team:'C'}]);
 assert.equal(r[2].home_rest_days,6);
 assert.equal(r[2].away_rest_days,6);
});

test('missing, nonnumeric, and inconsistent season metadata fail closed',()=>{
 assert.throws(()=>pregameRest([{...games[0],season:undefined}]),/season/);
 assert.throws(()=>pregameRest([{...games[0],season:'not-a-year'}]),/season/);
 assert.throws(()=>pregameRest([{...games[0],season:2024}]),/outside NFL season window/);
});
test('January playoff games belong to the preceding NFL season',()=>{
 const r=pregameRest([
  {game_id:'dec',season:2025,gameday:'2025-12-28',home_team:'A',away_team:'B'},
  {game_id:'jan',season:2025,gameday:'2026-01-04',home_team:'A',away_team:'B'}
 ]);
 assert.equal(r[1].home_rest_days,6);
 assert.equal(r[1].away_rest_days,6);
});

test('rejects spring and summer dates mislabelled as NFL regular-season games',()=>{
 for(const gameday of ['2025-01-15','2025-07-31','2026-03-01','2026-12-01']){
  assert.throws(()=>pregameRest([{...games[0],gameday}]),/season window/,gameday);
 }
});
test('accepts February postseason and August season dates',()=>{
 const r=pregameRest([
  {game_id:'aug',season:2025,gameday:'2025-08-30',home_team:'A',away_team:'B'},
  {game_id:'feb',season:2025,gameday:'2026-02-01',home_team:'A',away_team:'B'}
 ]);
 assert.equal(r[1].home_rest_days,'');\n assert.equal(r[1].away_rest_days,'');
});

test('short-rest flags use five or fewer full days and retain direction of rest edge',()=>{
 const r=pregameRest([
  {game_id:'a1',season:2025,gameday:'2025-09-01',home_team:'A',away_team:'B'},
  {game_id:'c1',season:2025,gameday:'2025-09-03',home_team:'C',away_team:'D'},
  {game_id:'a2',season:2025,gameday:'2025-09-08',home_team:'A',away_team:'C'},
  {game_id:'b2',season:2025,gameday:'2025-09-08',home_team:'D',away_team:'B'}
 ]);
 const a=r.find(x=>x.game_id==='a2'),b=r.find(x=>x.game_id==='b2');
 assert.equal(a.home_rest_days,6);
 assert.equal(a.away_rest_days,4);
 assert.equal(a.rest_days_edge,2);
 assert.equal(a.home_short_rest,0);
 assert.equal(a.away_short_rest,1);
 assert.equal(b.rest_days_edge,-2);
 assert.equal(b.home_short_rest,1);
 assert.equal(b.away_short_rest,0);
});
test('rest outputs are invariant to input ordering and outcome fields',()=>{
 const canonical=pregameRest(games);
 const shuffled=pregameRest([...games].reverse().map(g=>({...g,home_score:100,away_score:0})));
 assert.deepEqual(shuffled,canonical);
});

test('long gaps are unknown, but normal bye weeks remain valid',()=>{\n const r=pregameRest([\n  {game_id:'w1',season:2025,gameday:'2025-09-07',home_team:'A',away_team:'B'},\n  {game_id:'bye',season:2025,gameday:'2025-09-21',home_team:'A',away_team:'C'},\n  {game_id:'gap',season:2025,gameday:'2025-11-02',home_team:'A',away_team:'D'}\n ]);\n assert.equal(r[1].home_rest_days,13);\n assert.equal(r[2].home_rest_days,'');\n assert.equal(r[2].home_short_rest,'');\n});\n