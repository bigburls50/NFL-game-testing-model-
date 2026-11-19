import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOfficialStatusNews,matchQuarterbackIdentity} from './official-status-ingestion.mjs';
test('official status summary parses named players but cannot certify completeness',()=>{
 const result=parseOfficialStatusNews('### COLTS\n* OUT: TE Will Mallory (hamstring), OT Bernhard Raimann (concussion)\n* QUESTIONABLE: WR Anthony Gould (toe)\n### TEXANS\n* OUT: RB Woody Marks (concussion)',{sourceUrl:'https://www.nfl.com/news/nfl-week-11-injury-report-2026-season',retrievedAt:'2026-11-19T17:00:00Z'});
 assert.equal(result.teams.length,2);assert.equal(result.teams[0].players.length,3);
 assert.equal(result.teams[1].players[0].name,'Woody Marks');
 assert.equal(result.verified,false);assert.equal(result.teams[0].complete_final_report,false);
});
test('QB matching fails without independent confirmation or unique roster ID',()=>{
 const roster=[{team:'Colts',position:'QB',player_name:'Example QB',player_id:'00-1234567'}];
 assert.equal(matchQuarterbackIdentity({team:'Colts',playerName:'Example QB',roster}).verified,false);
 const confirmation={team:'Colts',player_name:'Example QB',player_id:'00-1234567',position:'QB',confirmed_starter:true,source_url:'https://www.nfl.com/',confirmed_at_utc:'2026-11-19T17:00:00Z'};
 assert.equal(matchQuarterbackIdentity({team:'Colts',playerName:'Example QB',roster,confirmation}).verified,true);
 assert.equal(matchQuarterbackIdentity({team:'Colts',playerName:'Example QB',roster:[...roster,...roster],confirmation}).verified,false);
});
