const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function moneylinesByBook(game,market,now=Date.now()){
 const date=Date.parse(game.kickoff_utc);if(!Number.isFinite(date)||date<=now)return {};
 const matches=(market?.games??[]).filter(g=>norm(g.home_team)===norm(game.home_team)&&norm(g.away_team)===norm(game.away_team)&&Math.abs(Date.parse(g.commence_time)-date)<3600000);
 if(matches.length!==1)return {};
 const result={};for(const side of ['away','home']){const name=game[side+'_team'],quotes=new Map();for(const book of matches[0].bookmakers??[]){const updated=Date.parse(book.last_update),key=book.key??book.title;if(!key||!book.title||!Number.isFinite(updated)||updated>now+60000||now-updated>30*60000)continue;for(const o of book.outcomes??[]){if(norm(o.name)!==norm(name)||!Number.isInteger(o.price)||Math.abs(o.price)<100)continue;const decimal=o.price>0?1+o.price/100:1+100/Math.abs(o.price);if(!quotes.has(key)||decimal>quotes.get(key).decimal)quotes.set(key,{price:o.price,book:book.title,bookKey:key,decimal,updated:book.last_update})}}result[side]=[...quotes.values()].sort((a,b)=>b.decimal-a.decimal)}return result;
}
export function bestMoneylines(game,market,now=Date.now()){const q=moneylinesByBook(game,market,now),result={};for(const side of ['away','home'])if(q[side]?.length)result[side]=q[side][0];return result}
