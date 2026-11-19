#!/usr/bin/env node
// Archive source evidence for official feeds; never convert raw pages into starter/injury confirmations.
import fs from 'node:fs';
import {collectOfficialStarterEvidence} from './official-starter-source-collector.mjs';
import {collectOfficialInjuryPage} from './collect-official-injury-page.mjs';
const manifest=JSON.parse(fs.readFileSync(process.argv[2]??'phase10/upcoming-week11-2026.json','utf8'));
const sources=[
 {game_id:'2026_11_MIN_SF',team:'MIN',url:'https://www.vikings.com/news/kirk-cousins-starting-packers-week-10-game-2026',approved_team_hostname:'www.vikings.com'},
 {game_id:'2026_11_LV_DEN',team:'LV',url:'https://www.raiders.com/news/fernando-mendoza-named-raiders-starting-quarterback',approved_team_hostname:'www.raiders.com'}
];
const [starters,injuries]=await Promise.all([collectOfficialStarterEvidence(sources),collectOfficialInjuryPage(manifest.games)]);
fs.mkdirSync('phase10/data',{recursive:true});
fs.writeFileSync('phase10/data/official-starter-source-audit.json',JSON.stringify(starters,null,2)+'\n');
fs.writeFileSync('phase10/data/official-injury-page-audit.json',JSON.stringify(injuries,null,2)+'\n');
console.log(JSON.stringify({starter_documents:starters.evidence.length,starter_errors:starters.errors.length,confirmed_starters:0,injury_page_digest:injuries.source_digest,verified_team_reports:0,ready_for_forecast:false}));
