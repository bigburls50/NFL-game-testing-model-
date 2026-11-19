#!/usr/bin/env node
// Research-only pregame feed: depth chart + roster + injuries. No fabricated healthy teams.
import fs from 'node:fs';
import {fetchVerifiedRosterIds} from './verified-roster-id-feed.mjs';
import {fetchNflverseDepthCharts,projectedQuarterbacks} from './nflverse-depth-chart-adapter.mjs';
import {fetchNflverseInjuries,injuryCandidates} from './nflverse-injuries-adapter.mjs';
import {assessPregameEvidence} from './pregame-evidence-gate.mjs';
export async function collectPregameSnapshot(manifest,{asOf=new Date().toISOString(),rosterFetch=fetchVerifiedRosterIds,depthFetch=fetchNflverseDepthCharts,injuryFetch=fetchNflverseInjuries}={}){
 const feeds=await Promise.allSettled([rosterFetch(),depthFetch(manifest.season),injuryFetch(manifest.season)]);
 const errors=feeds.map((r,i)=>r.status==='rejected'?{feed:['roster','depth_chart','injuries'][i],reason:r.reason.message}:null).filter(Boolean);
 if(errors.length)return {ready:false,errors,games:manifest.games.map(g=>({game_id:g.game_id,decision:'abstain',reasons:['missing_pregame_feed']}))};
 const [roster,depth,injury]=feeds.map(x=>x.value);
 const qb=projectedQuarterbacks(depth,manifest.week),teams=[...new Set(manifest.games.flatMap(g=>[g.home_team,g.away_team]))];
 const candidates=injuryCandidates(injury,manifest.week,teams);
 const injuryReports=teams.map(team=>({team,source_verified:Boolean(injury.source_digest&&injury.source_url?.startsWith('https://github.com/nflverse/')),retrieved_at_utc:asOf,players:candidates.filter(p=>p.team===team)})).filter(r=>r.players.length>0);
 const games=manifest.games.map(game=>({game_id:game.game_id,...assessPregameEvidence(game,{roster:roster.players,depthChart:qb,injuries:injuryReports,retrievedAt:asOf,asOf})}));
 return {ready:games.some(g=>g.decision==='preliminary_inputs_available'),mode:'preliminary_research_only',checked_at_utc:asOf,source_provenance:{roster:{url:roster.source_url,digest:roster.source_digest},depth_chart:{url:depth.source_url,digest:depth.source_digest,columns:depth.columns},injuries:{url:injury.source_url,digest:injury.source_digest}},projected_qb_count:qb.length,injury_candidate_rows:candidates.length,games,warning:'Preliminary research feed only; never bypass official final-game evidence or validated forecast model.'};
}
if(process.argv[1]?.endsWith('collect-pregame-snapshot.mjs')){
 const manifest=JSON.parse(fs.readFileSync(process.argv[2]??'phase10/upcoming-week11-2026.json','utf8'));
 const output=process.argv[3]??'phase10/data/pregame-snapshot-audit.json';
 const result=await collectPregameSnapshot(manifest);
 fs.mkdirSync('phase10/data',{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\\n');
 console.log(JSON.stringify({ready:result.ready,errors:result.errors??[],games:result.games.map(g=>({game_id:g.game_id,decision:g.decision,reasons:g.reasons}))}));
}
