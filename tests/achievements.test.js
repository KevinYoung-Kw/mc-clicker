import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,checkAchievements,advance,buy,mine} from '../src/game.js';
import {ACHIEVEMENT_DEFS,ACHIEVEMENTS,achievementProgress} from '../src/achievements.js';
import {achievementsMarkup,createAchievementFeedback} from '../src/achievements-ui.js';
import {newResident,ensureCommunity,assignJob} from '../src/residents.js';
import {setLifeMenu,advanceMenu} from '../src/life-menu.js';
import {buildCivic,civicSites} from '../src/civic-sites.js';
import {foodState,advanceFood,takeMeal} from '../src/food-service.js';
import {CATALOG} from '../src/catalog.js';
import {WEB_ITEMS} from '../src/web-catalog.js';
import {COLLECTION} from '../src/collection.js';
import {ENV_MODULES} from '../src/environment.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';

test('every badge has a unique ID, concrete condition and one shared progress predicate',()=>{
 assert.equal(new Set(ACHIEVEMENT_DEFS.map(a=>a.id)).size,ACHIEVEMENT_DEFS.length);
 const s=fresh();for(const a of ACHIEVEMENT_DEFS){assert.ok(a.description.length>0,a.id);const p=achievementProgress(s,a);assert.ok(p.total>0);assert.equal(p.complete,false,a.id);assert.equal(ACHIEVEMENTS.find(([id])=>id===a.id)[2](s),false);}
 assert.equal(ACHIEVEMENT_DEFS.length,30);
});
test('historical purchase achievements retain their exact IDs and thresholds',()=>{
 const s=fresh();s.money=1e6;mine(s);assert.ok(s.achievements.includes('first'));
 assert.ok(buy(s,'T1').ok);assert.ok(buy(s,'V1').ok);checkAchievements(s);assert.ok(!s.achievements.includes('land'));
 s.counts.M8=1;s.counts.M17=1;s.total=1e8;s.live.peak=1000;checkAchievements(s);
 for(const id of ['automatic','rail','wealth','audience'])assert.ok(s.achievements.includes(id),id);
});
test('small homes is a reversible layout challenge, not a forever missed early-game condition',()=>{
 const s=fresh();s.counts.V2=6;s.counts.M9=5;ensureCommunity(s);
 s.housing.homes=Array.from({length:6},(_,i)=>({id:`home:${i+1}`,type:['oak','hearth','cottage'][i%3]}));
 s.housing.assignments=Object.fromEntries(s.community.residents.map((r,i)=>[r.id,{homeId:`home:${i+1}`,unit:1}]));
 assert.ok(achievementProgress(s,'small-homes').complete);
 s.housing.homes[0].type='tower';assert.equal(achievementProgress(s,'small-homes').complete,false);
 s.housing.homes[0].type='oak';s.community.residents.push(newResident(6));assert.equal(achievementProgress(s,'small-homes').complete,false);
 s.community.residents.pop();checkAchievements(s);s.housing.homes=[];
 const restored=restore(s);assert.ok(restored.achievements.includes('small-homes'));assert.ok(!achievementProgress(restored,'small-homes').complete);
});
test('earned records survive JSON and packed save even after layout changes; invalid IDs never count',()=>{
 const s=fresh();s.achievements=['small-homes','three-world-garden','small-homes','unknown',{},'__proto__'];
 const before=s.money,r=restore(JSON.parse(JSON.stringify(s)));assert.deepEqual(r.achievements,['small-homes','three-world-garden']);assert.equal(r.money,before);
 const decoded=decodeSave(encodePersistentSave(r,'test')).save,out=restore(decoded);
 assert.deepEqual(out.achievements,r.achievements);advance(out,1);assert.ok(out.achievements.includes('small-homes'));
});
test('three farms requires constructed locations and distinct actual assignments, not three names on one plot',()=>{
 const s=fresh();s.money=1e8;s.counts={V1:9,V2:3,V4:6,V3:3,M4:3};s.chunks.overworld=Array.from({length:9},(_,i)=>({x:i%3-1,z:Math.floor(i/3)-1}));s.placements.V4={x:-3,z:1,realm:'overworld'};ensureCommunity(s);
 for(let i=0;i<2;i++){const site=civicSites(s,'V4')[0];assert.ok(site);assert.ok(buildCivic(s,'V4',site).ok);}
 for(const r of s.community.residents)assert.ok(assignJob(s,r.id,'farmer').ok);
 assert.ok(achievementProgress(s,'three-farms').complete);
 s.life.sites[0].stored=true;assert.equal(achievementProgress(s,'three-farms').complete,false);
 s.life.sites[0].stored=false;s.community.residents.forEach(r=>r.farmSiteId='V4');assert.equal(achievementProgress(s,'three-farms').value,1);
});
test('garden challenges ignore duplicates, storage, ground and souvenirs',()=>{
 const s=fresh();s.garden.stored={oak:20,crimson:20,chorus:20};assert.equal(achievementProgress(s,'three-world-garden').value,0);
 s.garden.plants=['oak','crimson','chorus'].map(type=>({type,realm:'overworld'}));assert.ok(achievementProgress(s,'three-world-garden').complete);
 s.garden.plants[2].realm='end';assert.equal(achievementProgress(s,'three-world-garden').value,2);
 s.garden.plants=Array.from({length:8},()=>({type:'turf',realm:'overworld'}));assert.equal(achievementProgress(s,'garden-eight').value,0);
});
test('meal and brewery awards require service execution, not choosing a button or an empty village',()=>{
 const s=fresh();s.money=1e8;s.counts={V2:1,V22:2,V25:2};ensureCommunity(s);
 assert.ok(setLifeMenu(s,'drink','ale').ok);assert.equal(achievementProgress(s,'local-brewery').complete,false);
 const before=s.money;advanceMenu(s,1);assert.ok(s.money<before);assert.ok(achievementProgress(s,'local-brewery').complete);
 assert.ok(setLifeMenu(s,'meal','roast').ok);assert.equal(achievementProgress(s,'hot-meal').complete,false);
 s.placements.V25={x:0,z:0,realm:'overworld'};const food=foodState(s);advanceFood(s,100);food.people[s.community.residents[0].id]={next:food.clock,missed:0,lastMeal:null};assert.ok(takeMeal(s,s.community.residents[0]));assert.ok(achievementProgress(s,'hot-meal').complete);
 s.community.residents=[];assert.equal(achievementProgress(s,'local-brewery').complete,false);
});
test('collection completion uses actual bundle ownership and never requires a removed purchase',()=>{
 const s=fresh();for(const i of CATALOG)if(!['X3','X4','X5','X6','X8'].includes(i.id))s.counts[i.id]=1;
 assert.equal(achievementProgress(s,'all-buildings').complete,false);
 for(const i of WEB_ITEMS)s.webAppearance.owned[i.id]=true;
 for(const i of COLLECTION)if(i.slot==='flag')s.scenery.owned[i.id]=true;
 for(const i of ENV_MODULES)s.environment.modules[i.id]=true;
 const before=JSON.stringify(s);assert.ok(achievementProgress(s,'all-buildings').complete);assert.equal(JSON.stringify(s),before);
 checkAchievements(s);assert.ok(s.achievements.includes('all-buildings'));
});
test('full achievement completion requires every other known badge, including niche challenges',()=>{
 const s=fresh();s.achievements=ACHIEVEMENT_DEFS.filter(a=>!['all-achievements','small-homes'].includes(a.id)).map(a=>a.id);
 checkAchievements(s);assert.ok(!s.achievements.includes('all-achievements'));s.achievements.push('small-homes');checkAchievements(s);assert.ok(s.achievements.includes('all-achievements'));
 const length=s.achievements.length;checkAchievements(s);assert.equal(s.achievements.length,length);
});
test('filters show descriptions and accessible progress; completed rows can be hidden',()=>{
 const s=fresh();s.achievements=['small-homes'];const html=achievementsMarkup(s,{group:'challenge',pending:true});
 assert.ok(!html.includes('data-achievement="small-homes"'));assert.ok(html.includes('data-achievement="three-farms"'));assert.ok(html.includes('3 位农民'));assert.ok(html.includes('role="progressbar"'));
 assert.ok(!html.includes('data-achievement="first"'));assert.ok(achievementsMarkup(s,{group:'challenge'}).includes('data-housing-open'));
});
test('feedback batches new badges without replaying restored saves or interrupting action receipts',()=>{
 const s=fresh();s.counts.X1=1;s.play=180;const feedback=createAchievementFeedback(s);s.achievements.push('first','land');assert.equal(feedback(s,{busy:true}),null);
 assert.match(feedback(s).text,/2 枚/);assert.equal(feedback(s),null);assert.equal(feedback(restore(s)),null);
});
