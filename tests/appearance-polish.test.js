import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore, rates } from '../src/game.js';
import { WEB_ITEMS, WEB_BY_ID } from '../src/web-catalog.js';
import { buyWeb, equipWeb, resetWeb } from '../src/presentation.js';
import { appearanceAvailable, tierContents } from '../src/appearance-growth.js';
import { cursorArt, cursorHotspot } from '../src/web-cursors.js';
import { noticeFace } from '../src/notice-face.js';

test('premium desktop themes need the real top-level stall, even with a legacy catalog',()=>{
 const s=fresh();s.counts.X2=1;s.webAppearance.catalogTier=3;s.money=2e7;
 assert.ok(appearanceAvailable(s,WEB_BY_ID['web-theme-end']));
 for(const id of ['web-theme-desktop95','web-theme-macintosh']){
  assert.equal(appearanceAvailable(s,WEB_BY_ID[id]),false);
  const before=s.money;assert.equal(buyWeb(s,id).ok,false);assert.equal(s.money,before);
 }
 s.counts.X2=3;
 for(const id of ['web-theme-desktop95','web-theme-macintosh']){
  const before=s.money,income=rates(s).total;assert.ok(buyWeb(s,id).ok);
  assert.equal(before-s.money,WEB_BY_ID[id].cost);assert.equal(rates(s).total,income);
 }
 const r=restore(s);assert.equal(r.webAppearance.equipped.theme,'web-theme-macintosh');
 r.counts.X2=1;resetWeb(r,'theme');assert.ok(equipWeb(r,'web-theme-macintosh'),'an already owned theme remains usable');
});
test('new collections supplement every original tier instead of displacing its stock',()=>{
 const old=WEB_ITEMS.slice(0,40),split={title:[4,8],icon:[3,6],cursor:[2,4],theme:[0,2],share:[2,4],notice:[1,3]},seen={};
 for(const item of old){const index=seen[item.category]||0;seen[item.category]=index+1;const [a,b]=split[item.category],level=index<a?1:index<b?2:3;
  assert.ok(tierContents(level).some(i=>i.id===item.id));if(level>1)assert.ok(!tierContents(level-1).some(i=>i.id===item.id));
 }
 assert.equal(tierContents(3).length,46);
});
test('cursor assets keep operational hotspots separate from enlarged product pictures',()=>{
 for(const {id} of WEB_ITEMS.filter(i=>i.slot==='cursor')){
  const states=['default','pointer','grab','grabbing'].map(mode=>cursorArt(id,mode));
  assert.equal(new Set(states).size,4,id);
  assert.deepEqual(cursorHotspot(id,'pointer'),[9,0]);assert.deepEqual(cursorHotspot(id,'grab'),[15,14]);assert.deepEqual(cursorHotspot(id,'grabbing'),[15,14]);
  for(const svg of states)assert.match(svg,/width="32" height="32" viewBox="0 0 32 32"/);
 }
});
test('muted narrator retains blinking eyes and uses one pixel X mouth, including outfits',()=>{
 for(const accessory of [null,'date-bow']){const svg=noticeFace('muffled',accessory);assert.match(svg,/data-mouth="x"/);assert.match(svg,/notice-eyes-open/);assert.match(svg,/notice-eyes-closed/);assert.equal((svg.match(/data-mouth=/g)||[]).length,1);}
 assert.doesNotMatch(noticeFace('plain'),/data-mouth="x"/);
});
