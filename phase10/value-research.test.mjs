import test from 'node:test';import assert from 'node:assert/strict';
import {fitBlendWeight,blendProbability,pickWeeklySingles,summarizeValueBets,chooseValueLeg} from './value-research.mjs';
import {completeQuotePairs,createValueTrial,verifyValueTrial,settleValueTrials} from './value-paper-trial.mjs';
import {buildCausalFeatures} from './learned-matchup.mjs';
const now=Date.parse('2026-11-19T21:00:00Z'),stamp=new Date(now-60000).toISOString(),kickoff='2026-11-20T01:15:00Z',digest='sha256:'+'a'.repeat(64),books=['betmgm_ca_on','betano_ca_on','betrivers_ca_on'];
const p={game_id:'2026_11_IND_HOU',home_team:'Houston Texans',away_team:'Indianapolis Colts',kickoff_utc:kickoff,model_version:'phase10-causal-logistic-v2',model_digest:digest,prediction_created_utc:stamp,status:'provisional',home_win_probability:.75};
const model={model_metadata:{version:p.model_version,digest},predictions:[p]};
const market={status:'available',primary_bookmaker:'betmgm_ca_on',retrieved_at:stamp,source:'test',games:[{home_team:p.home_team,away_team:p.away_team,commence_time:kickoff,bookmakers:books.map((key,i)=>({key,title:key,last_update:stamp,outcomes:[{name:p.home_team,price:i===0?-110:-150},{name:p.away_team,price:i===0?-110:130}]}))}]};
test('blend weight constrained and fits prior evidence, not current game',()=>{const r=Array.from({length:100},(_,i)=>({v2:.9,market:.5,y:i%2}));assert.equal(fitBlendWeight(r),0);assert.equal(blendProbability(.8,.5,0),.5);assert.equal(blendProbability(.8,.5,-1),null)});
test('price evaluation refuses negative EV and allows one selection per game',()=>{assert.equal(chooseValueLeg({home_decimal:1.9,away_decimal:1.9},.5),null);const leg=chooseValueLeg({home_decimal:2,away_decimal:2},.6);assert.equal(leg.side,'home')});
test('weekly simulation caps stakes, settles ties as zero P/L, counts ROI and drawdown',()=>{
 const games=Array.from({length:4},(_,i)=>({game_id:String(i),season:2026,week:1,v2:.7,home_decimal:2,away_decimal:2,y:i===0?null:0}));const picks=pickWeeklySingles(games,'v2');assert.equal(picks.length,3);assert.ok(picks.every(p=>p.stake<=10));const s=summarizeValueBets(picks);assert.equal(s.pushes,1);assert.equal(s.pnl,-20);assert.equal(s.roi,-2/3);assert.equal(s.weekly_drawdown,.02);
});
test('ties opt in for price replay, never change ordinary probability training',()=>{const g={game_id:'x',season:2025,game_type:'REG',gameday:'2025-09-01',home_team:'BUF',away_team:'MIA',home_score:20,away_score:20};assert.equal(buildCausalFeatures([g]).data.length,0);assert.equal(buildCausalFeatures([g],{includeTies:true}).data[0].y,null)});
test('Ontario three-book trial archives exact quotes and excludes execution book from reference',()=>{
 const trial=createValueTrial(model,market,now);assert.equal(trial.eligible_games,1);assert.equal(trial.real_money_stake,0);assert.ok(verifyValueTrial(trial));assert.ok(trial.strategies.v2.tickets[0].stake<=10);const anchor=trial.strategies.market_anchor.tickets[0].legs[0];assert.ok(!anchor.reference_books.includes(anchor.book_key));assert.equal(anchor.reference_books.length,2);
 assert.equal(verifyValueTrial({...trial,locked_at_utc:stamp}),false);
});
test('stale, US or incomplete prices cannot enter locked comparison',()=>{
 const changed=structuredClone(market);changed.games[0].bookmakers[0].last_update=new Date(now-6*60000).toISOString();assert.equal(completeQuotePairs(p,changed,now).length,2);assert.throws(()=>createValueTrial(model,changed,now),/coverage/);
 const us=structuredClone(market);us.games[0].bookmakers[0].key='betmgm';assert.throws(()=>createValueTrial(model,us,now),/coverage/);
});
test('settlement preserves locked stake and prices and ignores nonfinal games',()=>{
 const trial=createValueTrial(model,market,now),final={home_team:p.home_team,away_team:p.away_team,kickoff_utc:kickoff,home_score:24,away_score:10,final:true};
 const pending=settleValueTrials([trial],{},[{...final,final:false}]);assert.equal(pending.summary.v2.pending,1);const settled=settleValueTrials([trial],pending,[final]);assert.equal(settled.summary.v2.won,1);assert.equal(settled.summary.v2.pending,0);assert.equal(settled.slates[trial.slate].v2[0].stake,trial.strategies.v2.tickets[0].stake);assert.deepEqual(settleValueTrials([trial],settled,[{...final,home_score:1}]),settled);
});
