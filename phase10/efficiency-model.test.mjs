import test from 'node:test';import assert from 'node:assert/strict';
import {indexEfficiency,buildEfficiencyFeatures,expand,TEAM_FEATURES,QB_FEATURES} from './efficiency-model.mjs';
import {fitLogistic} from './learned-matchup.mjs';
import {scoreShadowSlate} from './efficiency-shadow.mjs';
import {matchFinalScores} from './run-efficiency-shadow-settlement.mjs';
const H='00-0039163',A='00-0035710';
const game=(id,date,home='BUF',away='MIA')=>({game_id:id,gameday:date,season:2025,game_type:'REG',home_team:home,away_team:away,home_score:28,away_score:14,home_qb_id:H,away_qb_id:A,location:'Home',home_rest:7,away_rest:7});
const team=(id,t,o,epa)=>({game_id:id,team:t,opponent_team:o,attempts:30,sacks_suffered:2,passing_epa:epa,carries:25,rushing_epa:epa/2});
const qb=(id,t,p,epa)=>({...team(id,t,'other',epa),position:'QB',player_id:p,passing_cpoe:epa});
const fixtures=[game('one','2025-09-01'),game('two','2025-09-08'),game('three','2025-09-15')];
const teamRows=fixtures.flatMap(g=>[team(g.game_id,'BUF','MIA',12),team(g.game_id,'MIA','BUF',-8)]);
const qbRows=fixtures.flatMap(g=>[qb(g.game_id,'BUF',H,14),qb(g.game_id,'MIA',A,-10)]);
test('current-game statistics, score and QB identity cannot influence current pregame inputs',()=>{
 const initial=buildEfficiencyFeatures(fixtures,indexEfficiency(teamRows,qbRows)).data[1];
 const changed=buildEfficiencyFeatures([fixtures[0],{...fixtures[1],home_qb_id:A,home_score:0,away_score:99},fixtures[2]],indexEfficiency(teamRows.map(r=>r.game_id==='two'?{...r,passing_epa:999}:r),qbRows.map(r=>r.game_id==='two'?{...r,passing_epa:-999}:r))).data[1];
 assert.deepEqual(initial.x,changed.x);assert.deepEqual(initial.extra,changed.extra);
});
test('same-day statistics cannot update another pregame forecast, prior dates can',()=>{
 const f=[fixtures[0],{...fixtures[1],gameday:fixtures[0].gameday},fixtures[2]],base=buildEfficiencyFeatures(f,indexEfficiency(teamRows,qbRows)),modified=buildEfficiencyFeatures(f,indexEfficiency(teamRows.map(r=>r.game_id==='one'?{...r,passing_epa:99}:r),qbRows));
 assert.deepEqual(base.data[1].extra,modified.data[1].extra);assert.notDeepEqual(base.data[2].extra,modified.data[2].extra);
});
test('live forecast feature vector matches historical prior-game-only features',()=>{
 const stats=indexEfficiency(teamRows,qbRows),full=buildEfficiencyFeatures(fixtures,stats),forecast=buildEfficiencyFeatures(fixtures.slice(0,2),stats,{forecasts:[fixtures[2]]});assert.deepEqual(full.data[2].extra,forecast.forecasts[0].extra);assert.deepEqual(expand(full.data[2],'qb').x,expand(forecast.forecasts[0],'qb').x);assert.equal(expand(forecast.forecasts[0],'team').x.length,TEAM_FEATURES.length);assert.equal(expand(forecast.forecasts[0],'qb').x.length,QB_FEATURES.length);
});
test('relocated franchise identity joins exact historical game and opponent',()=>{
 const rows=[game('old','2025-09-01','OAK','SD')],stats=indexEfficiency([team('old','LV','LAC',4),team('old','LAC','LV',-4)],[qb('old','LV',H,4),qb('old','LAC',A,-4)]);
 const r=buildEfficiencyFeatures(rows,stats);assert.equal(r.coverage.team_games,1);assert.equal(r.coverage.qb_starts,2);
 const wrong=indexEfficiency([team('old','LV','BUF',4),team('old','LAC','LV',-4)]);assert.equal(buildEfficiencyFeatures(rows,wrong).coverage.team_games,0);
});
test('duplicate stat records and malformed training arrays are rejected',()=>{
 assert.throws(()=>indexEfficiency([...teamRows,teamRows[0]]),/Duplicate/);assert.throws(()=>fitLogistic(Array.from({length:100},()=>({x:[NaN],y:1}))),/Invalid feature matrix/);
});
test('shadow results only score exact matching completed games without mutating locked forecasts',()=>{
 const slate={locked_at_utc:'2025-09-01T00:00:00Z',games:[{game_id:'one',home_team:'BUF',away_team:'MIA',home_win_probabilities:{v2:.7,team:.8,qb:.6}},{game_id:'two',home_team:'BUF',away_team:'MIA',home_win_probabilities:{v2:.7,team:.8,qb:.6}}]};
 const before=JSON.stringify(slate),r=scoreShadowSlate(slate,[fixtures[0],{...fixtures[1],home_team:'KC'}]);assert.equal(r.scored_games,1);assert.deepEqual(r.pending,['two']);assert.ok(r.metrics.team.brier<r.metrics.v2.brier);assert.equal(JSON.stringify(slate),before);
});
test('scoreboard settlement requires a unique final exact matchup, after kickoff, and preserves settled records',()=>{
 const slate={games:[{game_id:'one',home_team:'BUF',away_team:'MIA',kickoff_utc:'2026-11-22T18:00:00Z'}]},now=Date.parse('2026-11-22T22:00:00Z'),result={home_team:'Buffalo Bills',away_team:'Miami Dolphins',kickoff_utc:slate.games[0].kickoff_utc,home_score:28,away_score:14,final:true};
 assert.equal(matchFinalScores(slate,[{...result,final:false}],[],now).length,0);assert.equal(matchFinalScores(slate,[result,result],[],now).length,0);
 assert.equal(matchFinalScores(slate,[result],[],now-8*3600000).length,0);const saved=matchFinalScores(slate,[result],[],now);assert.equal(saved.length,1);assert.equal(saved[0].gameday,'2026-11-22');assert.deepEqual(matchFinalScores(slate,[{...result,home_score:99}],saved,now),saved);
});
