import test from 'node:test';import assert from 'node:assert/strict';
import {auditTeamInjuryReports} from './official-injury-coverage.mjs';
import {loadValidatedLogisticModel} from './versioned-model-loader.mjs';
import {collectOfficialStarterEvidence} from './official-starter-source-collector.mjs';
const schedule=[{game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'}],asOf='2026-11-18T18:00:00Z';
const report=team=>({game_id:'g',team,source_type:'official_team_or_league',source_url:'https://www.nfl.com/',published_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z',players:[],explicit_no_injuries:true,complete_report:true});
test('both complete injury reports including explicit no injuries are required',()=>{assert.equal(auditTeamInjuryReports(schedule,[report('HOU')],{asOf}).ready,false);assert.equal(auditTeamInjuryReports(schedule,[report('HOU'),report('IND')],{asOf}).ready,true);});
test('unverified fitted model cannot load',()=>{assert.throws(()=>loadValidatedLogisticModel({version:'v1',validation:{status:'unverified'}}),/Unverified/);});
test('official document retrieval never auto-confirms QB',async()=>{const result=await collectOfficialStarterEvidence([{url:'https://www.nfl.com/news/test',game_id:'g',team:'HOU',published_at_utc:'2026-11-18T16:00:00Z'}],{asOf,fetchImpl:async()=>({ok:true,text:async()=>'<html><meta property="article:published_time" content="2026-11-18T16:00:00Z">QB projected</html>'})});assert.equal(result.confirmed_starters,0);assert.equal(result.evidence[0].status,'unconfirmed');});
