import test from "node:test";
import assert from "node:assert/strict";
import { ITEMS } from "../src/catalog.js";
import { fresh, buy, move, sites, frontier, advance } from "../src/game.js";
import { assignJob, ensureCommunity, residentBase } from "../src/residents.js";
import { buyEarlyGuidance } from "../scripts/early-fixture.mjs";
import { studioSites, placeStudio } from "../src/studio-placement.js";
import {
  companionTarget,
  companionNavigation,
  COMPANION_RADIUS,
  taskState,
} from "../src/operations.js";
import {
  configureAutomation,
  gridConnected,
  powerSnapshot,
  toggleDevice,
} from "../src/power.js";

function earlyVillage() {
  const s = fresh();
  s.money = 1e8; s.research.completed["basic-power"]=true;
  buyEarlyGuidance(s);
  for (const id of ["T1", "V1", "V2", "V3", "T7", "M4", "M5", "M6", "L1"]) {
    if (s.counts[id]) continue;
    while (ITEMS[id].place && !sites(s, "overworld", null, id).length)
      assert.ok(buy(s, "V1", { ...frontier(s)[0], realm: "overworld" }).ok);
    assert.ok(buy(s, id).ok, id);
  }
  for (let i = 0; i < 3; i++)
    assert.ok(buy(s, "V1", { ...frontier(s)[0], realm: "overworld" }).ok);
  return s;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("a musician follows the record player into the studio and keeps earning after moving its entrance", () => {
  const s = earlyVillage(),
    resident = s.community.residents[0];
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};
  const oldRecord = { ...s.placements.L1 };
  assert.deepEqual(companionTarget(s, "L1"), oldRecord);
  assert.ok(assignJob(s, resident.id, "musician").ok);
  advance(s, 30);
  assert.ok(resident.jobsDone > 0, "outdoor music work already runs");
  const entrance = sites(s, "overworld", null, "L2").sort(
    (a, b) => distance(b, oldRecord) - distance(a, oldRecord),
  )[0];
  assert.ok(buy(s, 'V3').ok, 'upgrade market for studio');
  assert.ok(buy(s, "L2", entrance).ok);
  assert.equal(s.placements.L1, undefined);
  assert.deepEqual(companionTarget(s, "L1"), s.placements.L2);
  let before = {
    jobs: resident.jobsDone,
    earned: resident.jobEarned,
    base: resident.baseEarned,
  };
  advance(s, 60);
  assert.equal(resident.room, "studio");
  assert.equal(
    resident.destination,
    null,
    "the musician works inside after arrival, without an outdoor route",
  );
  assert.ok(resident.jobsDone > before.jobs);
  assert.ok(resident.jobEarned > before.earned);
  close(resident.baseEarned - before.base, residentBase(s, resident) * 60);
  assert.ok(
    companionNavigation(s).clear(resident.x, resident.z, COMPANION_RADIUS),
    "the remembered arrival point remains outside the entrance walls",
  );
  const next = sites(s, "overworld", "L2", "L2").sort(
    (a, b) => distance(b, entrance) - distance(a, entrance),
  )[0];
  assert.ok(distance(next, entrance) > 3);
  assert.ok(move(s, "L2", next));
  before = {
    jobs: resident.jobsDone,
    earned: resident.jobEarned,
    base: resident.baseEarned,
  };
  advance(s, 60);
  assert.deepEqual(companionTarget(s, "L1"), next);
  assert.equal(
    resident.room,
    "studio",
    "moving the entrance keeps the same musician inside",
  );
  assert.equal(resident.destination, null);
  assert.ok(resident.jobsDone > before.jobs);
  assert.ok(resident.jobEarned > before.earned);
  close(resident.baseEarned - before.base, residentBase(s, resident) * 60);
  const recordSite = studioSites(s, "L1", { ignoreKey: "L1" }).find(
    (p) => distance(p, s.studio.placements.L1) > 1,
  );
  assert.ok(recordSite);
  assert.ok(placeStudio(s, "L1", recordSite).ok);
  const priorJobs = resident.jobsDone;
  advance(s, 20);
  assert.equal(resident.room, "studio");
  assert.ok(
    resident.jobsDone > priorJobs,
    "moving the record player keeps the same musician working",
  );
});

function poweredStudio() {
  const s = fresh();
  Object.assign(s.counts, { M5: 1, M6: 1, M10: 1, L1: 1, L2: 1 });
  Object.assign(s.placements, {
    M5: { x: 0, z: 0, realm: "overworld" },
    M6: { x: 0, z: 1, realm: "overworld" },
    M10: { x: 1, z: 0, realm: "overworld" },
    L2: { x: 20, z: 0, realm: "overworld" },
  });
  ensureCommunity(s);
  assert.ok(configureAutomation(s, "music", true).ok);
  return s;
}

test("indoor music auto-connects at remote entrances and pays work plus base broadcast power", () => {
  const s = poweredStudio();
  assert.equal(gridConnected(s, "L1"), true);
  const load = powerSnapshot(s).loads.find((l) => l.id === "auto-music");
  assert.equal(load.actual, 2);
  const spent = s.grid.spent;
  advance(s, 1.1);
  assert.equal(taskState(s, "music").cycle, 1);
  assert.ok(s.community.jobIncome > 0);
  close(s.grid.spent - spent, 2 + (2 + 0.2) * 1.1 + 0.1); // final 0.1s prepares the next performance
  s.placements.L2.x = 3;
  s.layoutRevision++;
  assert.equal(gridConnected(s, "L1"), true);
});

test("indoor music preserves its own disconnect and pause settings; pre-studio music still uses its outdoor position", () => {
  const s = poweredStudio();
  s.placements.L2.x = 3;
  s.grid.links.L1 = false;
  assert.equal(gridConnected(s, "L1"), false);
  advance(s, 2);
  assert.equal(taskState(s, "music").cycle, 0);
  s.grid.links.L1 = true;
  assert.ok(toggleDevice(s, "L1").ok);
  assert.equal(
    powerSnapshot(s).loads.find((l) => l.id === "auto-music").enabled,
    false,
  );
  advance(s, 2);
  assert.equal(taskState(s, "music").cycle, 0);
  assert.ok(toggleDevice(s, "L1").ok);
  advance(s, 1.1);
  assert.equal(taskState(s, "music").cycle, 1);
  delete s.counts.L2;
  delete s.placements.L2;
  s.placements.L1 = { x: 20, z: 0, realm: "overworld" };
  assert.equal(gridConnected(s, "L1"), false);
  assert.deepEqual(companionTarget(s, "L1"), s.placements.L1);
  s.placements.L1.x = 3;
  s.chunks.overworld.push({ x: 1, z: 0 });
  s.layoutRevision++;
  assert.equal(gridConnected(s, "L1"), true);
});
