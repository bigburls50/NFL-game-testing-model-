import test from 'node:test';import assert from 'node:assert/strict';import {predictMatchups} from './matchups.mjs';
const g=(id,date,home,away,hs,as)=>({game_id:id,gameday:date,season:'2024',home_team:home,away_team:away,home_score:String(hs),away_score:String(as)});
test('same-day outcomes do not affect pregame features',()=>{const a=g('a','2024-09-01','A','B',40,0),b=g('b','2024-09-01','A','C',0,40);const r=predictMatchups([a,b]);assert.equal(r[0].home_prior_games,0);assert.equal(r[1].home_prior_games,0);assert.equal(r[0].home_win_probability,r[1].home_win_probability)});
test('past offensive strength increases projected margin',()=>{const r=predictMatchups([g('a','2024-09-01','A','B',40,0),g('b','2024-09-08','A','C',20,10)]);assert.ok(r[1].home_win_probability>r[0].home_win_probability);assert.equal(r[1].home_prior_games,1)});
test('order independent',()=>{const a=g('a','2024-09-01','A','B',40,0),b=g('b','2024-09-08','A','C',20,10);assert.deepEqual(predictMatchups([b,a]),predictMatchups([a,b]))});
test('rejects duplicate games',()=>assert.throws(()=>predictMatchups([g('a','2024-09-01','A','B',1,0),g('a','2024-09-08','A','C',1,0)]),/Duplicate/));
