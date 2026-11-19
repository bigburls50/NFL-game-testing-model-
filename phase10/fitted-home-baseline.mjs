// Transparent fitted prior-season home-field baseline, NOT a team-strength model.
// Fits only completed games before the target season; no future-score leakage.
import {createHash} from 'node:crypto';
export function fitHomeWinBaseline(rows,{targetSeason,minGames=100}={}){
 const eligible=rows.filter(r=>Number(r.season)<targetSeason&&Number.isInteger(Number(r.home_score))&&Number.isInteger(Number(r.away_score))&&Number(r.home_score)!==Number(r.away_score));
 if(eligible.length<minGames)throw Error('Insufficient prior-season training games');
 const wins=eligible.filter(r=>Number(r.home_score)>Number(r.away_score)).length;
 const p=(wins+1)/(eligible.length+2);
 const signature=eligible.map(r=>[r.game_id,r.season,r.home_score,r.away_score].join(':')).sort().join('|');
 const digest='sha256:'+createHash('sha256').update(signature).digest('hex');
 return {model_version:'phase10-home-baseline-v1',model_digest:digest,training_games:eligible.length,training_last_season:Math.max(...eligible.map(r=>Number(r.season))),predict:()=>({home_win_probability:p,model_version:'phase10-home-baseline-v1',model_digest:digest}),warning:'Fitted prior-season home-win baseline only. Not a team-specific or validated betting model.'};
}
