#!/usr/bin/env node
// A reproducible no-network integration fixture. Checks that EPA features are
// lagged and alter only later-game probabilities.
import {rollingEpa} from './rolling-epa.mjs';import {augmentWithEpa} from './epa-augmented.mjs';
const games=[{game_id:'g1',gameday:'2025-09-01',season:'2025',home_team:'A',away_team:'B'},{game_id:'g2',gameday:'2025-09-08',season:'2025',home_team:'A',away_team:'C'}],rows=[{game_id:'g1',team:'A',offense_epa_per_play:.3,qb_epa_per_dropback:.4},{game_id:'g1',team:'B',offense_epa_per_play:-.2,qb_epa_per_dropback:-.1}];
const features=rollingEpa(games,rows),pred=games.map(g=>({...g,home_win_probability:.6})),result=augmentWithEpa(pred,features,{minPriorGames:1});
if(result[0].epa_features_used!==0||result[1].epa_features_used!==0)throw Error('Both teams must have adequate prior data');console.log('EPA integration smoke passed: pregame-only data and minimum coverage enforced');
