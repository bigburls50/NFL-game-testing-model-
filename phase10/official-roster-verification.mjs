// Free-source verification: GSIS ID and current team must agree with an independently archived official roster.
// A roster match is identity evidence ONLY, never proof of a starting assignment.
export function verifyOfficialRosterCandidates(candidates,officialRoster,{team,sourceUrl,retrievedAt,sourceDigest}={}){
 let host;try{const u=new URL(sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port)host=u.hostname.toLowerCase();}catch{}
 const allowed={IND:'www.colts.com',HOU:'www.houstontexans.com'};
 if(host!==allowed[team]||!sourceDigest?.startsWith('sha256:')||!Number.isFinite(Date.parse(retrievedAt))||!Array.isArray(officialRoster))return {verified:false,reason:'unverified_official_roster_source'};
 const matches=candidates.filter(p=>p.team===team&&p.position==='QB'&&/^00-\\d{7}$/.test(p.player_id)&&officialRoster.some(r=>r.player_name===p.player_name&&r.position==='QB'&&r.team===team));
 return {verified:matches.length===1,reason:matches.length===1?null:'non_unique_or_missing_official_roster_match',matches,source_url:sourceUrl,source_digest:sourceDigest};
}
