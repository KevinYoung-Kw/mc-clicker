import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  restore,
  advance,
  settleOffline,
  action,
  rates,
} from "../src/game.js";
import {
  COLLECTION,
  COLLECTION_BY_ID,
  buyExtra,
  equipExtra,
  resetExtra,
  hasExtra,
  restoreCollection,
  buyCrop,
  selectCrop,
  weatherNow,
  dayPhase,
} from "../src/collection.js";
import { ownerOf, inConstruction, ownedGroups } from "../src/facility-shops.js";
import { CATALOG, ITEMS } from "../src/catalog.js";
import { PICK_CONTACT, PICK_DURATION, pickPose } from "../src/pickaxe.js";
import {WEB_ITEMS,WEB_BY_ID} from '../src/web-catalog.js';
import {buyWeb,equipWeb,resetWeb} from '../src/presentation.js';
import {buyEnvironment,setEnvironment} from '../src/environment.js';
const shop = () => {
  const s = fresh();
  s.counts = { T1: 1, V1: 1, V2: 1, V3: 1, V4: 1, X2: 3, L2: 1 };
  s.money = 1e6;
  return s;
};
test("46 web goods charge fixed prices individually and preserve unequipped ownership", () => {
 const s=shop(),before=s.money,id='web-cursor-diamond';
 assert.equal(WEB_ITEMS.length,46);assert.equal(new Set(WEB_ITEMS.map(i=>i.id)).size,46);
 assert.equal(buyWeb(s,id).ok,true);assert.equal(s.money,before-WEB_BY_ID[id].cost);
 assert.equal(s.webAppearance.owned['web-cursor-stone'],undefined);
 assert.equal(equipWeb(s,'web-cursor-amethyst'),false);
 assert.equal(buyWeb(s,id).ok,false);assert.equal(s.money,before-WEB_BY_ID[id].cost);
 resetWeb(s,'cursor');const r=restore(s);
 assert.equal(r.webAppearance.owned[id],true);assert.equal(r.webAppearance.equipped.cursor,undefined);
});
test("legacy purchased packs migrate once, new saves never grant a whole pack", () => {
  const raw = shop();
  delete raw.collection;delete raw.webAppearance;delete raw.scenery;delete raw.environment;raw.version=6;
  raw.counts.X5 = 1;
  raw.counts.X6 = 1;
  raw.cosmetics.flag = 2;
  const s = restore(raw);
  assert.equal(s.scenery.equipped.flag, "flag-2");
  assert.equal(s.scenery.owned["flag-0"], true);
  const next = restore(s);
  assert.deepEqual(next.collection, s.collection);
  const freshSave = shop();
  freshSave.counts.X5 = 1;
  const n = restore(freshSave);
  assert.equal(hasExtra(n, "cursor-2"), false);
  freshSave.collection.equipped.cursor = "cursor-2";
  assert.equal(restore(freshSave).collection.equipped.cursor, undefined);
});
test("crop switching resets only the extra harvest and pays according to its full cycle", () => {
  const s = shop();
  s.harvest.farm = 1;
  const before = rates(s);
  assert.equal(buyCrop(s, "pumpkin"), true);
  assert.equal(selectCrop(s, "pumpkin"), true);
  assert.equal(s.harvest.farm, 0);
  assert.equal(rates(s).population, before.population);
  assert.equal(rates(s).total, before.total);
  assert.equal(action(s, "farm").ok, false);
  advance(s, 139);
  assert.ok(s.harvest.farm < 1);
  advance(s, 1.01);
  assert.equal(s.harvest.farm, 1);
  const money = s.money, reward = action(s, "farm");
  assert.equal(reward.ok, true);
  assert.equal(reward.value, 0);
  assert.equal(s.money, money); // Harvest must first finish work and produce cargo.
  assert.equal(action(s, "farm").ok, false);
  const saved = restore(s);
  assert.equal(saved.crops.selected, "pumpkin");
  assert.equal(saved.crops.owned.carrot, undefined);
});
test("environment purchases are independent from web shop, persist and never advance offline", () => {
 const s=shop();assert.equal(buyEnvironment(s,'env-snow').ok,false);s.counts.V19=1;s.counts.X2=0;
 for(const id of ['env-weather','env-snow','env-sundial','env-stars'])assert.equal(buyEnvironment(s,id).ok,true);
 assert.equal(weatherNow(s),'snow');const clock=s.environment.clock;
 advance(s,467,{offline:true});settleOffline(s);assert.equal(s.environment.clock,clock);
 setEnvironment(s,{phase:.95});advance(s,361);
 assert.ok(s.environment.seen.includes('meteor'));assert.ok(s.environment.seen.includes('snow'));
 const r=restore(s);assert.equal(r.environment.clock,s.environment.clock);assert.equal(weatherNow(r),'snow');
 setEnvironment(r,{phase:.8});advance(r,1);assert.equal(dayPhase(r),.8);
 const invalid=shop();invalid.environment.weather='snow';assert.equal(weatherNow(restore(invalid)),'clear');
});
test("facility catalog ownership partitions construction and keeps every equipment owner reachable", () => {
  for (const i of CATALOG) {
    const owner = ownerOf(i.id);
    if (owner && owner !== "decor") assert.ok(ITEMS[owner]);
  }
  assert.equal(inConstruction(ITEMS.L2), true);
  assert.equal(inConstruction(ITEMS.L10), false);
  assert.equal(ownerOf("V8"), "V7");
  assert.equal(ownerOf("V5"), null);
  const s = shop();
  s.counts.T1 = ITEMS.T1.max;
  s.counts.V4 = 2;
  const g = ownedGroups(s, [ITEMS.T1, ITEMS.V4]);
  assert.deepEqual(
    g.complete.map((i) => i.id),
    ["T1"],
  );
  assert.deepEqual(
    g.upgradable.map((i) => i.id),
    ["V4"],
  );
});
test("pickaxe has a windup, exact contact, and continuous rebound instead of an instant jump", () => {
  assert.deepEqual(pickPose(0), pickPose(PICK_DURATION));
  assert.equal(pickPose(PICK_CONTACT).lift, 0);
  assert.ok(pickPose(0.08).lift > pickPose(0).lift);
  assert.ok(pickPose(0.3).lift > 0);
  const a = pickPose(PICK_CONTACT - 0.0001),
    b = pickPose(PICK_CONTACT + 0.0001);
  assert.ok(Math.abs(a.angle - b.angle) < 0.01);
});

test('all tool materials share a contact tooth and never sink beneath the block at impact',async()=>{
  const T=await import('three'),{createPickaxe,PICK_TIP}=await import('../src/pickaxe.js');
  for(const color of ['#a67d4c','#bbc8c5','#4aafab'])for(const scale of [1,.67]){
    const pick=createPickaxe(color);pick.rotation.z=pickPose(PICK_CONTACT).angle;pick.scale.setScalar(scale);pick.updateMatrixWorld(true);
    const tip=pick.localToWorld(PICK_TIP.clone()),floor=new T.Box3().setFromObject(pick).min.y;
    assert.ok(Math.abs(tip.y-floor)<.00001);
  }
});
