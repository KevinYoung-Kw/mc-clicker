import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore} from '../src/game.js';
import {canPlace} from '../src/layout.js';
import {paintTerrain,plantGarden,gardenSites} from '../src/garden.js';
import {brushCells,terrainAt,waterObstacles,TERRAIN_MOTTLE,cellKey} from '../src/terrain-data.js';
import {storeLand,undoStoreLand} from '../src/land-management.js';
import {registerLandPurchase,storedLandCount} from '../src/land.js';
import {companionNavigation} from '../src/operations.js';
import {housingPlacementReason} from '../src/housing.js';
import {encodeCompactSave,encodePersistentSave,decodeSave} from '../src/save-code.js';
import {persistentSave} from '../src/save-persistent.js';

const empty=()=>{
  const s=fresh(0);
  s.counts.V1=4;s.counts.V20=1;s.money=1e6;
  s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
  return s;
};

test('brushCells expands 1 / 2 / 3 footprints',()=>{
  assert.deepEqual(brushCells(3,4,1),[{x:3,z:4}]);
  assert.equal(brushCells(3.2,4.8,2).length,4);
  assert.equal(brushCells(5,5,3).length,9);
});

test('painting terrain charges per changed cell and mottle clears keys',()=>{
  const s=empty();
  const first=paintTerrain(s,'grassLight',{x:2,z:2,realm:'overworld'},1);
  assert.ok(first.ok);assert.equal(first.count,1);assert.equal(first.cost,8);
  assert.equal(terrainAt(s,2,2),'grassLight');assert.equal(s.money,1e6-8);
  assert.equal(paintTerrain(s,'grassLight',{x:2,z:2,realm:'overworld'},1).ok,false);
  const wipe=paintTerrain(s,TERRAIN_MOTTLE,{x:2,z:2,realm:'overworld'},1);
  assert.ok(wipe.ok);assert.equal(wipe.cost,0);assert.equal(terrainAt(s,2,2),null);
});

test('shallow water blocks build, walk, housing, plants and ground overlays',()=>{
  const s=empty();
  assert.ok(paintTerrain(s,'water',{x:3,z:1,realm:'overworld'},1).ok);
  assert.equal(canPlace(s,'V18',{x:3,z:1,realm:'overworld'}),false);
  assert.match(housingPlacementReason(s,'cottage',{x:3,z:1,realm:'overworld',rotation:0}),/浅水/);
  assert.ok(waterObstacles(s).some(b=>b.minX===2.5&&b.maxX===3.5&&b.minZ===0.5&&b.maxZ===1.5));
  companionNavigation(s);
  const plant=plantGarden(s,'turf',{x:3,z:1,realm:'overworld',rotation:0});
  assert.equal(plant.ok,false);
  assert.match(plant.reason,/浅水/);
  const shrub=plantGarden(s,'shrub',{x:3,z:1,realm:'overworld',rotation:0});
  assert.equal(shrub.ok,false);
  assert.match(shrub.reason,/浅水/);
  const spot=gardenSites(s,'turf').find(p=>Math.round(p.x)!==3||Math.round(p.z)!==1);
  assert.ok(spot);assert.ok(plantGarden(s,'turf',spot).ok);
  assert.equal(paintTerrain(s,'water',{x:Math.round(spot.x),z:Math.round(spot.z),realm:'overworld'},1).ok,false);
  // A planted shrub also blocks painting water under it.
  const bushSpot=gardenSites(s,'shrub')[0];
  assert.ok(bushSpot);assert.ok(plantGarden(s,'shrub',bushSpot).ok);
  const waterOverBush=paintTerrain(s,'water',{x:Math.round(bushSpot.x),z:Math.round(bushSpot.z),realm:'overworld'},1);
  assert.equal(waterOverBush.ok,false);
  assert.match(waterOverBush.reason||'',/花草树木|地表布景/);
});

test('painted cells persist through save; old saves get empty terrain map',()=>{
  const s=empty();
  assert.ok(paintTerrain(s,'village',{x:1,z:1,realm:'overworld'},1).ok);
  assert.ok(paintTerrain(s,'center',{x:2,z:1,realm:'overworld'},1).ok);
  const loaded=restore(JSON.parse(JSON.stringify(s)),0);
  assert.equal(terrainAt(loaded,1,1),'village');
  assert.equal(terrainAt(loaded,2,1),'center');
  const legacy=empty();delete legacy.garden.terrain;
  const old=restore(JSON.parse(JSON.stringify(legacy)),0);
  assert.deepEqual(old.garden.terrain,{});
});

test('terrain survives compact and persistent save codes',()=>{
  const s=empty();
  assert.ok(paintTerrain(s,'sand',{x:1,z:1,realm:'overworld'},1).ok);
  assert.ok(paintTerrain(s,'water',{x:2,z:1,realm:'overworld'},1).ok);
  const compact=restore(decodeSave(encodeCompactSave(s,'test',1)).save,0);
  assert.equal(terrainAt(compact,1,1),'sand');
  assert.equal(terrainAt(compact,2,1),'water');
  const persistent=restore(decodeSave(encodePersistentSave(s,'test',1)).save,0);
  assert.equal(terrainAt(persistent,1,1),'sand');
  assert.equal(terrainAt(persistent,2,1),'water');
  assert.equal(persistentSave(s).garden.terrain[cellKey(1,1)],'sand');
});

test('storing and undoing a parcel migrates terrain cells',()=>{
  const s=empty();
  assert.ok(paintTerrain(s,'sand',{x:5,z:0,realm:'overworld'},1).ok);
  const stored=storeLand(s,{x:1,z:0,realm:'overworld'});
  assert.ok(stored.ok);assert.equal(terrainAt(s,5,0),null);
  assert.ok(undoStoreLand(s,stored).ok);assert.equal(terrainAt(s,5,0),'sand');
});

test('reusing stored land remaps terrain onto the new parcel',()=>{
  const s=empty();
  assert.ok(paintTerrain(s,'dirt',{x:5,z:0,realm:'overworld'},1).ok);
  assert.ok(storeLand(s,{x:1,z:0,realm:'overworld'}).ok);
  assert.equal(storedLandCount(s,'overworld'),1);
  assert.ok(!s.chunks.overworld.some(p=>p.x===1&&p.z===0));
  registerLandPurchase(s,'overworld',{x:2,z:0});
  assert.equal(terrainAt(s,5,0),null);
  assert.equal(terrainAt(s,10,0),'dirt');
  assert.equal(s.garden.terrain[cellKey(10,0)],'dirt');
});
