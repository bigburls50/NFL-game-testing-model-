#!/usr/bin/env node
// Walk-forward, opponent-adjusted scoring model. Features strictly from earlier dates.
import fs from 'node:fs';
import {parseCSV} from './baseline.mjs';
const sigmoid=x=>1/(1+Math.exp(-x));
export function predictMatchups(rows,{lookback=8,shrink=4,homePoints=1.5,scale=12}={}){
 if(!Number.isInteger(lookback)||lookback<1||shrink<=0||scale<=0)throw Error('Invalid settings');
 const games=[...rows].sort((a,b)=>a.gameday.localeCompare(b.gameday)||a.game_id.localeCompare(b.game_id));
 const history=new Map(),result=[],ids=new Set();
 for(let i=0;i<games.length;){const date=games[i].gameday, batch=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
 while(i<games.length&&games[i].gameday===date){const g=games[i++];if(ids.has(g.game_id)||!g.game_id)throw Error('Duplicate/missing game ID');ids.add(g.game_id);const hs=Number(g.home_score),as=Number(g.away_score);if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||!g.home_team||!g.away_team||g.home_team===g.away_team)throw Error('Invalid game');batch.push({g,hs,as})}
 const rating=team=>{const h=(history.get(team)??[]).slice(-lookback);const n=h.length;return {attack:h.reduce((a,v)=>a+v.scored-22,0)/(n+shrink),defense:h.reduce((a,v)=>a+22-v.allowed,0)/(n+shrink),n}};
 for(const {g,hs,as} of batch){const home=rating(g.home_team),away=rating(g.away_team);const margin=homePoints+home.attack+home.defense-away.attack-away.defense;const p=sigmoid(margin/scale);if(hs!==as)result.push({game_id:g.game_id,season:Number(g.season),kickoff_date:date,home_team:g.home_team,away_team:g.away_team,home_score:hs,away_score:as,home_win_probability:p,home_prior_games:home.n,away_prior_games:away.n,projected_margin:margin})}
 for(const {g,hs,as} of batch){history.set(g.home_team,[...(history.get(g.home_team)??[]),{scored:hs,allowed:as}]);history.set(g.away_team,[...(history.get(g.away_team)??[]),{scored:as,allowed:hs}])}
 }return result}
if(process.argv[1]?.endsWith('matchups.mjs')){try{const input=process.argv[2]??'phase10/data/historical-games.csv',output=process.argv[3]??'phase10/data/matchup-predictions.csv';const results=predictMatchups(parseCSV(fs.readFileSync(input,'utf8'))),keys=['game_id','season','kickoff_date','home_team','away_team','home_score','away_score','home_win_probability','home_prior_games','away_prior_games','projected_margin'];fs.writeFileSync(output,[keys.join(','),...results.map(r=>keys.map(k=>r[k]).join(','))].join('\n')+'\n');const n=results.length;console.log(JSON.stringify({predictions:n,accuracy:results.filter(r=>(r.home_win_probability>=.5)===(r.home_score>r.away_score)).length/n,brier:results.reduce((a,r)=>a+(r.home_win_probability-Number(r.home_score>r.away_score))**2,0)/n,warning:'Fixed-parameter exploratory model; no quarterback, EPA, injury, or market features yet.'},null,2))}catch(e){console.error(e.message);process.exitCode=1}}
