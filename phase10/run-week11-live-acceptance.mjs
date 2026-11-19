#!/usr/bin/env node
// Exercise actual scheduled NFL matchups with only verified input records.
// Raw official news and injury page observations do not qualify as confirmed records.
import fs from 'node:fs';
import {acceptGameFeeds} from './game-feed-acceptance.mjs';
const manifest=JSON.parse(fs.readFileSync('phase10/upcoming-week11-2026.json','utf8'));
const evidence=JSON.parse(fs.readFileSync('phase10/data/week11-colts-texans-official-evidence.json','utf8'));
const report=acceptGameFeeds(manifest.games,{starterReports:[],injuryReports:[],asOf:evidence.as_of_utc});
if(report.games.length!==manifest.games.length||report.games.some(g=>g.decision!=='abstain'||g.reasons.length!==4))throw Error('Fail-closed acceptance regression');
const output={as_of_utc:evidence.as_of_utc,season:manifest.season,week:manifest.week,games:report.games,verified_games:0,abstentions:report.games.length,source_evidence_path:'phase10/data/week11-colts-texans-official-evidence.json',warning:'Actual game schedule and official source observations; no independently verified QB or complete injury records have been ingested. This proves abstention, not feed completeness.'};
fs.mkdirSync('phase10/data',{recursive:true});
fs.writeFileSync('phase10/data/week11-live-acceptance-audit.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({games:report.games.length,verified_games:0,abstentions:report.games.length}));
