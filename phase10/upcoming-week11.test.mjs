import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync(new URL('./upcoming-week11-2026.json',import.meta.url),'utf8'));
const html=fs.readFileSync(new URL('../upcoming.html',import.meta.url),'utf8');
test('verified Week 11 fixture manifest has 13 unique matchups and kickoff instants',()=>{
 assert.equal(manifest.season,2026);assert.equal(manifest.week,11);assert.equal(manifest.schedule_verified,true);
 assert.equal(manifest.games.length,13);
 assert.equal(new Set(manifest.games.map(g=>g.game_id)).size,13);
 for(const g of manifest.games){assert.equal(g.season,2026);assert.equal(g.week,11);assert.notEqual(g.home_team,g.away_team);assert.match(g.kickoff_utc,/^2026-11-\d{2}T\d{2}:\d{2}:\d{2}Z$/);assert.ok(Number.isFinite(Date.parse(g.kickoff_utc)));}
});
test('upcoming UI fails closed when model forecasts have not been verified',()=>{
 assert.equal(manifest.model_forecasts_verified,false);
 assert.match(html,/model_forecasts_verified!==false/);
 assert.match(html,/Model forecast: unavailable/);
 assert.match(html,/13 abstentions/);
 assert.doesNotMatch(html,/home_win_probability/);
});
test('upcoming fixture schedule uses NFL corrected kickoff times',()=>{
 const byId=new Map(manifest.games.map(g=>[g.game_id,g.kickoff_utc]));
 assert.equal(byId.get('2026_11_PIT_PHI'),'2026-11-22T18:00:00Z');
 assert.equal(byId.get('2026_11_JAX_NYG'),'2026-11-22T21:25:00Z');
 assert.equal(byId.get('2026_11_IND_HOU'),'2026-11-20T01:15:00Z');
});
