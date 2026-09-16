import {prepareRecruitHousing} from '../scripts/housing-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { ITEMS } from "../src/catalog.js";
import { buyGuidance } from "../src/guidance.js";
import {
  fresh,
  restore,
  buy,
  advance,
  populationCap,
  unlocked,
} from "../src/game.js";
import {
  RESIDENT_LIMIT,
  LEGACY_RESIDENT_LIMIT,
  ensureCommunity,
  activeResidents,
  recallResident,
  assignJob,
  residentBase,
  baseIncome,
} from "../src/residents.js";

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

// Historical saves predate rotation flags. Do not let the current initializer
// preselect a team before testing the migration's choices.
function historicalSave(count = 45, counts = {}) {
  const raw = fresh(0);
  Object.assign(raw.counts, { V2: count }, counts);
  ensureCommunity(raw);
  raw.version = 3;
  for (const r of raw.community.residents) {
    delete r.reserve;
    delete r.previousJob;
  }
  return raw;
}
const resident = (s, id) => s.community.residents.find((r) => r.id === id);

test("new villages recruit at most twenty-four without blocking the six-person bell milestone", () => {
  const s = fresh(0);
  s.money = 1e7;
  assert.equal(RESIDENT_LIMIT, 24);
  assert.equal(ITEMS.V2.max, RESIDENT_LIMIT);
  assert.ok(buy(s, "T1").ok);
  assert.ok(buyGuidance(s, "goals").ok);
  for (let i = 0; i < 4; i++) assert.ok(buy(s, "V1").ok);
  assert.ok(buyGuidance(s, "info").ok);
  assert.ok(buy(s, "V18").ok);
  for (let i = 0; i < 6; i++) {prepareRecruitHousing(s);assert.ok(buy(s, "V2").ok);}
  assert.ok(unlocked(s, ITEMS.V14));
  assert.ok(buy(s, "V14").ok);
  for (let i = 4; i < 11; i++) assert.ok(buy(s, "V1").ok);
  for (let i = 0; i < 3; i++) assert.ok(buy(s, "V4").ok);
  assert.ok(buy(s, "V6").ok);
  for (let i = 6; i < RESIDENT_LIMIT; i++) {prepareRecruitHousing(s);assert.ok(buy(s, "V2").ok);}
  assert.ok(buy(s, "V1").ok);
  assert.equal(populationCap(s), RESIDENT_LIMIT);
  const balance = s.money;
  assert.equal(buy(s, "V2").ok, false);
  assert.equal(s.money, balance);
  assert.equal(s.counts.V2, RESIDENT_LIMIT);
  assert.equal(activeResidents(s).length, RESIDENT_LIMIT);
});

test("legacy population retains every identity, skill and full B while twenty-four residents stay active", () => {
  const raw = historicalSave(45, { V4: 1, V12: 2 });
  const worker = resident(raw, "resident-45");
  worker.job = "farmer";
  worker.baseEarned = 321;
  worker.jobEarned = 456;
  worker.jobsDone = 7;
  resident(raw, "resident-44").name = "我的老朋友";
  resident(raw, "resident-43").skills.farming = 4;
  const expectedB = raw.community.residents.reduce(
    (sum, r) => sum + residentBase(raw, r),
    0,
  );
  const s = restore(raw, 0);
  assert.equal(s.counts.V2, 45);
  assert.equal(s.community.residents.length, 45);
  assert.equal(new Set(s.community.residents.map((r) => r.id)).size, 45);
  assert.equal(activeResidents(s).length, RESIDENT_LIMIT);
  assert.equal(s.community.residents.filter((r) => r.reserve).length, 45 - RESIDENT_LIMIT);
  for (const id of ["resident-43", "resident-44", "resident-45"])
    assert.ok(
      activeResidents(s).some((r) => r.id === id),
      `${id} retained`,
    );
  assert.equal(resident(s, "resident-44").name, "我的老朋友");
  assert.equal(resident(s, "resident-43").skills.farming, 4);
  assert.equal(resident(s, "resident-45").jobEarned, 456);
  assert.equal(resident(s, "resident-45").jobsDone, 7);
  assert.deepEqual(
    s.community.residents.map((r) => r.look),
    raw.community.residents.map((r) => r.look),
  );
  close(baseIncome(s), expectedB);
  const earned = s.community.residents.map((r) => r.baseEarned);
  advance(s, 1);
  s.community.residents.forEach((r, i) =>
    close(r.baseEarned - earned[i], residentBase(s, r)),
  );
});

test("all supported save generations preserve paid-for residents above the new recruitment cap", () => {
  assert.equal(LEGACY_RESIDENT_LIMIT, 60);
  for (const version of [2, 3, 4]) {
    const raw = historicalSave(LEGACY_RESIDENT_LIMIT);
    raw.version = version;
    if (version === 2) delete raw.community;
    const s = restore(raw, 0);
    assert.equal(s.counts.V2, LEGACY_RESIDENT_LIMIT, `save v${version}`);
    assert.equal(s.community.residents.length, LEGACY_RESIDENT_LIMIT);
    assert.equal(activeResidents(s).length, RESIDENT_LIMIT);
    const balance = s.money;
    assert.equal(buy(s, "V2").ok, false);
    assert.equal(s.money, balance);
  }
});

test("rotation exchanges exactly one resident and restores a high-numbered personal identity", () => {
  const s = restore(historicalSave(), 0);
  const incoming = resident(s, "resident-45");
  incoming.name = "常驻的麦芽";
  incoming.skills = { farming: 4, hauling: 2 };
  incoming.baseEarned = 1000;
  incoming.jobEarned = 700;
  incoming.jobsDone = 9;
  const expectedB = baseIncome(s);
  const initialIds = new Set(activeResidents(s).map((r) => r.id));
  assert.ok(recallResident(s, incoming.id, "resident-1").ok);
  const ids = new Set(activeResidents(s).map((r) => r.id));
  assert.equal(ids.size, RESIDENT_LIMIT);
  assert.deepEqual(
    [...ids].filter((id) => !initialIds.has(id)),
    [incoming.id],
  );
  assert.deepEqual(
    [...initialIds].filter((id) => !ids.has(id)),
    ["resident-1"],
  );
  assert.equal(incoming.job, "idle");
  assert.equal(resident(s, "resident-1").reserve, true);
  close(baseIncome(s), expectedB);
  const copy = restore(s, 0);
  assert.deepEqual(new Set(activeResidents(copy).map((r) => r.id)), ids);
  const restored = resident(copy, incoming.id);
  assert.equal(restored.name, incoming.name);
  assert.deepEqual(restored.look, incoming.look);
  assert.equal(restored.skills.farming, 4);
  assert.equal(restored.skills.hauling, 2);
  assert.equal(restored.baseEarned, 1000);
  assert.equal(restored.jobEarned, 700);
  assert.equal(restored.jobsDone, 9);
  close(baseIncome(copy), expectedB);
});

test("resting residents retain B but cannot perform jobs or consume the recalled worker's slot", () => {
  const s = restore(historicalSave(45, { L1: 1 }), 0);
  const outgoing = resident(s, "resident-1");
  assert.ok(assignJob(s, outgoing.id, "musician").ok);
  assert.ok(recallResident(s, "resident-45", outgoing.id).ok);
  assert.equal(outgoing.reserve, true);
  assert.equal(outgoing.job, "idle");
  assert.equal(outgoing.previousJob, "musician");
  assert.equal(assignJob(s, outgoing.id, "musician").ok, false);
  const earned = outgoing.baseEarned;
  advance(s, 40);
  close(outgoing.baseEarned - earned, residentBase(s, outgoing) * 40);
  assert.equal(outgoing.jobsDone, 0);
  assert.equal(outgoing.jobEarned, 0);
  assert.equal(s.community.jobIncome, 0);
  assert.ok(assignJob(s, "resident-45", "musician").ok);
  assert.equal(assignJob(s, "resident-2", "musician").ok, false);
});

test("rotation cannot abandon cargo, duplicate a resident or increase the active team", () => {
  const s = restore(historicalSave(), 0);
  const outgoing = resident(s, "resident-1");
  outgoing.cargo = { id: "batch-1", qty: 3 };
  s.community.batches.push({
    id: "batch-1",
    source: "V4",
    qty: 3,
    delivered: 0,
    value: 4,
    owners: {},
    claimed: outgoing.id,
  });
  const initialIds = activeResidents(s).map((r) => r.id);
  assert.equal(recallResident(s, "resident-45", outgoing.id).ok, false);
  assert.deepEqual(outgoing.cargo, { id: "batch-1", qty: 3 });
  assert.equal(s.community.batches[0].claimed, outgoing.id);
  assert.deepEqual(
    activeResidents(s).map((r) => r.id),
    initialIds,
  );
  outgoing.cargo = null;
  assert.equal(recallResident(s, "resident-1", "resident-2").ok, false);
  assert.equal(recallResident(s, "resident-45", "resident-45").ok, false);
  assert.equal(recallResident(s, "missing", "resident-2").ok, false);
  assert.equal(activeResidents(s).length, RESIDENT_LIMIT);
  assert.equal(new Set(s.community.residents.map((r) => r.id)).size, 45);
});

test('land and service facilities unlock actual recruitment capacity, independently of money', async () => {
  const {populationSupport} = await import('../src/population.js');
  const {purchaseStatus} = await import('../src/purchase-feedback.js');
  const s=fresh(0); s.money=1e8;
  Object.assign(s.counts,{T1:1,V1:1,V18:1,V2:4});
  // Isolate the land/service limit; housing capacity is covered by housing.test.js.
  s.housing.homes=[{id:'home:1',type:'corner'},{id:'home:2',type:'corner'}];
  assert.equal(populationCap(s),4);
  const money=s.money; assert.equal(buy(s,'V2').ok,false);assert.equal(s.money,money);
  assert.deepEqual(purchaseStatus(s,ITEMS.V2).links,['V1']);
  assert.ok(buy(s,'V1').ok); assert.equal(populationCap(s),6);
  assert.ok(buy(s,'V2').ok);assert.ok(buy(s,'V2').ok);
  assert.ok(unlocked(s,ITEMS.V14)); // no deadlock at six-person milestone
  assert.ok(buy(s,'V1').ok);assert.equal(populationSupport(s).land,8);
  assert.equal(populationCap(s),6); // free land alone does not supply everyone
  assert.equal(purchaseStatus(s,ITEMS.V2).links[0],'V4');
  s.counts.V4=1; assert.equal(populationCap(s),8);
  s.counts.V4=8;s.counts.V6=1;s.counts.V14=1;
  assert.equal(populationCap(s),8); // stacking services on three plots cannot bypass land
});

test('an existing twelve-person village retains identities, work and B when below the new space requirement',()=>{
 const raw=historicalSave(12,{V1:1,V4:1});
 raw.community.residents[0].job='farmer';
 const before=baseIncome(raw),s=restore(raw,0);
 assert.equal(activeResidents(s).length,12);
 assert.equal(s.community.residents[0].job,'farmer');
 close(baseIncome(s),before);assert.equal(buy(s,'V2').ok,false);
});

test('capacity help explains both simultaneous limits and never sends a player to a maxed-out farm', async()=>{
 const {populationSupport,populationBlock}=await import('../src/population.js');
 const s=fresh(0);s.counts.V1=2;s.chunks.overworld.push({x:1,z:0});
 assert.match(populationBlock(s).reason,/土地与村庄支持都已满/);
 assert.deepEqual(populationBlock(s).links.slice(0,2),['V1','V4']);
 s.chunks.overworld=Array.from({length:12},(_,x)=>({x,z:0}));s.counts.V4=ITEMS.V4.max;
 assert.equal(populationSupport(s).next,'V6');assert.ok(!populationBlock(s).links.includes('V4'));
});
