import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,buy,frontier,restore,move,sites} from '../src/game.js';
import {landPrice,landMarketPrice,landPurchaseCount,storedLandCount} from '../src/land.js';
import {storeLand,undoStoreLand,landRemovalReason} from '../src/land-management.js';
import {worldScenery,footprint,buildingObstacles,canPlace,localPoint} from '../src/layout.js';
import {clearGarden,plantGarden,gardenSites} from '../src/garden.js';
import {editingPreference,setEditingPreference,repeatPlacement,editingUndoAvailable} from '../src/editing.js';
import {outdoorPreview} from '../src/construction-preview.js';
import {Box3,Vector3} from 'three';
function island(){const s=fresh(42);s.counts.T1=1;s.money=1e10;buy(s,'V1',{x:0,z:0,realm:'overworld'});buy(s,'V1',{x:1,z:0,realm:'overworld'});return s;}
const right={x:1,z:0,realm:'overworld'};
test('stored land reuses a paid parcel without discounting historical prices or granting repeat progression',()=>{
 const s=island(),paid=landPurchaseCount(s),quote=landMarketPrice(s),before=s.money,count=s.counts.V1;
 const removed=storeLand(s,right);assert.equal(removed.ok,true,removed.reason);assert.equal(s.money,before);assert.equal(landPrice(s),0);assert.equal(storedLandCount(s),1);
 assert.equal(editingUndoAvailable(s,{family:'land',token:removed}),true);
 const restored=restore(structuredClone(s));assert.equal(storedLandCount(restored),1);assert.equal(landPurchaseCount(restored),paid);
 const result=buy(restored,'V1',{x:0,z:1,realm:'overworld'});assert.equal(result.ok,true,result.reason);assert.equal(result.cost,0);assert.equal(restored.money,before);assert.equal(restored.counts.V1,count);assert.equal(landMarketPrice(restored),quote);assert.equal(landPrice(restored),quote);
 assert.equal(undoStoreLand(restored,removed).ok,false);assert.equal(storedLandCount(restored),0);
 assert.equal(editingUndoAvailable(restored,{family:'land',token:removed}),false);
});
test('garden undo disappears after stored stock is used or the natural object is restored',()=>{
 const s=island();s.counts.V20=3;s.garden.cleared=worldScenery(s).filter(p=>p.native).map(p=>p.id);
 const site=gardenSites(s,'hedge')[0],built=plantGarden(s,'hedge',site);assert.equal(built.ok,true);
 const result=clearGarden(s,built.id),undo={family:'garden',token:result.undo};assert.equal(editingUndoAvailable(s,undo),true);
 assert.equal(plantGarden(s,'hedge',site).ok,true);assert.equal(editingUndoAvailable(s,undo),false);
 const natural={family:'garden',token:{id:s.garden.cleared[0]}};assert.equal(editingUndoAvailable(s,natural),true);
 s.garden.cleared.shift();assert.equal(editingUndoAvailable(s,natural),false);
});
test('cleared natural scenery remains cleared through storage, relocation and loading',()=>{
 const s=island();s.counts.V20=1;
 const old=worldScenery(s).filter(p=>p.native&&Math.round(p.x/5)===1),target=old[0];assert.equal(clearGarden(s,target.id).ok,true);
 const removed=storeLand(s,right);assert.equal(removed.ok,true,removed.reason);
 assert.equal(buy(s,'V1',{x:0,z:1,realm:'overworld'}).ok,true);
 const loaded=restore(structuredClone(s));const after=worldScenery(loaded).filter(p=>p.id.startsWith('parcel:overworld:0:1:'));
 assert.equal(after.length,old.length);assert.ok(loaded.garden.cleared.includes(after[0].id));
 assert.deepEqual(after.map(p=>[Number(p.x.toFixed(4)),Number((p.z-5).toFixed(4)),p.kind,p.type]),old.map(p=>[Number((p.x-5).toFixed(4)),Number(p.z.toFixed(4)),p.kind,p.type]));
});
test('storing rejects core, bridges, facility edges, homes, bought scenery and passing cargo without mutation',()=>{
 const s=island();const reject=site=>{const before=structuredClone(s);const result=storeLand(s,site);assert.equal(result.ok,false);assert.deepEqual(s,before);return result.reason;};
 assert.match(reject({x:0,z:0,realm:'overworld'}),/起始/);
 buy(s,'V1',{x:2,z:0,realm:'overworld'});assert.match(reject(right),/另一侧/);s.chunks.overworld.pop();s.layoutRevision++;
 s.placements.M1={x:2,z:0,realm:'overworld',rotation:1};s.layoutRevision++;assert.match(reject(right),/设施|矿区/);delete s.placements.M1;s.layoutRevision++;
 s.housing.homes.push({id:'home:1',type:'porch',realm:'overworld',x:3,z:0,rotation:1});s.layoutRevision++;assert.match(reject(right),/住宅/);s.housing.homes=[];s.layoutRevision++;
 s.garden.plants.push({id:'planted:1',type:'turf',kind:'garden',realm:'overworld',x:4,z:0,rotation:0});s.layoutRevision++;assert.match(reject(right),/园艺台/);s.garden.plants=[];s.layoutRevision++;
 s.community.residents.push({id:'test',x:0,z:1,cargo:{qty:5},path:[{x:6,z:1}]});assert.match(reject(right),/正在经过/);assert.equal(s.community.residents[0].cargo.qty,5);
});
test('undo restores land for free, cannot duplicate it, and different worlds never share credits',()=>{
 const s=island();Object.assign(s.counts,{N1:1,E2:1});s.endEyes=12;
 for(const realm of ['nether','end']){const p={...right,realm};assert.equal(buy(s,'V1',p).ok,true);const quote=landMarketPrice(s,realm),money=s.money,record=storeLand(s,p);assert.equal(record.ok,true,record.reason);assert.equal(landPrice(s,realm),0);assert.ok(landPrice(s,'overworld')>0);assert.equal(undoStoreLand(s,record).ok,true);assert.equal(undoStoreLand(s,record).ok,false);assert.equal(s.money,money);assert.equal(landPrice(s,realm),quote);}
});
test('five consecutive plots always require fresh sites and do not reuse stale confirmations',()=>{
 const s=island();for(let i=0;i<5;i++){const p={...frontier(s)[0],realm:s.realm},price=landPrice(s),money=s.money;assert.equal(buy(s,'V1',p).cost,price);assert.equal(s.money,money-price);const old=structuredClone(s);assert.equal(buy(s,'V1',p).ok,false);assert.deepEqual(s,old);}
});
test('rotation swaps rectangular footprints, rotates farm passage, and survives upgrades and restore',()=>{
 const s=island();s.chunks.overworld=[...Array(3)].flatMap((_,x)=>[...Array(3)].map((_,z)=>({x:x-1,z:z-1})));s.counts.V4=1;s.placements.V4={x:4,z:0,realm:'overworld'};
 const f=footprint('V4'),turned=footprint('V4',{rotation:1});assert.deepEqual(turned,{w:f.d,d:f.w});
 assert.equal(move(s,'V4',{...s.placements.V4,rotation:1}),true);
 const boxes=buildingObstacles('V4',s.placements.V4);assert.equal(boxes[0].maxZ,-.38);assert.equal(boxes[1].minZ,.38);
 assert.equal(restore(structuredClone(s)).placements.V4.rotation,1);
 s.counts.V2=1;assert.equal(buy(s,'V4').ok,true);assert.equal(s.placements.V4.rotation,1);
 const old=structuredClone(s);assert.equal(move(s,'V4',{...s.placements.V4,rotation:1.5}),false);assert.deepEqual(s,old);
 assert.deepEqual(localPoint({x:0,z:0,rotation:1},0,1),{x:1,z:Math.cos(Math.PI/2)});
});
test('rotating at a coast rejects an overhang; nearby garden respects the turned facility',()=>{
 const s=island();s.garden.cleared=worldScenery(s).map(p=>p.id);s.counts.V20=2;s.counts.M1=1;
 const p={x:5,z:1.5,realm:'overworld',rotation:0};
 const candidates=sites(s,'overworld',null,'M16');assert.ok(candidates.length);
 const edge=candidates.find(p=>!canPlace(s,'M16',{...p,rotation:1}));assert.ok(edge,'a rectangular mine must have orientation-dependent sites');
 assert.equal(canPlace(s,'M16',{...edge,rotation:1}),false);
 s.placements.M1={x:5,z:0,realm:'overworld',rotation:1};s.layoutRevision++;
 const overlapping={x:5,z:0,realm:'overworld',rotation:0};assert.equal(plantGarden(s,'turf',overlapping).ok,false);
});
test('continuous preferences persist independently and do not affect money or gameplay flags',()=>{
 const s=island(),money=s.money;assert.equal(editingPreference(s,'land'),false);setEditingPreference(s,'land',true);assert.equal(repeatPlacement(s,{kind:'expand'}),true);assert.equal(repeatPlacement(s,{kind:'garden-build'}),false);setEditingPreference(s,'garden',true);assert.equal(restore(s).editing.gardenContinuous,true);assert.equal(s.money,money);assert.equal(repeatPlacement(s,{kind:'build'}),false);
});
test('turned building previews keep their height and scale, swap width and depth, and leave the save intact',()=>{
 const s=island();
 for(const id of ['M16','V4','M2','L2','V20']){
  s.counts[id]=3;const before=structuredClone(s),a=outdoorPreview(s,id,true,false,0),b=outdoorPreview(s,id,true,false,1),c=outdoorPreview(s,id,true,false,2);
  const ba=new Box3().setFromObject(a.root),bb=new Box3().setFromObject(b.root),bc=new Box3().setFromObject(c.root),size=ba.getSize(new Vector3()),turned=bb.getSize(new Vector3());
  assert.ok(Math.abs(size.x-turned.z)<1e-7&&Math.abs(size.z-turned.x)<1e-7,id);
  assert.ok(Math.abs(size.y-turned.y)<1e-7,id+' height');assert.ok(Math.abs(bb.min.y-.16)<1e-7,id+' grounded');
  assert.ok(ba.getSize(new Vector3()).distanceTo(bc.getSize(new Vector3()))<1e-7,id+' 180 degrees');
  assert.deepEqual(s,before);a.dispose();b.dispose();c.dispose();
 }
});
test('moving a turned facility without a new direction preserves its orientation and workload',()=>{
 const s=island();s.counts.M16=1;s.placements.M16={x:4,z:0,realm:'overworld',rotation:1};
 s.buffers.overworld.raw=17;s.grid.links.M16=true;const inventory=structuredClone(s.buffers);
 const p=sites(s,'overworld','M16','M16',1)[0];delete p.rotation;
 assert.equal(move(s,'M16',p),true);assert.equal(s.placements.M16.rotation,1);assert.deepEqual(s.buffers,inventory);assert.equal(s.grid.links.M16,true);
});
test('indoor and reserved residents do not prevent outdoor empty-land organization',()=>{
 const s=island();s.community.residents.push({id:'host',x:5,z:0,room:'studio',path:[]},{id:'reserve',x:5,z:0,reserve:true,path:[]});
 assert.equal(storeLand(s,right).ok,true);
});

test('mailbox and studio relocation preserve ownership, mail, interior furnishings and connections',()=>{
 const s=island();s.chunks.overworld=[...Array(5)].flatMap((_,x)=>[...Array(5)].map((_,z)=>({x:x-2,z:z-2})));
 for(const [id,x] of [['V18',5],['L2',-5]]){s.counts[id]=1;s.placements[id]={x,z:0,realm:'overworld',rotation:0};}
 s.layoutRevision++;s.grid.links.L2=true;
 const before=structuredClone({money:s.money,mail:s.mail,studio:s.studio,grid:s.grid,counts:s.counts});
 for(const id of ['V18','L2']){
  const target=sites(s,'overworld',id,id,1).find(p=>p.x!==s.placements[id].x||p.z!==s.placements[id].z);assert.ok(target,id);
  assert.equal(move(s,id,target),true);assert.equal(s.placements[id].rotation,1);
 }
 assert.deepEqual({money:s.money,mail:s.mail,studio:s.studio,grid:s.grid,counts:s.counts},before);
 const loaded=restore(structuredClone(s));for(const id of ['V18','L2'])assert.deepEqual(loaded.placements[id],s.placements[id]);
});
