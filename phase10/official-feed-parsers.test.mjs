import test from 'node:test';import assert from 'node:assert/strict';
import {extractConfirmedStarter} from './official-starter-extractor.mjs';
import {parseOfficialInjuryHtml} from './official-injury-html-parser.mjs';
const game={game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'};
const doc={game_id:'g',team:'HOU',status:'unconfirmed',review_status:'pending_explicit_starter_confirmation',document_sha256:'sha256:abc',source_url:'https://www.nfl.com/news/example',published_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z',html:'<p>Example Player will be the starting quarterback for Houston.</p>'};
const options={game,team:'HOU',roster:[{team:'HOU',player_id:'verified-id',player_name:'Example Player'}],asOf:'2026-11-18T18:00:00Z'};
test('explicit official named starter maps to known player ID',()=>{const r=extractConfirmedStarter(doc,options);assert.equal(r.status,'confirmed');assert.equal(r.player_id,'verified-id');});
test('projected depth chart and missing roster ID never confirm',()=>{assert.equal(extractConfirmedStarter({...doc,html:'<p>Example Player projected as QB1</p>'},options).status,'unconfirmed');assert.equal(extractConfirmedStarter(doc,{...options,roster:[]}).status,'unconfirmed');});
test('official injury page no-injuries placeholder is never treated as complete report',()=>{const r=parseOfficialInjuryHtml('<h3>Colts</h3>No Injuries Reported',[game]);assert.equal(r.ready_for_forecast,false);assert.equal(r.reports.length,2);assert.ok(r.reports.every(x=>!x.complete_report));});

test('third-party QB announcement cannot become verified starter',()=>{
 const r=extractConfirmedStarter({...doc,source_url:'https://example.com/news/qb-confirmed'},options);
 assert.equal(r.status,'unconfirmed');assert.equal(r.reason,'unverified_source_domain');
});
test('lookalike NFL domain cannot become verified starter',()=>{
 const r=extractConfirmedStarter({...doc,source_url:'https://nfl.com.evil.example/news'},options);
 assert.equal(r.status,'unconfirmed');assert.equal(r.reason,'unverified_source_domain');
});
test('independently verified team domain can confirm explicit announcement',()=>{
 const r=extractConfirmedStarter({...doc,source_url:'https://www.houstontexans.com/news/qb',verified_team_domain:'www.houstontexans.com',source_verified_independently:true},options);
 assert.equal(r.status,'confirmed');
});
test('team domain without independent verification is rejected',()=>{
 const r=extractConfirmedStarter({...doc,source_url:'https://www.houstontexans.com/news/qb',verified_team_domain:'www.houstontexans.com'},options);
 assert.equal(r.status,'unconfirmed');
});

test('unverified no-injuries placeholder cannot assert an explicit clean report',()=>{
 const r=parseOfficialInjuryHtml('<h3>Colts</h3>No Injuries Reported',[game],{publishedAt:'2026-11-18T16:00:00Z'});
 assert.equal(r.ready_for_forecast,false);
 assert.ok(r.reports.every(x=>x.explicit_no_injuries===false && x.complete_report===false));
 assert.equal(r.reports.find(x=>x.team==='IND').placeholder_observed,true);
});

test('official QB URLs with credentials or nonstandard ports are rejected',()=>{
 for(const source_url of ['https://user:pass@www.nfl.com/news/example','https://www.nfl.com:8443/news/example']){
  const result=extractConfirmedStarter({...doc,source_url},options);
  assert.equal(result.status,'unconfirmed');
  assert.equal(result.reason,'unverified_source_domain');
 }
});

test('non-quarterback roster identity cannot be promoted to confirmed starter',()=>{
 const nonQb=extractConfirmedStarter(doc,{...options,roster:[{...options.roster[0],position:'WR'}]});
 assert.equal(nonQb.status,'unconfirmed');
 assert.equal(nonQb.reason,'no_unique_explicit_starter');
 const qb=extractConfirmedStarter(doc,{...options,roster:[{...options.roster[0],position:'QB'}]});
 assert.equal(qb.status,'confirmed');
});


test('official starter evidence for a team outside the matchup is rejected',()=>{
 const otherTeamDoc={...doc,team:'DAL'};
 const result=extractConfirmedStarter(otherTeamDoc,{...options,team:'DAL',roster:[{team:'DAL',player_id:'verified-id',player_name:'Example Player',position:'QB'}]});
 assert.equal(result.status,'unconfirmed');
 assert.equal(result.reason,'team_not_in_game');
});
