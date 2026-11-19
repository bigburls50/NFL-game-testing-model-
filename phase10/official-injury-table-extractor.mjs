// Extract complete player rows from a single, explicitly team-labelled official report table.
// A parsed table is not necessarily a published final report; verification remains separate.
const text=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const cellTags=/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
export function extractOfficialInjuryTables(html){
 if(typeof html!=='string')throw Error('Invalid HTML');
 const tables=[],errors=[];
 for(const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const raw=match[1],tr=[...raw.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(tr.length<2)continue;
  const rows=tr.map(m=>[...m[1].matchAll(cellTags)].map(c=>text(c[1])));
  const headers=rows[0].map(h=>h.toLowerCase());
  const idx=terms=>headers.findIndex(h=>terms.some(t=>h.includes(t)));
  const player=idx(['player']),position=idx(['pos']),injury=idx(['injury']),status=idx(['game status','status']);
  const practice=idx(['practice participation','practice']);
  if(player<0||injury<0||status<0){errors.push({reason:'missing_required_table_columns',headers});continue;}
  const players=[];let invalid=false;
  for(const row of rows.slice(1)){
   if(!row.some(Boolean))continue;
   if(row.length!==headers.length||!row[player]||!row[injury]||!row[status]){invalid=true;break;}
   players.push({player_name:row[player],position:position<0?null:row[position],injury:row[injury],game_status:row[status],practice_status:practice<0?null:row[practice]});
  }
  if(invalid||!players.length){errors.push({reason:'invalid_or_empty_player_rows'});continue;}
  tables.push({players,headers,complete_table_structure:true,report_published_at_utc:null,team:null});
 }
 return {tables,errors,warning:'Table structure alone does not verify team, game, completeness or official publication timestamp.'};
}
