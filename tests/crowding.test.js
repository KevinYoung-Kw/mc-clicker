import test from "node:test";
import assert from "node:assert/strict";
import { advance } from "../src/game.js";
import { ensureCommunity, assignJob } from "../src/residents.js";
import {
  COMPANION_SPACING,
  companionActors,
  companionNavigation,
  enqueueBatch,
  visibleCompanions,
  prepareCompanionPositions,
} from "../src/operations.js";
import { residentFixture } from "../scripts/resident-fixture.mjs";

function assignLegacyJob(s,id,job){
 if(job==='farmer'){s.community.residents.find(r=>r.id===id).job=job;return {ok:true};}
 return assignJob(s,id,job);
}
function checkSpacing(s) {
  const actors = companionActors(s);
  for (let i = 0; i < actors.length; i++) {
    assert.ok(companionNavigation(s).clear(actors[i].x, actors[i].z, 0.22));
    for (let j = i + 1; j < actors.length; j++) {
      const distance = Math.hypot(
        actors[i].x - actors[j].x,
        actors[i].z - actors[j].z,
      );
      assert.ok(
        distance >= COMPANION_SPACING - 1e-7,
        `${actors[i].id} and ${actors[j].id}: ${distance}`,
      );
    }
  }
}
test("workers at a shared farm stand apart and still complete actual harvests", () => {
  const s = residentFixture();
  s.counts.V4 = 6;
  for (const id of ["resident-1", "resident-2", "resident-3"])
    assert.ok(assignLegacyJob(s, id, "farmer").ok);
  for (let i = 0; i < 1600; i++) {
    advance(s, 0.1);
    checkSpacing(s);
  }
  const farmers = s.community.residents.slice(0, 3);
  assert.ok(
    farmers.every((r) => r.jobsDone > 0),
    JSON.stringify(
      farmers.map((r) => ({
        id: r.id,
        status: r.status,
        jobsDone: r.jobsDone,
      })),
    ),
  );
  assert.equal(new Set(farmers.map((r) => JSON.stringify(r.workSpot))).size, 3);
  assert.ok(s.community.shipped > 0);
});
test("multiple copper couriers share loading and dropoff facilities without overlapping or starving", () => {
  const s = residentFixture();
  s.counts.V15 = 4;
  s.counts.M4 = 3;
  ensureCommunity(s);
  for (const a of s.community.golems) {
    a.stops = ["V4"];
    a.mode = "cargo";
  }
  for (let i = 0; i < 2200; i++) {
    if (i % 100 === 0) enqueueBatch(s, "V4", "麦捆", 64, 4);
    advance(s, 0.1);
    checkSpacing(s);
  }
  assert.ok(
    s.community.golems.every((g) => g.trips >= 2),
    JSON.stringify(
      s.community.golems.map((g) => ({
        id: g.id,
        trips: g.trips,
        status: g.status,
        x: g.x,
        z: g.z,
      })),
    ),
  );
  assert.ok(s.community.golems.every((g) => g.delivered > 0));
});
test("render budget grows with land, includes copper golems and keeps the selected companion visible", () => {
  const s = residentFixture();
  s.counts.V2 = 12;
  s.counts.V15 = 4;
  ensureCommunity(s);
  s.counts.V4 = 3;
  s.counts.V6 = 1;
  s.counts.V14 = 1;
  for (const [land, budget] of [
    [1, 8],
    [3, 12],
    [6, 16],
    [10, 16],
    [16, 16],
  ]) {
    s.chunks.overworld = Array.from({ length: land }, (_, x) => ({ x, z: 0 }));
    const actors = visibleCompanions(s, "resident-12");
    assert.equal(actors.length, budget);
    assert.equal(actors[0].id, "resident-12");
    assert.ok(actors.some((a) => a.id.startsWith("golem-")));
  }
});
test("legacy overlaps are separated once without changing identity, skills, income or cargo", () => {
  const s = residentFixture();
  for (const a of companionActors(s)) {
    a.x = 1.5;
    a.z = 1.5;
  }
  s.community.residents[0].name = "木木";
  s.community.residents[0].skills.mining = 4;
  const before = s.money;
  prepareCompanionPositions(s);
  checkSpacing(s);
  const positions = companionActors(s).map((a) => [a.id, a.x, a.z]);
  prepareCompanionPositions(s);
  assert.deepEqual(
    companionActors(s).map((a) => [a.id, a.x, a.z]),
    positions,
  );
  assert.equal(s.community.residents[0].name, "木木");
  assert.equal(s.community.residents[0].skills.mining, 4);
  assert.equal(s.money, before);
});
test("a full shift and six copper golems keep separated while production and delivery continue", () => {
  const s = residentFixture();
  Object.assign(s.counts, { V2: 12, V15: 6, V4: 6, M1: 6, M2: 6, M4: 6 });
  ensureCommunity(s);
  for (let i = 0; i < 12; i++)
    assert.ok(
      assignLegacyJob(
        s,
        `resident-${i + 1}`,
        ["farmer", "miner", "crafter", "hauler"][Math.floor(i / 3)],
      ).ok,
    );
  for (const g of s.community.golems) {
    g.stops = ["V4", "M1"];
    g.mode = "cargo";
  }
  for (let i = 0; i < 3000; i++) {
    if (i % 100 === 0) enqueueBatch(s, "V4", "麦捆", 64, 4);
    advance(s, 0.1);
    checkSpacing(s);
  }
  assert.ok(
    s.community.residents.every((r) => r.jobsDone > 0),
    JSON.stringify(
      s.community.residents.map((r) => ({
        id: r.id,
        status: r.status,
        done: r.jobsDone,
      })),
    ),
  );
  assert.ok(
    s.community.golems.every((g) => g.trips > 0),
    JSON.stringify(
      s.community.golems.map((g) => ({
        id: g.id,
        status: g.status,
        trips: g.trips,
      })),
    ),
  );
});

test("a courier clears a narrow furnace passage beside three working villagers without overlap or teleporting", () => {
  const s = residentFixture();
  // Pin this specific narrow-passage geometry independently of catalogue order.
  s.placements.M3 = { ...s.placements.M2 };
  s.placements.M2 = { x: 0, z: -1.5, realm: "overworld" };
  s.layoutRevision++;
  Object.assign(s.counts, { V2: 4, V15: 0, M2: 6, M4: 6 });
  ensureCommunity(s);
  for (let i = 0; i < 4; i++)
    assert.ok(
      assignJob(s, `resident-${i + 1}`, i < 3 ? "crafter" : "hauler").ok,
    );
  advance(s, 0.1);
  const positions = [
    [0.8, -1.2],
    [-0.8, -2.16],
    [-0.22, -2.2],
    [0.32, -2.4],
  ];
  const nav = companionNavigation(s);
  for (const [i, actor] of s.community.residents.entries()) {
    [actor.x, actor.z] = positions[i];
    actor.handover = 0;
    actor.path = [];
    actor.workSpot = { x: actor.x, z: actor.z };
    actor.destination = "M2:0:-1.5";
    actor.routeRevision = s.layoutRevision;
    actor.parkingRevision = s.layoutRevision;
  }
  enqueueBatch(s, "M1", "矿料", 64, 4);
  const courier = s.community.residents[3],
    batch = s.community.batches.at(-1);
  batch.claimed = courier.id;
  courier.cargo = { id: batch.id, qty: 12 };
  courier.destination = "M4:-1.5:1.5";
  courier.workSpot = { x: -2.2, z: 2.6 };
  courier.path = nav
    .route(courier, nav.nearest(courier.workSpot, 0.22), 0.22)
    .map(({ x, z }) => ({ x, z }));
  checkSpacing(s);
  for (let i = 0; i < 1200 && !courier.jobsDone; i++) {
    const previous = s.community.residents.map((r) => ({ x: r.x, z: r.z }));
    advance(s, 0.1);
    checkSpacing(s);
    for (const [index, actor] of s.community.residents.entries())
      assert.ok(
        Math.hypot(actor.x - previous[index].x, actor.z - previous[index].z) <=
          0.141,
        `${actor.id} must walk, never teleport`,
      );
  }
  assert.ok(courier.jobsDone > 0, "the original cargo reaches storage");
  assert.ok(
    s.community.residents.slice(0, 3).every((r) => r.jobsDone > 0),
    "yielding workers resume their actual profession",
  );
});

test('twenty-four villagers with workers and idle residents keep separate positions and all fit an unlocked village',()=>{
 const s=residentFixture();
 Object.assign(s.counts,{V2:24,V4:6,V6:1,V14:1,M1:6,M2:6,M4:6});
 // A broad contiguous village keeps all 24 visible while testing paths around real facilities.
 s.chunks.overworld=Array.from({length:25},(_,i)=>({x:i%5-2,z:Math.floor(i/5)-2}));
 s.layoutRevision++;ensureCommunity(s);
 for(let i=0;i<12;i++) assert.ok(assignLegacyJob(s,`resident-${i+1}`,['farmer','miner','crafter','hauler'][Math.floor(i/3)]).ok);
 prepareCompanionPositions(s);
 assert.equal(visibleCompanions(s).filter(a=>a.id.startsWith('resident-')).length,24);
 for(let i=0;i<400;i++){advance(s,.1);checkSpacing(s);}
 assert.ok(s.community.residents.some(r=>r.jobsDone>0));
 assert.ok(s.community.residents.every(r=>r.baseEarned>0));
});
