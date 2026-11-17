import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
test('Android install manifest is standalone, scoped, and has both required icon sizes',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.equal(m.display,'standalone');
 assert.ok(m.start_url&&m.scope&&m.id);
 assert.ok(m.start_url.startsWith(m.scope),'start URL outside app scope');
 for(const size of ['192x192','512x512']){
  const icon=m.icons.find(x=>x.sizes.split(/\\s+/).includes(size)&&x.type==='image/png');
  assert.ok(icon,'missing '+size+' icon');
  const relative=icon.src.replace(/^\\//,'');
  assert.ok(fs.existsSync(new URL(relative,root)),'icon asset absent: '+relative);
 }
});
test('offline app shell and service worker lifecycle exist',()=>{
 const sw=read('sw.js'),html=read('index.html');
 for(const asset of ['index.html','manifest.webmanifest','icon-192.png','icon-512.png'])assert.ok(sw.includes(asset),'missing precache: '+asset);
 for(const event of ['install','activate','fetch'])assert.ok(sw.includes(event),'missing SW event '+event);
 assert.match(sw,/caches\\.match/);
 assert.match(html,/navigator\\.serviceWorker|serviceWorker/);
});
test('research UI explicitly warns against verified-live odds and real-money execution',()=>{
 const html=read('index.html');
 assert.match(html,/paper betting only|paper-only|paper research only/i);
 assert.match(html,/NOT verified Ontario|NOT confirmed Ontario|not live/i);
 assert.match(html,/unvalidated|experimental/i);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:\\/\\//i,'remote executable script violates offline audit');
});
