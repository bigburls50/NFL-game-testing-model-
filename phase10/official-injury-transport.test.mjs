import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTeamInjuryReports} from './official-injury-coverage.mjs';
const game={game_id:'2026_11_IND_HOU',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
const report=(team,source_url)=>({game_id:game.game_id,team,source_url,source_type:'official_team_or_league',source_digest:'sha256:fixture',published_at_utc:'2026-11-19T00:00:00Z',retrieved_at_utc:'2026-11-19T00:30:00Z',complete_report:true,team_section_verified:true,game_section_verified:true,report_date_verified:true,players:[{player_name:'Fixture Player',injury:'knee',practice_status:'limited'}]});
const asOf='2026-11-19T01:00:00Z';
test('valid HTTPS official report retains eligibility',()=>{const r=auditTeamInjuryReports([game],[report('HOU','https://www.nfl.com/injuries/league/2026/reg11'),report('IND','https://www.nfl.com/injuries/league/2026/reg11')],{asOf});assert.equal(r.ready,true);});
test('HTTP official-looking injury report is rejected',()=>{const r=auditTeamInjuryReports([game],[report('HOU','http://www.nfl.com/injuries/league/2026/reg11'),report('IND','https://www.nfl.com/injuries/league/2026/reg11')],{asOf});assert.equal(r.ready,false);assert.equal(r.coverage.find(x=>x.team==='HOU').verified,false);});
test('official URL with embedded credentials or nonstandard port is rejected',()=>{for(const url of ['https://user:pass@www.nfl.com/injuries/','https://www.nfl.com:444/injuries/']){const r=auditTeamInjuryReports([game],[report('HOU',url),report('IND','https://www.nfl.com/injuries/')],{asOf});assert.equal(r.ready,false);}});
