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
test('same-date double-booked team is rejected',()=>assert.throws(()=>pregameRest([...games,{game_id:'bad',gameday:'2025-09-01',home_team:'A',away_team:'Z'}]),/twice/));
test('invalid date and duplicate game are rejected',()=>{
 assert.throws(()=>pregameRest([{...games[0],gameday:'2025-02-30'}]),/date/);
 assert.throws(()=>pregameRest([games[0],games[0]]),/duplicate/);
});
test('cross-season rest is historical, not invented',()=>{
 const r=pregameRest([{...games[0],gameday:'2024-12-20'}, {...games[2],gameday:'2025-09-01'}]);
 assert.ok(r[1].home_rest_days>100);
 assert.equal(r[1].away_rest_days,'');
});
