// Parse official NFL injury page HTML into team candidate rows. Fail closed on ambiguity.
const teams={ARI:'Cardinals',ATL:'Falcons',BAL:'Ravens',BUF:'Bills',CAR:'Panthers',CHI:'Bears',CIN:'Bengals',CLE:'Browns',DAL:'Cowboys',DEN:'Broncos',DET:'Lions',GB:'Packers',HOU:'Texans',IND:'Colts',JAX:'Jaguars',KC:'Chiefs',LV:'Raiders',LAC:'Chargers',LAR:'Rams',MIA:'Dolphins',MIN:'Vikings',NE:'Patriots',NO:'Saints',NYG:'Giants',NYJ:'Jets',PHI:'Eagles',PIT:'Steelers',SEA:'Seahawks',SF:'49ers',TB:'Buccaneers',TEN:'Titans',WAS:'Commanders'};
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function parseOfficialInjuryHtml(html,schedule,{publishedAt=null,retrievedAt=new Date().toISOString(),sourceUrl='https://www.nfl.com/injuries/'}={}){
 if(typeof html!=='string'||!Array.isArray(schedule))throw Error('Invalid injury source');
 const rows=[],errors=[];
 const sections=[...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-6]\b|$)/gi)].map(m=>({heading:plain(m[2]),body:plain(m[3])}));
 for(const game of schedule)for(const team of [game.home_team,game.away_team]){
  const label=teams[team];const matches=sections.filter(s=>label&&new RegExp('\\b'+label+'\\b','i').test(s.heading));
  // NFL pages often have repeated team names in navigation: no section is trusted without table context.
  const placeholderObserved=matches.length===1 && /No Injuries Reported/i.test(matches[0].body);
  const candidate={game_id:game.game_id,team,source_url:sourceUrl,published_at_utc:publishedAt,retrieved_at_utc:retrievedAt,players:[],explicit_no_injuries:false,placeholder_observed:placeholderObserved,complete_report:false,source_type:'official_team_or_league',status:'unverified_page_section'};
  rows.push(candidate);
  errors.push({game_id:game.game_id,team,reason:matches.length>1?'ambiguous_team_sections':!publishedAt?'missing_official_report_publication_time':'team_section_not_independently_verified'});
 }
 return {reports:rows,errors,ready_for_forecast:false,warning:'No Injuries Reported may mean no report has been filed. HTML sections are never promoted to complete without an official timestamp and full game-specific report validation.'};
}
