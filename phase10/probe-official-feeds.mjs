#!/usr/bin/env node
// Live official-source research: only independently source-stamped, explicitly named QBs can be candidates.
import fs from 'node:fs';
import {collectOfficialStarterEvidence} from './official-starter-source-collector.mjs';
import {extractConfirmedStarter} from './official-starter-extractor.mjs';
import {fetchVerifiedRosterIds} from './verified-roster-id-feed.mjs';
import {collectOfficialInjuryPage} from './collect-official-injury-page.mjs';
import {acceptGameFeeds} from './game-feed-acceptance.mjs';
const manifest=JSON.parse(fs.readFileSync(process.argv[2]??'phase10/upcoming-week11-2026.json','utf8'));
const sources=JSON.parse(fs.readFileSync(process.argv[3]??'phase10/official-qb-sources.json','utf8'));
const [starters,injuries,rosterResult]=await Promise.all([collectOfficialStarterEvidence(sources),collectOfficialInjuryPage(manifest.games),fetchVerifiedRosterIds().catch(e=>({players:[],error:e.message}))]);
const evaluations=starters.evidence.map(d=>{
 const game=manifest.games.find(g=>g.game_id===d.game_id);
 return extractConfirmedStarter(d,{game,team:d.team,roster:rosterResult.players});
});
const confirmed=evaluations.filter(e=>e.status==='confirmed');
const gate=acceptGameFeeds(manifest.games,{starterReports:confirmed,injuryReports:[],asOf:new Date().toISOString()});
const starterAudit={...starters,roster_source_url:rosterResult.source_url??null,roster_source_digest:rosterResult.source_digest??null,roster_error:rosterResult.error??null,evaluations,confirmed_starters:confirmed.length,ready_for_forecast:false,warning:'Roster team assignment and article context require further verification before any forecast gate is opened.'};
fs.mkdirSync('phase10/data',{recursive:true});
fs.writeFileSync('phase10/data/official-starter-source-audit.json',JSON.stringify(starterAudit,null,2)+'\n');
fs.writeFileSync('phase10/data/official-injury-page-audit.json',JSON.stringify(injuries,null,2)+'\n');
fs.writeFileSync('phase10/data/official-live-four-input-gate.json',JSON.stringify(gate,null,2)+'\n');
console.log(JSON.stringify({starter_documents:starters.evidence.length,starter_errors:starters.errors.length,roster_ids:rosterResult.players.length,starter_candidates:confirmed.length,injury_page_digest:injuries.source_digest,verified_team_reports:0,gate_ready:gate.ready,gate_decisions:gate.games,ready_for_forecast:false}));
