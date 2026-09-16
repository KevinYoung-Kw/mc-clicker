// Isolated feasibility probes; candidate housing data is not persisted by the game.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {fresh,buy,restore,frontier,price}from '../../src/game.js';
import {ITEMS}from '../../src/catalog.js';
import {BUILDING_SIZES,buildSites,footprint,buildingObstacles,scenery,sceneryVisible}from '../../src/layout.js';
import {Navigation}from '../../src/navigation.js';
import {COMPANION_RADIUS}from '../../src/operations.js';
import {RESIDENT_LIMIT,ensureCommunity,baseIncome}from '../../src/residents.js';
import {populationSupport}from '../../src/population.js';
import {residentFixture}from '../resident-fixture.mjs';
import {crowdFixture}from '../crowd-fixture.mjs';
import {HOMES,homeModel}from './models.mjs';import * as T from 'three';
const out='docs/v1.6/qa/feasibility';
const models=HOMES.map(h=>{const b=new T.Box3().setFromObject(homeModel(h));assert.ok(b.min.y>=-1e-8&&b.min.x>=-h.w/2&&b.max.x<=h.w/2&&b.min.z>=-h.d/2&&b.max.z<=h.d/2);return{id:h.id,w:h.w,d:h.d,beds:h.beds,height:b.max.y};});
function snap(s){return JSON.stringify({money:s.money,counts:s.counts,placements:s.placements,chunks:s.chunks,residents:s.community.residents,buffers:s.buffers,project:s.project});}
function proposeMigration(s,raw=null){
 if(raw)return structuredClone(raw);
 const residents=s.community.residents.filter(r=>!r.reserve),records={version:1,homes:[],addresses:{}};
 for(const [i,p]of scenery(s.chunks.overworld).filter(p=>p.kind==='house'&&sceneryVisible(s,p)).entries()){
  const home={id:`legacy:${p.x}:${p.z}`,kind:'legacy',w:1,d:1,x:p.x,z:p.z,beds:1};records.homes.push(home);
  if(residents[i])records.addresses[residents[i].id]={homeId:home.id,unit:1};
 }
 return records;
}
function reportHousing(s,h){const residents=s.community.residents.filter(r=>!r.reserve);const housed=new Set(Object.keys(h.addresses));return{people:residents.length,beds:h.homes.reduce((n,h)=>n+h.beds,0),unhoused:residents.filter(r=>!housed.has(r.id)).length,atHardCap:s.counts.V2>=RESIDENT_LIMIT};}
const mid=residentFixture(),legacy=restore(crowdFixture(),0);
const full=structuredClone(mid);
for(let attempt=0;full.counts.V2<24&&attempt<60;attempt++){
 if(buy(full,'V2').ok)continue;
 const p=populationSupport(full);
 if(p.land<=p.services){assert.ok(buy(full,'V1',{...frontier(full,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],realm:'overworld'}).ok);}
 else assert.ok(['V4','V6','V14'].some(id=>buy(full,id).ok));
}
assert.equal(full.counts.V2,24);
const baseCases=[['midgame-nine',mid],['current-twenty-four',full],['legacy-forty-five',legacy]];
const migrations=baseCases.map(([id,s])=>{const before=snap(s),income=baseIncome(s),h=proposeMigration(s);assert.equal(snap(s),before);assert.equal(baseIncome(s),income);assert.deepEqual(proposeMigration(s,h),h);return{id,...reportHousing(s,h),preservedIdentityAndEconomy:true,idempotentCandidateRecords:true,legacyReserves:s.community.residents.filter(r=>r.reserve).length};});
// Demonstrate why plugging new IDs into the old facility restore loop cannot work.
const experimental=structuredClone(mid);experimental.housing=proposeMigration(experimental);experimental.placements['house:1']={x:10,z:10,realm:'overworld'};
const existingRestorer=restore(experimental,0);
assert.equal(existingRestorer.housing,undefined);assert.equal(existingRestorer.placements['house:1'],undefined);
// Reuse the actual placement predicate in this Node process via study-only size IDs.
function fit(s0,kinds){const s=structuredClone(s0),homes=[],originalPlots=s.chunks.overworld.length;let addedLandQuote=0;
 for(const [i,kind]of kinds.entries()){
  const h=HOMES.find(h=>h.id===kind),id=`study:home-${i}`;BUILDING_SIZES[id]=[h.w,h.d];
  let choices=buildSites(s,'overworld',id);
  for(let tries=0;!choices.length&&tries<6;tries++){
   addedLandQuote+=price(s,ITEMS.V1,'overworld');
   s.chunks.overworld.push(frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0]);
   choices=buildSites(s,'overworld',id);
  }
  assert.ok(choices.length);const p=choices.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
  s.placements[id]=p;homes.push({id,kind,beds:h.beds,...p});
 }
 const obstacles=Object.entries(s.placements).filter(([,p])=>p.realm==='overworld').flatMap(([id,p])=>buildingObstacles(id,p));
 // Conservative rectangular envelopes; excludes natural obstacles to make the limitation explicit.
 const nav=new Navigation(s.chunks.overworld,obstacles);
 const paths=[COMPANION_RADIUS,.40].map(radius=>{
  const grid=nav.grid(radius),main=grid.components.reduce((best,c)=>c.length>best.length?c:best,[]),start=grid.nodes[main[0]];
  const unreachable=homes.filter(h=>{const f=footprint(h.id),point={x:h.x,z:h.z+f.d/2+radius+.06},near=nav.nearest(point,radius);return !near||!start||near.component!==start.component||Math.hypot(near.x-point.x,near.z-point.z)>.4;});
  return{radius,meaning:radius===COMPANION_RADIUS?'Current companion radius':'Large-body stress probe, not a new runtime radius',mainWalkingComponentCells:main.length,totalWalkableCells:grid.nodes.length,unreachableFrontDoors:unreachable.map(h=>h.id)};
 });
 const result={houses:homes.length,beds:homes.reduce((n,h)=>n+h.beds,0),plotsBefore:originalPlots,extraPlots:s.chunks.overworld.length-originalPlots,hypotheticalLandQuote:addedLandQuote,paths,placements:homes};
 for(const h of homes)delete BUILDING_SIZES[h.id];return result;
}
const layout=[];
for(const [id,s]of baseCases.slice(0,2))for(const [scheme,kinds]of [
 ['all-cottages',Array.from({length:24},()=> 'oak')],
 ['mixed-addresses',['oak','oak','oak','oak','duplex','duplex','duplex','tower','tower','corner','gallery']],
])layout.push({fixture:id,scheme,...fit(s,kinds)});
const result={scope:'Design probes only. No game runtime/population/save schema changes. Layout is greedy hypothetical packing, not a production layout algorithm or affordability proof. Door paths use a generic front anchor and rectangular envelopes, exclude nature and moving crowds, and do not prove actual door anchors or full-world reachability.',hardCap:RESIDENT_LIMIT,models,migrations,existingRestoreDropsUnrecognizedHousing:true,layouts:layout};
fs.writeFileSync(`${out}/housing-feasibility.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,layouts:layout.map(({placements,...r})=>r)},null,2));
