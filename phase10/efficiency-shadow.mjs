// Prospective research-only comparison. Never used by the production probability or sizing engine.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {parseCSV} from './baseline.mjs';
import {readEfficiencyFiles} from './efficiency-data.mjs';
import {buildEfficiencyFeatures,indexEfficiency,expand,EFFICIENCY_VERSION} from './efficiency-model.mjs';
import {completedRows,fitLogistic,predictLogistic,scorePredictions,LEARNED_VERSION} from './learned-matchup.mjs';
import {publicPredictions} from './public-predictions.mjs';
const hash=s=>'sha256:'+createHash('sha256').update(JSON.stringify(s)).digest('hex');
export function buildShadowSlate(rows,stats,feed,{asOf=new Date().toISOString(),sources=[]}={}){
 const now=Date.parse(asOf),cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));
 if(feed.model?.version!==LEARNED_VERSION)throw Error('Requires fresh V2 baseline');
 const eligible=new Set(publicPredictions(feed,now).predictions.map(g=>g.game_id));
 const games=feed.games.filter(g=>eligible.has(g.game_id)&&Date.parse(g.kickoff_utc)>now);
 if(!games.length)throw Error('No eligible pregame fixtures');
 const season=Number(games[0].season);if(games.some(g=>Number(g.season)!==season))throw Error('Mixed seasons');
 const history=completedRows(rows).filter(r=>r.gameday<cutoff&&Number(r.season)>=season-10&&Number(r.season)<=season);
 const {data,forecasts,coverage}=buildEfficiencyFeatures(history,stats,{forecasts:games});
 if(coverage.team_games!==coverage.total_games||coverage.qb_starts/coverage.total_starts<.90)throw Error('Insufficient verified historical stats coverage');
 const train=data.filter(r=>r.season>season-10&&r.season<season);
 const weights=Object.fromEntries(['team','qb'].map(k=>[k,fitLogistic(train.map(r=>expand(r,k)))]));
 const digest=hash([EFFICIENCY_VERSION,weights,history.map(r=>[r.game_id,r.gameday,r.home_score,r.away_score,r.home_qb_id,r.away_qb_id]),sources]);
 return {mode:'research_only_no_stakes',locked_at_utc:asOf,model_version:EFFICIENCY_VERSION,model_digest:digest,baseline_version:feed.model.version,baseline_digest:feed.model.digest,baseline_generated_at_utc:feed.generated_at_utc,training_games:train.length,history_cutoff_date:cutoff,coverage,sources,weights,games:games.map(g=>{const f=forecasts.find(r=>r.game_id===g.game_id);if(!f.extra.team_history_ready)throw Error('Missing team history');return {game_id:g.game_id,home_team:g.home_team,away_team:g.away_team,kickoff_utc:g.kickoff_utc,home_win_probabilities:{v2:g.home_win_probability,team:predictLogistic(expand(f,'team').x,weights.team),qb:predictLogistic(expand(f,'qb').x,weights.qb)},prior_starter_ids:f.extra.prior_qbs,projected_starter_ids:Object.fromEntries([g.home_team,g.away_team].map(t=>[t,g.team_evidence[t].projected_qb_id]))}}),warning:'Challengers failed retrospective promotion gate. Frozen comparison only; QB candidate uses prior-game starter, not projected starter; no bet selection, stake or real-money authorization.'};
}
export function scoreShadowSlate(slate,rows){
 const completed=new Map(completedRows(rows).map(g=>[g.game_id,g])),pending=[],ties=[],results=[];
 for(const g of slate.games){const final=completed.get(g.game_id);if(!final||final.home_team!==g.home_team||final.away_team!==g.away_team){pending.push(g.game_id);continue}if(Number(final.home_score)===Number(final.away_score)){ties.push(g.game_id);continue}results.push({game_id:g.game_id,y:Number(Number(final.home_score)>Number(final.away_score)),...g.home_win_probabilities})}
 return {locked_at_utc:slate.locked_at_utc,scored_games:results.length,ties,pending,metrics:Object.fromEntries(['v2','team','qb'].map(k=>[k,scorePredictions(results.map(r=>({y:r.y,p:r[k]})))]))};
}
if(process.argv[1]?.endsWith('efficiency-shadow.mjs')){
 const [schedule,dir,feedPath,output]=process.argv.slice(2);if(!schedule||!dir||!feedPath||!output)throw Error('Pass schedule CSV, stats directory, V2 snapshot, and new output filename');
 const [scheduleText,feed]=await Promise.all([readFile(schedule,'utf8'),readFile(feedPath,'utf8').then(JSON.parse)]),season=Number(feed.games[0].season);
 const {team,player,sources}=await readEfficiencyFiles(dir,Array.from({length:11},(_,i)=>season-10+i));
 const slate=buildShadowSlate(parseCSV(scheduleText),indexEfficiency(team,player),feed,{sources:[{url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',sha256:createHash('sha256').update(scheduleText).digest('hex')},...sources]});
 await writeFile(output,JSON.stringify(slate,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({locked_at_utc:slate.locked_at_utc,games:slate.games.length,model_digest:slate.model_digest}));
}
