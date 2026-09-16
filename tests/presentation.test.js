import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fresh,restore,advance,buy,price,requirements} from '../src/game.js';
import {ITEMS} from '../src/catalog.js';
import {WEB_ITEMS,WEB_BY_ID} from '../src/web-catalog.js';
import {LEGACY_APPEARANCE} from '../src/presentation-migration-map.js';
import {ENV_MODULES,advanceEnvironment,setEnvironment,buyEnvironment} from '../src/environment.js';
import {environmentLight,windowGlowMatrix} from '../src/atmosphere.js';
import {cursorArt,badgeArt,titleArt} from '../src/web-art.js';
import {cursorHotspot} from '../src/web-cursors.js';
import {observatory} from '../src/observatory-model.js';
import {presentationForSnapshot} from '../src/presentation.js';

test('all legacy goods retain their own entitlements without wallet or position changes',()=>{
 for(const row of LEGACY_APPEARANCE){
  const raw=fresh();raw.version=6;delete raw.webAppearance;delete raw.scenery;delete raw.environment;
  raw.counts.X2=1;raw.counts.L2=1;raw.money=12345;
  raw.collection={version:2,owned:{[row.old]:true,'unknown-future-item':true},equipped:{},disabled:{}};
  const s=restore(raw);assert.equal(s.money,raw.money,row.old);assert.equal(s.counts.V19,0);
  if(row.domain==='web')for(const id of row.grant)assert.ok(s.webAppearance.owned[id],row.old);
  if(row.domain==='environment') {assert.ok(s.environment.access.pending,row.old);for(const id of row.grant)assert.ok(id.startsWith('legacy-')?s.environment.palettes.includes(id):s.environment.modules[id],row.old);}
  if(row.domain==='scenery'&&row.old!=='garden')assert.ok(s.scenery.owned[row.old],row.old);
  assert.ok(s.legacyCollection.owned['unknown-future-item']);
  const r=restore(s);for(const key of ['webAppearance','scenery','environment','money','studio','placements'])assert.deepEqual(r[key],s[key],row.old+':'+key);
 }
});
test('legacy environment is usable and pending observatory has no repayment or prerequisites',()=>{
 const raw=fresh();raw.version=6;delete raw.webAppearance;delete raw.environment;delete raw.scenery;
 raw.collection={version:2,owned:{'world-snow':true,'world-weather':true},equipped:{},disabled:{'world-snow':true}};
 const s=restore(raw);assert.equal(s.environment.enabled['env-snow'],false);assert.equal(price(s,ITEMS.V19),0);assert.deepEqual(requirements(s,ITEMS.V19),[]);
 assert.equal(s.counts.V19,0);assert.equal(buy(s,'V19').ok,false,'placement is still required');
});
test('weather and observation never change production or emit world events',()=>{
 const a=fresh();a.counts.V18=1;a.counts.V2=2;a.money=1000;
 const b=structuredClone(a);b.counts.V19=1;
 for(const i of ENV_MODULES){b.environment.modules[i.id]=true;b.environment.enabled[i.id]=true;}
 b.environment.enabled.stars=b.environment.enabled.meteor=true;b.environment.phase=.01;b.environment.cycle=false;b.environment.weather='snow';
 advance(a,400);advance(b,400);
 for(const key of ['money','total','live','harvest','events','transport','project','ordersCompleted'])assert.deepEqual(b[key],a[key],key);
 assert.ok(b.environment.seen.includes('snow'));assert.ok(b.environment.seen.includes('meteor'));
});
test('seeded automatic weather survives a save and resumes the same sequence',()=>{
 const a=fresh();a.counts.V19=1;a.money=10000;for(const i of ENV_MODULES)buyEnvironment(a,i.id);
 setEnvironment(a,{auto:true});advanceEnvironment(a,175);const b=restore(a);
 for(let i=0;i<20;i++){advanceEnvironment(a,180);advanceEnvironment(b,180);assert.deepEqual(a.environment,b.environment);}
});
test('observatory and all purchased instruments fit their real 1.5 square plot',()=>{
 for(const full of [false,true]){const s=fresh();if(full)for(const i of ENV_MODULES)s.environment.modules[i.id]=true;
 const g=new T.Group();observatory(g,s);g.updateMatrixWorld(true);const box=new T.Box3().setFromObject(g),size=box.getSize(new T.Vector3());
 assert.ok(size.x<=1.26&&size.z<=1.26,JSON.stringify(size));assert.ok(box.min.y>=0);assert.ok(size.y<1.5);}
});
test('ten cursor operation assets have unique geometry, exact tip, and distinct interactive states',()=>{
 const all=WEB_ITEMS.filter(i=>i.slot==='cursor'),normal=new Set(),active=new Set();
 for(const i of all){const art=cursorArt(i.id),hover=cursorArt(i.id,true);assert.match(art,/viewBox="0 0 32 32"/);assert.deepEqual(cursorHotspot(i.id),i.id==='web-cursor-glove'?[9,0]:[0,0]);if(i.id!=='web-cursor-glove')assert.match(art,/M0[ ,]0/);assert.notEqual(art,hover);normal.add(art);active.add(hover);}
 assert.equal(normal.size,10);assert.equal(active.size,10);
 assert.equal(new Set(WEB_ITEMS.filter(i=>i.slot==='icon').map(i=>badgeArt(i.id))).size,8);
 assert.equal(new Set(WEB_ITEMS.filter(i=>i.slot==='title').map(i=>titleArt(i.id))).size,12);
});
test('daylight and moonlight keep continuous intensity and enough ambient light',()=>{
 let prev=environmentLight(0);for(let i=1;i<=4800;i++){const l=environmentLight((i/4800)%1);assert.ok(l.hemi>=1.25);assert.ok(Math.abs(l.sun-prev.sun)<.08);assert.ok(Math.abs(l.night-prev.night)<.01);prev=l;}
});
test('legacy victory renderer adapter never rewrites its source snapshot',()=>{
 const source=fresh();source.version=6;delete source.webAppearance;delete source.scenery;delete source.environment;
 source.collection.owned['frame-2']=true;source.collection.equipped.frame='frame-2';const before=JSON.stringify(source);
 const view=presentationForSnapshot(source);assert.equal(JSON.stringify(source),before);assert.equal(view.webAppearance.equipped.theme,'web-theme-end');assert.notEqual(view,source);
});

test('night window light follows its owner rotation instead of the world Z axis',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const parent=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1));parent.rotation.y=angle;parent.position.set(3,.16,-2);mesh.position.set(.2,.85,.487);mesh.scale.set(.2,.24,.018);parent.add(mesh);parent.updateMatrixWorld(true);
 const m=windowGlowMatrix(mesh),local=mesh.matrixWorld.clone().invert().multiply(m);
 const p=new T.Vector3().setFromMatrixPosition(local);assert.ok(Math.abs(p.x)<1e-8&&Math.abs(p.z-.62)<1e-8);
 const normal=new T.Vector3(0,0,1).transformDirection(m),expected=new T.Vector3(0,0,1).transformDirection(mesh.matrixWorld);assert.ok(normal.dot(expected)>.9999);}
});
