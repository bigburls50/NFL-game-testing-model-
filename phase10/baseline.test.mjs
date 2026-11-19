import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBaseline,parseCSV} from './baseline.mjs';
const game=(id,season,home,away)=>({game_id:id,season:String(season),gameday:season+'-09-10',home_team:'A',away_team:'B',home_score:String(home),away_score:String(away)});
test('uses only earlier seasons and never current-season outcomes',()=>{const rows=[game('a',2020,21,7),game('b',2021,0,14),game('c',2021,50,0),game('d',2022,10,14)];const p=buildBaseline(rows);assert.equal(p.length,3);assert.equal(p.find(x=>x.game_id==='b').home_win_probability,2/3);assert.equal(p.find(x=>x.game_id==='c').home_win_probability,2/3);assert.equal(p.find(x=>x.game_id==='d').home_win_probability,3/5);assert.equal(p.find(x=>x.game_id==='d').training_last_season,2021)});
test('ignores ties in calibration training and target scoring',()=>{const p=buildBaseline([game('a',2020,17,17),game('b',2020,24,10),game('c',2021,10,0)]);assert.equal(p.length,1);assert.equal(p[0].training_games,1);assert.equal(p[0].home_win_probability,2/3)});
test('rejects duplicate games',()=>assert.throws(()=>buildBaseline([game('a',2020,2,1),game('a',2021,1,2)]),/duplicate/));
test('handles quoted CSV values',()=>assert.equal(parseCSV('game_id,home_team\nx,"A, B"\n')[0].home_team,'A, B'));
