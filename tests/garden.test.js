import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fresh,buy,price,sites,restore,rates,advance} from '../src/game.js';
import {ITEMS,ancestors} from '../src/catalog.js';
import {gardenMissing,gardenItemReason,GARDEN_ITEMS} from '../src/garden-data.js';
import {gardenObjects,gardenPlacementReason,gardenGeometryReason,gardenSites,plantGarden,clearGarden,undoGardenClear} from '../src/garden.js';
import {worldScenery,sceneryVisible,canPlace,sceneryObstacle} from '../src/layout.js';
import {natureModel,gardenModel} from '../src/garden-models.js';
import {residentFixture} from '../scripts/resident-fixture.mjs';
import {RESIDENT_LIMIT} from '../src/residents.js';
const empty=()=>{const s=fresh(0);s.counts.V1=4;s.counts.V20=3;s.money=1e6;s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];return s;};
const site=(s,type,ignore)=>gardenSites(s,type,0,ignore).find(p=>!gardenPlacementReason(s,type,p,ignore));
test('garden arrives midgame, remains optional and keeps existing population ceiling',()=>{
 const s=residentFixture();s.play=899;
 assert.ok(gardenMissing(s).includes('前台游玩满 15 分钟'));
 s.play=900;while(s.chunks.overworld.length<4)s.chunks.overworld.push({x:s.chunks.overworld.length+2,z:0});
 assert.equal(gardenMissing(s).length,0);assert.equal(RESIDENT_LIMIT,24);assert.ok(!ancestors('Z3').has('V20'));
 const point=sites(s,'overworld',null,'V20')[0];assert.ok(point);
 const before=s.money;assert.ok(buy(s,'V20',point).ok);assert.equal(before-s.money,12000);
 assert.equal(price(s,ITEMS.V20),60000);assert.ok(buy(s,'V20').ok);assert.equal(price(s,ITEMS.V20),300000);assert.ok(buy(s,'V20').ok);assert.equal(buy(s,'V20').ok,false);
 s.play=0;assert.deepEqual(gardenMissing(s),[]);
});
test('planting is atomic: no charge for invalid land, overlap, missing unlock or insufficient money',()=>{
 const s=empty();s.counts.V20=1;const original=structuredClone(s);
 assert.equal(plantGarden(s,'oak',{x:5,z:5,realm:'overworld'}).ok,false);
 assert.deepEqual(s,original);
 assert.equal(plantGarden(s,'grass',{x:0,z:0,realm:'overworld'}).ok,false);
 assert.deepEqual(s,original);
 const p=site(s,'wildflowers');s.money=149;const snap=structuredClone(s);
 assert.equal(plantGarden(s,'wildflowers',p).ok,false);assert.deepEqual(s,snap);
 s.money=1000;assert.ok(plantGarden(s,'wildflowers',p).ok);assert.equal(s.money,850);
 assert.equal(plantGarden(s,'grass',p).ok,false);assert.equal(s.money,850);
});
test('custom scenery blocks future buildings, moves for free, and keeps identity',()=>{
 const s=empty(),p=site(s,'hedge');const r=plantGarden(s,'hedge',p);assert.ok(r.ok);
 assert.equal(canPlace(s,'V18',p),false);
 const next=gardenSites(s,'hedge',1,r.id).find(p=>!gardenPlacementReason(s,'hedge',p,r.id)),money=s.money;
 assert.ok(plantGarden(s,'hedge',{...next,rotation:1},{moveId:r.id}).ok);
 assert.equal(s.money,money);assert.equal(s.garden.plants.length,1);assert.equal(s.garden.plants[0].id,r.id);
 const o=worldScenery(s).find(p=>p.id===r.id);assert.equal(o.w,.5);assert.equal(o.d,1);
 const box=sceneryObstacle(o)[0];assert.equal(box.maxX-box.minX,.5);assert.equal(box.maxZ-box.minZ,1);
});
test('a cleared coastal natural tree can be undone and cannot be redeemed twice',()=>{
 const s=empty();const tree=gardenObjects(s).find(p=>p.kind==='tree');assert.ok(tree);
 const money=s.money,r=clearGarden(s,tree.id);assert.ok(r.ok);assert.ok(!gardenObjects(s).some(p=>p.id===tree.id));
 assert.ok(undoGardenClear(s,r.undo).ok);assert.ok(gardenObjects(s).some(p=>p.id===tree.id));assert.equal(s.money,money);
 assert.equal(undoGardenClear(s,r.undo).ok,false);assert.equal(clearGarden(s,'missing').ok,false);
});
test('undo does not restore scenery on top of new construction',()=>{
 const s=empty();const tree=gardenObjects(s).find(p=>p.kind==='tree');const r=clearGarden(s,tree.id);
 s.placements.V18={x:tree.x-.4,z:tree.z-.4,realm:'overworld'};s.counts.V18=1;s.layoutRevision++;
 assert.equal(undoGardenClear(s,r.undo).ok,false);assert.ok(s.garden.cleared.includes(tree.id));
});
test('garden save roundtrip preserves plants, natural removals, funds and facilities',()=>{
 const s=residentFixture();s.play=900;
 while(!sites(s,'overworld',null,'V20').length)s.chunks.overworld.push({x:s.chunks.overworld.length+2,z:0});
 assert.ok(buy(s,'V20',sites(s,'overworld',null,'V20')[0]).ok);
 while(!gardenObjects(s).some(p=>p.kind==='tree')){s.chunks.overworld.push({x:s.chunks.overworld.length+3,z:2});s.layoutRevision++;}
 const tree=gardenObjects(s).find(p=>p.kind==='tree');assert.ok(clearGarden(s,tree.id).ok);
 const p=site(s,'wildflowers');assert.ok(plantGarden(s,'wildflowers',p).ok);
 const saved=JSON.parse(JSON.stringify(s)),restored=restore(saved,0),again=restore(restored,0);
 assert.deepEqual(restored.garden.plants,s.garden.plants);assert.deepEqual(restored.garden.cleared,s.garden.cleared);
 assert.deepEqual(restored.placements,s.placements);assert.equal(restored.money,s.money);
 assert.deepEqual(again.garden.plants,restored.garden.plants);assert.deepEqual(again.placements,restored.placements);
 const movedTree=worldScenery(restored).find(p=>p.id===tree.id);assert.equal(sceneryVisible(restored,movedTree),false);
});
test('old saves gain no surprise buildings or new flowers and retain their income',()=>{
 const raw=residentFixture();delete raw.garden;delete raw.counts.V20;
 const loaded=restore(raw,0);assert.equal(loaded.counts.V20,0);assert.deepEqual(loaded.garden.plants,[]);assert.deepEqual(loaded.garden.parcels,[]);
 assert.deepEqual(loaded.placements,raw.placements);assert.equal(loaded.money,raw.money);
 const a=restore(raw,0),b=restore(raw,0);b.counts.V20=1;assert.equal(rates(a).click,rates(b).click);assert.deepEqual(a.community,b.community);
});
test('rocks cannot split a previously traversable path for villagers or large helpers',()=>{
 const s=empty();s.chunks.overworld=[{x:0,z:0},{x:1,z:0}];s.garden.cleared=worldScenery(s).filter(p=>p.kind==='tree').map(p=>p.id);
 // Two buildings leave a narrow north/south route at x=5.5, clear geometry but
 // a planted stone closes the .4-body route. Search asserts this real constraint.
 s.placements.V18={x:4,z:0,realm:'overworld'};s.placements.M1={x:6.8,z:0,realm:'overworld'};s.counts.V18=1;s.counts.M1=1;
 let blocked=null;
 for(const type of ['shrub','stones','hedge'])for(const p of gardenSites(s,type))if(!gardenGeometryReason(s,type,p)&&gardenPlacementReason(s,type,p).includes('通道')){blocked={type,p};break;}
 assert.ok(blocked,'must find a geometrically free site that blocks a path');
 const before=JSON.stringify(s);assert.equal(plantGarden(s,blocked.type,blocked.p).ok,false);assert.equal(JSON.stringify(s),before);
});
test('all twenty-seven scenery models use their declared footprint and grounded geometry',()=>{
 for(const i of GARDEN_ITEMS){const root=natureModel(i.id),box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());assert.ok(size.x<=i.w+.001&&size.z<=i.d+.001,i.id);assert.ok(box.min.y>=-.001&&box.min.y<=.06,i.id);}
 for(const lv of [1,2,3]){const box=new T.Box3().setFromObject(gardenModel(lv)),size=box.getSize(new T.Vector3());assert.ok(size.x<=2&&size.z<=2);}
 const s=empty();assert.ok(gardenItemReason(s,'crimson'));s.counts.N1=1;assert.equal(gardenItemReason(s,'crimson'),'');assert.ok(gardenItemReason(s,'chorus'));
});

test('ground tiles can meet edge to edge, support plants and stay beneath later buildings after reload',()=>{
 const s=empty();const a={x:5,z:5,realm:'overworld'};assert.ok(plantGarden(s,'turf',a).ok);assert.ok(plantGarden(s,'turf',{...a,x:6}).ok);assert.ok(plantGarden(s,'wildflowers',a).ok);
 assert.equal(plantGarden(s,'earth',a).ok,false);const ground=s.garden.plants.find(p=>p.type==='turf');
 assert.deepEqual(sceneryObstacle({...ground,w:1,d:1}),[]);
 const flowers=s.garden.plants.find(p=>p.type==='wildflowers');assert.ok(clearGarden(s,flowers.id).ok);
 assert.equal(canPlace(s,'V18',a),true);s.placements.V18=a;s.counts.V18=1;
 const restored=restore(s,0);assert.equal(restored.garden.plants.length,2);assert.deepEqual(restored.garden.plants,s.garden.plants);
});
test('purchased scenery returns to storage and reuses it without paying or duplicating undo',()=>{
 const s=empty(),p=site(s,'poppy'),first=plantGarden(s,'poppy',p);assert.ok(first.ok);
 const removed=clearGarden(s,first.id);assert.ok(removed.ok);assert.equal(s.garden.stored.poppy,1);
 const money=s.money,second=plantGarden(s,'poppy',p);assert.ok(second.ok);assert.equal(second.cost,0);assert.equal(s.money,money);assert.equal(s.garden.stored.poppy,0);
 assert.equal(undoGardenClear(s,removed.undo).ok,false);assert.equal(s.garden.plants.length,1);
});
test('storage and malformed saved records are handled independently of existing buildings',()=>{
 const s=empty();s.garden.stored={oak:2,unknown:99,stones:-1,grass:Infinity};s.garden.plants=[{id:'planted:1',type:'nope',realm:'overworld',x:5,z:5},{id:'planted:2',type:'grass',realm:'overworld',x:NaN,z:2}];
 const loaded=restore(s,0);assert.deepEqual(loaded.garden.stored,{oak:2});assert.deepEqual(loaded.garden.plants,[]);assert.equal(loaded.money,s.money);
});
