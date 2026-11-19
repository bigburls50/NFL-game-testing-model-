const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function bestMoneylines(game,market,now=Date.now()){
 const date=Date.parse(game.kickoff_utc);if(!Number.isFinite(date)||date<=now)return {};
 const matches=(market?.games??[]).filter(g=>norm(g.home_team)===norm(game.home_team)&&norm(g.away_team)===norm(game.away_team)&&Math.abs(Date.parse(g.commence_time)-date)<3600000);
 if(matches.length!==1)return {};
 const result={};for(const side of ['away','home']){const name=game[side+'_team'];let best=null;for(const book of matches[0].bookmakers??[]){const updated=Date.parse(book.last_update);if(!Number.isFinite(updated)||updated>now+60000||now-updated>30*60000)continue;for(const o of book.outcomes??[]){if(norm(o.name)!==norm(name)||!Number.isInteger(o.price)||Math.abs(o.price)<100)continue;const decimal=o.price>0?1+o.price/100:1+100/Math.abs(o.price);if(!best||decimal>best.decimal)best={price:o.price,book:book.title,decimal,updated:book.last_update}}}if(best)result[side]=best}return result;
}
