import test from 'node:test';import assert from 'node:assert/strict';
import {indexPlayerIds,indexSnapCounts,buildRoleHistory,roleShare,roleBurden,roleVector,historicalRoleFeatures} from './player-impact-research.mjs';
import {indexInjuryReports} from './injury-impact-research.mjs';
import {scoreObservations} from './score-pregame-observations.mjs';
import {fetchRoleEvidence} from './player-role-data.mjs';
const gsis=i=>'00-'+String(i).padStart(7,'0');
const ids=Array.from({length:80},(_,i)=>({gsis_id:gsis(i+1),pfr_id:'p'+i}));
const mapping=indexPlayerIds(ids);
const date=i=>'2024-09-'+String(i+1).padStart(2,'0');
const game=i=>({game_id:'g'+i,season:2024,game_type:'REG',week:i+1,gameday:date(i),gametime:'13:00',home_team:'BUF',away_team:'MIA',home_score:24,away_score:17,home_qb_id:gsis(1),away_qb_id:gsis(41)});
function teamRows(i,t,o,offset=0,starterShare=1){
 return Array.from({length:40},(_,j)=>({game_id:'g'+i,team:t,opponent:o,pfr_player_id:'p'+(j+offset),offense_pct:j===0?starterShare:j===10?1:j===11?1-starterShare:j<10?1:0,defense_pct:j>=12&&j<23?1:0}));
}
const games=Array.from({length:5},(_,i)=>game(i));
const snaps=games.flatMap((_,i)=>[...teamRows(i,'BUF','MIA'),...teamRows(i,'MIA','BUF',40)]);
const injury=(player,position,status)=>({gsis_id:player,position,report_status:status});
test('identity mapping requires one-to-one PFR–GSIS identities, not a name match',()=>{
 const m=indexPlayerIds([...ids,{gsis_id:gsis(1),pfr_id:'different'},{gsis_id:gsis(2),pfr_id:'p2'}]);assert.equal(m.has('p0'),false);assert.equal(m.has('p2'),false);assert.equal(m.get('p3'),gsis(4));
});
test('snap index rejects incomplete, contradictory and duplicate team-game data',()=>{
 assert.equal(indexSnapCounts(snaps,mapping).size,10);assert.equal(indexSnapCounts(teamRows(0,'BUF','MIA').slice(0,20),mapping).size,0);
 assert.equal(indexSnapCounts([...teamRows(0,'BUF','MIA'),teamRows(0,'BUF','MIA')[0]],mapping).size,0);
});
test('starter injury carries greater role burden than reserve and unknown is explicit',()=>{
 const indexed=indexSnapCounts(snaps,mapping),state=buildRoleHistory(games,indexed,date(4));
 assert.equal(roleShare(state,'BUF',gsis(1),'offense',date(4)).share,1);assert.equal(roleShare(state,'BUF',gsis(12),'offense',date(4)).share,0);
 const start=roleBurden([injury(gsis(1),'WR','Out')],state,'BUF',gsis(1),date(4)),reserve=roleBurden([injury(gsis(12),'WR','Out')],state,'BUF',gsis(1),date(4)),unknown=roleBurden([injury(gsis(999),'WR','Out')],state,'BUF',gsis(1),date(4));
 assert.equal(start.offense,1);assert.equal(reserve.offense,0);assert.equal(unknown.unknown_offense,1);assert.equal(unknown.players[0].prior_snap_share,null);assert.notDeepEqual(roleVector(start,reserve),roleVector(unknown,reserve));
});
test('current and future snaps cannot influence pregame role, missing latest snap forces unknown',()=>{
 const before=buildRoleHistory(games,indexSnapCounts(snaps,mapping),date(4)),changed=buildRoleHistory(games,indexSnapCounts(snaps.map(r=>r.game_id==='g4'?{...r,offense_pct:0}:r),mapping),date(4));
 assert.deepEqual(roleShare(before,'BUF',gsis(1),'offense',date(4)),roleShare(changed,'BUF',gsis(1),'offense',date(4)));
 const missing=buildRoleHistory(games,indexSnapCounts(snaps.filter(r=>r.game_id!=='g3'),mapping),date(4));assert.equal(roleShare(missing,'BUF',gsis(1),'offense',date(4)),null);
});
test('historical role features exclude same game injury data after cutoff and current snaps',()=>{
 const g=games[4],reports=[{...injury(gsis(1),'WR','Out'),season:g.season,week:g.week,team:'BUF',date_modified:date(4)+'T08:00:00Z'},{...injury(gsis(41),'WR','Questionable'),season:g.season,week:g.week,team:'MIA',date_modified:date(4)+'T08:00:00Z'}];
 const before=historicalRoleFeatures(games,indexSnapCounts(snaps,mapping),indexInjuryReports(reports)).get(g.game_id),changed=historicalRoleFeatures(games,indexSnapCounts(snaps.filter(r=>r.game_id!=='g4'),mapping),indexInjuryReports([...reports,{...reports[0],report_status:'Questionable',date_modified:date(4)+'T23:00:00Z'}])).get(g.game_id);
 assert.deepEqual(before,changed);assert.equal(before.known,2);
});
test('player impact score compares all three models on same completed games only',()=>{
 const games=[{game_id:'a',baseline_home_win_probability:.6,injury_shadow:{home_win_probability:.7},player_impact_shadow:{home_win_probability:.8}},{game_id:'b',baseline_home_win_probability:.6,injury_shadow:{home_win_probability:.7}}],scores=[{game_id:'a',home_score:21,away_score:14},{game_id:'b',home_score:14,away_score:21}];
 const r=scoreObservations(games,scores);assert.equal(r.scored_games,2);assert.equal(r.player_impact_comparison.scored_games,1);assert.equal(r.player_impact_comparison.metrics.v2.n,1);assert.ok(r.player_impact_comparison.metrics.weighted.brier<r.player_impact_comparison.metrics.injury.brier);
});
test('role source schema failures are errors, not fabricated player shares',async()=>{
 await assert.rejects(fetchRoleEvidence(2026,{fetchImpl:async()=>({ok:true,text:async()=> 'wrong,header\nfoo,bar'})}),/schema/);
});
