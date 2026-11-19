import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestOfficialStarters} from './official-starter-intake.mjs';
const schedule=[{game_id:'g',home_team:'HOU',away_team:'IND',kickoff_utc:'2026-11-20T01:15:00Z'}],asOf='2026-11-18T18:00:00Z';
const evidence=team=>({game_id:'g',team,player_id:'player-'+team,player_name:'Test QB',source_url:'https://www.nfl.com/news/example',source_type:'official_team_or_league',published_at_utc:'2026-11-18T16:00:00Z',retrieved_at_utc:'2026-11-18T17:00:00Z',source_excerpt:'Team confirms starter',explicitly_named_starter:true,confirmation_type:'confirmed'});
test('official source-stamped evidence maps to gate records',()=>{const result=ingestOfficialStarters(schedule,[evidence('HOU'),evidence('IND')],{asOf});assert.equal(result.ready,true);assert.match(result.records[0].source_digest,/^sha256:/);});
test('unofficial projected starter is rejected',()=>{const result=ingestOfficialStarters(schedule,[{...evidence('HOU'),confirmation_type:'projected'},evidence('IND')],{asOf});assert.equal(result.ready,false);assert.equal(result.records.length,1);});
