// Official NFL final-injury publication evidence is independent of a parsed HTML table.
// Never infer publication time from retrieval time or provider status_date.
export function certifyOfficialInjuryReport({game,team,players,sourceUrl,sourceDigest,publishedAt,retrievedAt,teamSectionVerified=false,gameSectionVerified=false,reportDateVerified=false,completeReportVerified=false}={}){
 const reject=reason=>({verified:false,reason});
 if(!game||![game.home_team,game.away_team].includes(team))return reject('team_game_mismatch');
 let u;try{u=new URL(sourceUrl)}catch{return reject('invalid_source')}
 if(u.protocol!=='https:'||!['nfl.com','www.nfl.com'].includes(u.hostname)||u.username||u.password||u.port)return reject('untrusted_source');
 const pub=Date.parse(publishedAt),got=Date.parse(retrievedAt),kick=Date.parse(game.kickoff_utc);
 if(!Number.isFinite(pub)||!Number.isFinite(got)||!Number.isFinite(kick)||pub>got||got>=kick)return reject('unverified_publication_time');
 if(!sourceDigest?.startsWith('sha256:')||!teamSectionVerified||!gameSectionVerified||!reportDateVerified||!completeReportVerified)return reject('incomplete_source_provenance');
 if(!Array.isArray(players)||!players.length||!players.every(p=>p.player_name&&p.injury&&p.practice_status&&p.game_status))return reject('incomplete_player_rows');
 return {verified:true,game_id:game.game_id,team,players,source_url:sourceUrl,source_digest:sourceDigest,published_at_utc:publishedAt,retrieved_at_utc:retrievedAt,source_type:'official_team_or_league',complete_report:true,team_section_verified:true,game_section_verified:true,report_date_verified:true};
}
