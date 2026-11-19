import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV} from './baseline.mjs';
import {eloPredict} from './elo.mjs';
import {predictMatchups} from './matchups.mjs';
import {buildCausalFeatures,completedRows,fitLogistic,predictLogistic,scorePredictions,noVigProbability,LEARNED_VERSION,FEATURE_NAMES} from './learned-matchup.mjs';

export function evaluate(rows,{firstSeason=2016,holdout=[2025,2026],development=[2023,2024]}={}){
 const data=completedRows(rows).filter(g=>Number(g.season)>=firstSeason),features=buildCausalFeatures(data).data;
 const incumbentElo=new Map(eloPredict(data).map(g=>[g.game_id,g.home_win_probability])),incumbentMatchup=new Map(predictMatchups(data).map(g=>[g.game_id,g.home_win_probability]));
 const records=[],bySeason={};for(const season of [...development,...holdout]){const train=features.filter(g=>g.season<season&&g.season>firstSeason);const weights=fitLogistic(train);const tests=features.filter(g=>g.season===season);const evaluated=tests.map(g=>({...g,incumbent:(incumbentElo.get(g.game_id)+incumbentMatchup.get(g.game_id))/2,learned:predictLogistic(g.x,weights),market:noVigProbability(g.home_moneyline,g.away_moneyline)}));records.push(...evaluated);bySeason[season]={training_games:train.length,...metrics(evaluated)}}
 const dev=metrics(records.filter(r=>development.includes(r.season))),test=metrics(records.filter(r=>holdout.includes(r.season)));
 // Predeclared screen: candidate must improve probability scoring on BOTH development and holdout;
 // no sacrifice in aggregate winner accuracy greater than one percentage point.
 const passes=m=>m.learned.brier<m.incumbent.brier&&m.learned.log_loss<m.incumbent.log_loss&&m.learned.accuracy>=m.incumbent.accuracy-.01;
 const selected=passes(dev)&&passes(test);
 return {model_version:LEARNED_VERSION,features:FEATURE_NAMES,source:'nflverse schedule games.csv',history_first_season:firstSeason,history_last_date:data.at(-1)?.gameday,history_games:data.length,data_digest:'sha256:'+createHash('sha256').update(JSON.stringify(data.map(g=>[g.game_id,g.gameday,g.home_score,g.away_score,g.location,g.home_rest,g.away_rest,g.home_moneyline,g.away_moneyline]))).digest('hex'),development_seasons:development,holdout_seasons:holdout,development:dev,holdout:test,by_season:bySeason,promotion_gate:{passed:selected,requirements:'Lower Brier and log loss in both splits, no more than 1pp accuracy loss in either split.'},warning:'Retrospective walk-forward, entire season holdouts with earlier-season fitting. Historical odds timestamps and trade execution not verified. No claims of gambling profitability.'};
}
function metrics(records){const evalModel=key=>scorePredictions(records.map(({y,...r})=>({y,p:r[key]})));const market=records.filter(r=>r.market!==null);return {incumbent:evalModel('incumbent'),learned:evalModel('learned'),market_on_available_subset:scorePredictions(market.map(r=>({y:r.y,p:r.market}))),learned_on_market_subset:scorePredictions(market.map(r=>({y:r.y,p:r.learned}))),incumbent_on_market_subset:scorePredictions(market.map(r=>({y:r.y,p:r.incumbent})))}}
if(process.argv[1]?.endsWith('evaluate-learned-matchup.mjs')){const file=process.argv[2];if(!file)throw Error('Pass local nflverse games.csv');const report=evaluate(parseCSV(await readFile(file,'utf8')));console.log(JSON.stringify(report,null,2));if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n')}
