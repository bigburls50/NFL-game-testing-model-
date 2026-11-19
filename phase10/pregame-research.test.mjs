import test from 'node:test';import assert from 'node:assert/strict';
import {indexDatedDepthCSV,datedStarter,buildQBChangeFeatures} from './qb-change-research.mjs';
import {indexInjuryReports,pregameInjuries} from './injury-impact-research.mjs';
import {projectedQuarterbacks} from './nflverse-depth-chart-adapter.mjs';
import {buildPregameObservation,weatherObservation} from './pregame-observations.mjs';
import {selectObservations,scoreObservations} from './score-pregame-observations.mjs';
const H='00-0039163',A='00-0035710',B='00-0033119';
const header='dt,team,player_name,espn_id,gsis_id,pos_grp_id,pos_grp,pos_id,pos_name,pos_abb,pos_slot,pos_rank';
const depth=(date,team,qb,position='QB',rank=1)=>[date,team,'Player','1',qb,21,'Formation',8,'Quarterback',position,9,rank].join(',');
const date='2026-09-07T07:00:00Z',later='2026-09-08T07:00:00Z';
test('dated QB lookup selects newest full snapshot, ignores future and rejects missing/ambiguous starter',()=>{
 const index=indexDatedDepthCSV([header,depth(date,'BUF',H),depth(date,'BUF',H),depth(later,'BUF',A,'WR'),depth(date,'MIA',A),depth(date,'MIA',B)].join('\n'));
 assert.equal(datedStarter(index,'BUF','2026-09-07T18:00:00Z').id,H);assert.equal(datedStarter(index,'BUF','2026-09-08T18:00:00Z'),null);
 assert.equal(datedStarter(index,'MIA','2026-09-07T18:00:00Z'),null);assert.equal(datedStarter(index,'BUF','2026-09-02T18:00:00Z'),null);
});
test('live depth adapter does not silently reuse yesterday QB when latest snapshot is missing or ambiguous',()=>{
 const source={keys:{teamKey:'team',idKey:'gsis_id',positionKey:'pos_abb',rankKey:'pos_rank',weekKey:'dt'},rows:[{team:'BUF',gsis_id:H,pos_abb:'QB',pos_rank:1,dt:date},{team:'BUF',gsis_id:A,pos_abb:'WR',pos_rank:1,dt:later},{team:'MIA',gsis_id:A,pos_abb:'QB',pos_rank:1,dt:later},{team:'MIA',gsis_id:A,pos_abb:'QB',pos_rank:1,dt:later}]};
 assert.deepEqual(projectedQuarterbacks(source,1,{asOf:'2026-09-08T18:00:00Z'}),[{team:'MIA',position:'QB',player_id:A,depth_rank:1,snapshot_at_utc:new Date(later).toISOString()}]);
});
const fixture=(game_id,gameday)=>({game_id,gameday,gametime:'20:20',season:2026,week:1,game_type:'REG',home_team:'BUF',away_team:'MIA',home_score:24,away_score:17,home_qb_id:H,away_qb_id:A});
test('QB adjustment uses only prior completed-game stats, not upcoming actual starter or stats',()=>{
 const first=fixture('g1','2026-09-01'),second=fixture('g2','2026-09-08'),idx=indexDatedDepthCSV([header,depth(later,'BUF',B),depth(later,'MIA',A)].join('\n'));
 const players=[{game_id:'g1',player_id:H,position:'QB',team:'BUF',attempts:30,sacks_suffered:2,passing_epa:10},{game_id:'g1',player_id:A,position:'QB',team:'MIA',attempts:30,sacks_suffered:2,passing_epa:-3}];
 const before=buildQBChangeFeatures([first,second],players,new Map([[2026,idx]])).get('g2'),after=buildQBChangeFeatures([first,{...second,home_qb_id:B,home_score:0,away_score:99}],players.concat({...players[0],game_id:'g2',passing_epa:99}),new Map([[2026,idx]])).get('g2');
 assert.deepEqual(before,after);assert.equal(before.changed,true);assert.equal(before.teams.BUF.projected_rating.prior_dropbacks,0);
});
test('injury model ignores late, undated and conflicting records; absent team is unknown',()=>{
 const g=fixture('g2','2026-09-08'),base={season:2026,week:1,team:'BUF',gsis_id:H,position:'QB',report_status:'Out',date_modified:date},cutoff=Date.parse('2026-09-08T18:00:00Z');
 const index=indexInjuryReports([base,{...base,report_status:'Questionable',date_modified:'2026-09-09T00:00:00Z'},{...base,gsis_id:B,date_modified:''}]);
 assert.equal(pregameInjuries(index,g,'BUF',cutoff,H).prior_qb_status,1);assert.equal(pregameInjuries(index,g,'MIA',cutoff,A),null);assert.equal(pregameInjuries(indexInjuryReports([base,{...base,report_status:'Doubtful'}]),g,'BUF',cutoff,H),null);
});
test('observation archives undated record as observed, not official timestamp; excludes expired games and missing weather',()=>{
 const g={...fixture('g2','2026-09-08'),kickoff_utc:'2026-09-09T00:20:00Z',status:'provisional',home_win_probability:.7};
 const report={team:'BUF',source_verified:true,source_url:'source',timestamp_basis:'dataset_last_modified',players:[{player_id:H,position:'QB',game_status:'Out',report_date:null}]};
 const feed={generated_at_utc:'2026-09-08T15:00:00Z',games:[g,{...g,game_id:'past',kickoff_utc:'2026-09-08T12:00:00Z'}],research_evidence:{depthChart:[],injuryReports:[report]}};
 const result=buildPregameObservation(feed,{observedAt:'2026-09-08T16:00:00Z'});
 assert.equal(result.games.length,1);assert.equal(result.games[0].teams.BUF.injury_report.rows[0].source_report_at_utc,null);assert.equal(result.games[0].teams.MIA.injury_report,null);assert.equal(result.games[0].injury_shadow,null);assert.equal(result.games[0].weather,null);
 assert.equal(weatherObservation({id:'1',weather:{temperature:60},competitions:[{venue:{indoor:false}}]}).wind_speed,null);
});
test('prospective scoring selects fixed pregame horizon regardless of candidate availability or outcome',()=>{
 const g={game_id:'g',kickoff_utc:'2026-09-09T00:00:00Z',baseline_home_win_probability:.6,injury_shadow:{home_win_probability:.7}};
 const selected=selectObservations([{observed_at_utc:'2026-09-07T20:00:00Z',games:[g]},{observed_at_utc:'2026-09-08T17:00:00Z',games:[g]},{observed_at_utc:'2026-09-08T20:00:00Z',games:[{...g,injury_shadow:null}]},{observed_at_utc:'2026-09-08T23:00:00Z',games:[g]}]);
 assert.equal(selected.length,1);assert.equal(selected[0].observed_at_utc,'2026-09-08T20:00:00Z');assert.equal(scoreObservations(selected,[{game_id:'g',home_score:10,away_score:7}]).scored_games,0);
});
