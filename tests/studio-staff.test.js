import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, advance, action, rates } from "../src/game.js";
import {
  ensureCommunity,
  assignJob,
  recallResident,
  residentBase,
  baseIncome,
  studioResidents,
  studioStaffJob,
  activeHost,
  jobSlots,
} from "../src/residents.js";
import {
  advanceOperations,
  companionActors,
  companionNavigation,
  prepareCompanionPositions,
  visibleCompanions,
  COMPANION_RADIUS,
  COMPANION_SPACING,
  taskState,
} from "../src/operations.js";
import { powerSnapshot } from "../src/power.js";
import { residentFixture } from "../scripts/resident-fixture.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function arrive(s, predicate = () => !!activeHost(s)) {
  for (let i = 0; i < 800 && !predicate(); i++) advance(s, 0.25);
  assert.ok(
    predicate(),
    JSON.stringify(
      s.community.residents.map((r) => ({
        id: r.id,
        job: r.job,
        room: r.room,
        status: r.status,
      })),
    ),
  );
}
function spacing(s) {
  const actors = companionActors(s),
    nav = companionNavigation(s);
  for (const a of actors) {
    assert.ok(nav.clear(a.x, a.z, COMPANION_RADIUS), a.id);
    for (const b of actors)
      if (a.id !== b.id)
        assert.ok(
          Math.hypot(a.x - b.x, a.z - b.z) >= COMPANION_SPACING - 1e-7,
          `${a.id}/${b.id}`,
        );
  }
}

test("buying L4 opens a seat without inventing or assigning a host", () => {
  const s = residentFixture(),
    people = s.community.residents.length;
  assert.ok(s.counts.L4);
  assert.equal(activeHost(s), null);
  assert.deepEqual(studioResidents(s), []);
  assert.equal(action(s, "host").ok, false);
  assert.equal(rates(s).hostIncome, 0);
  const before = rates(s).live;
  delete s.counts.L4;
  close(rates(s).live, before);
  assert.equal(s.community.residents.length, people);
  const viewers = s.live.viewers;
  advance(s, 2);
  assert.ok(s.live.viewers > viewers, "unattended channel still runs");
});

test("one real villager reserves the host seat, walks to the entrance and hands over before boosting", () => {
  const s = residentFixture(),
    r = s.community.residents[0],
    b = residentBase(s, r), initialBase=r.baseEarned, initialPlay=s.play;
  assert.ok(assignJob(s, r.id, "host").ok);
  assert.equal(jobSlots(s, "host"), 1);
  s.counts.L4 = 6;
  assert.equal(jobSlots(s, "host"), 1);
  assert.equal(assignJob(s, "resident-2", "host").ok, false);
  assert.equal(studioStaffJob(r, s), "host");
  assert.equal(activeHost(s), null);
  assert.equal(action(s, "host").ok, false);
  const states = new Set();
  for (let i = 0; i < 800 && !activeHost(s); i++) {
    advance(s, 0.1);
    states.add(r.activity);
    if (r.room !== "studio") assert.equal(rates(s).hostIncome, 0);
    spacing(s);
  }
  assert.equal(activeHost(s), r);
  assert.ok(states.has("travel"));
  assert.ok(states.has("handover"));
  assert.ok(rates(s).hostIncome > 0);
  close(r.baseEarned-initialBase, (s.play-initialPlay) * b);
  assert.equal(r.handover, 0);
  assert.equal(r.activity, "working");
});

test("hosting attributes only already-paid livestream uplift and never adds a second payout", () => {
  const s = residentFixture();
  assignJob(s, "resident-1", "host");
  arrive(s);
  const host = activeHost(s),
    beforeRate = rates(s),
    oldJob = host.jobEarned,
    oldLive = s.live.income,
    oldB = host.baseEarned,
    b = residentBase(s, host);
  advance(s, 0.25);
  close(host.jobEarned - oldJob, beforeRate.hostIncome * 0.25);
  close(s.live.income - oldLive, beforeRate.live * 0.25);
  close(host.baseEarned - oldB, b * 0.25);
  // At a quiet point, the operations side is allowed to mint B only. Host
  // income belongs to game.tick's live settlement, never to an animation.
  for (const g of s.community.golems) g.stops = [];
  s.live.gifts = [];
  for (const task of Object.values(s.community.tasks)) task.manual = false;
  const payouts = [];
  advanceOperations(
    s,
    0.01,
    {
      earn: (_s, v) => payouts.push(v),
      emit: () => null,
      collectGift: () => null,
    },
    powerSnapshot(s, 0.01),
  );
  close(
    payouts.reduce((a, b) => a + b, 0),
    baseIncome(s) * 0.01,
  );
});

test("host books scale the extra revenue only, and viewer growth requires actual arrival", () => {
  const s = residentFixture();
  assignJob(s, "resident-1", "host");
  arrive(s);
  const host = activeHost(s),
    base = rates(s).live - rates(s).hostIncome,
    first = rates(s).hostIncome;
  host.skills.music = 3;
  close(rates(s).hostIncome, first * 1.5);
  close(rates(s).live - rates(s).hostIncome, base);
  const plain = fresh(0);
  Object.assign(plain.counts, { V2: 1, L1: 1, L2: 1, L4: 1 });
  plain.live.viewers = 100;
  ensureCommunity(plain);
  const staffed = structuredClone(plain),
    r = staffed.community.residents[0];
  r.job = "host";
  r.room = "studio";
  advance(plain, 0.1);
  advance(staffed, 0.1);
  close(staffed.live.viewers - 100, (plain.live.viewers - 100) * 1.5);
});

test("revoking the host removes only host-specific heat, with safe non-overlapping exit", () => {
  const s = residentFixture();
  assignJob(s, "resident-1", "host");
  arrive(s);
  const r = activeHost(s);
  s.counts.L10 = 1;
  s.live.director = true;
  s.live.heat = 9;
  assert.ok(action(s, "host").ok);
  assert.equal(
    s.live.heat,
    9,
    "auto-director must not leak host heat into ordinary heat",
  );
  assert.ok(s.live.hostHeat > 0);
  const beforeB = residentBase(s, r),
    revision = s.community.revision;
  assert.ok(assignJob(s, r.id, "idle").ok);
  assert.equal(activeHost(s), null);
  assert.equal(r.room, null);
  assert.equal(rates(s).hostIncome, 0);
  assert.equal(s.live.hostHeat, 0);
  assert.equal(s.live.host, 0);
  assert.equal(s.live.heat, 9);
  assert.ok(s.community.revision > revision);
  assert.equal(action(s, "host").ok, false);
  prepareCompanionPositions(s);
  assert.ok(companionActors(s).includes(r));
  spacing(s);
  close(residentBase(s, r), beforeB);
});

test("ordinary audience replies work without a host and use an independent cooldown", () => {
  const s = residentFixture();
  s.counts.L5 = 1;
  s.live.heat = 0;
  assert.ok(action(s, "respond").ok);
  assert.equal(s.live.host, 0);
  assert.equal(s.live.respondCooldown, 5);
  assert.equal(s.live.heat, 5);
  assert.equal(action(s, "respond").ok, false);
  assert.equal(action(s, "host").ok, false);
});

test("a recalled reservist does not leave an active or duplicated host behind", () => {
  const s = residentFixture();
  s.counts.V2 = 25;
  ensureCommunity(s);
  assignJob(s, "resident-1", "host");
  arrive(s);
  const r = activeHost(s);
  action(s, "host");
  assert.ok(recallResident(s, "resident-25", r.id).ok);
  assert.ok(r.reserve);
  assert.equal(r.room, null);
  assert.equal(activeHost(s), null);
  assert.equal(s.live.hostHeat, 0);
  assert.ok(!companionActors(s).includes(r));
  assert.ok(recallResident(s, r.id, "resident-25").ok);
  prepareCompanionPositions(s);
  spacing(s);
  assert.equal(r.job, "idle");
  assert.equal(r.room, null);
  assert.equal(activeHost(s), null);
});

test("the same musician moves indoors after L2 and reload never duplicates either worker", () => {
  const s = residentFixture();
  delete s.counts.L2;
  s.placements.L1 = { ...s.placements.L2, realm: "overworld" };
  delete s.placements.L2;
  s.layoutRevision++;
  assignJob(s, "resident-1", "musician");
  arrive(s, () => s.community.residents[0].jobEarned > 0);
  const r = s.community.residents[0],
    earned = r.jobEarned,
    look = JSON.stringify(r.look);
  assert.equal(r.room, null);
  s.counts.L2 = 1;
  s.placements.L2 = { ...s.placements.L1 };
  delete s.placements.L1;
  s.layoutRevision++;
  assignJob(s, "resident-2", "host");
  arrive(s, () => studioResidents(s).length === 2);
  assert.equal(
    studioResidents(s).find((x) => x.job === "musician"),
    r,
  );
  assert.ok(r.jobEarned >= earned);
  assert.equal(JSON.stringify(r.look), look);
  const copy = restore(s);
  assert.deepEqual(
    studioResidents(copy)
      .map((x) => x.id)
      .sort(),
    ["resident-1", "resident-2"],
  );
  assert.equal(copy.community.residents.length, s.community.residents.length);
  assert.equal(
    new Set(copy.community.residents.map((x) => x.id)).size,
    copy.community.residents.length,
  );
  assert.ok(
    !companionActors(copy).some((x) =>
      ["resident-1", "resident-2"].includes(x.id),
    ),
  );
});

test("old L4 saves keep their real residents and historical earnings without inventing a host", () => {
  const old = residentFixture();
  old.live.host = 21;
  old.live.heat = 17;
  old.live.hostHeat = 20;
  old.community.residents[0].baseEarned = 4321;
  old.community.residents[0].jobEarned = 2345;
  const copy = restore(old);
  assert.equal(activeHost(copy), null);
  assert.equal(copy.live.host, 0);
  assert.equal(copy.live.hostHeat, 0);
  assert.equal(copy.live.heat, 17);
  assert.equal(copy.money, old.money);
  assert.equal(copy.live.peak, old.live.peak);
  assert.equal(copy.community.residents[0].baseEarned, 4321);
  assert.equal(copy.community.residents[0].jobEarned, 2345);
});

test("restore rejects duplicate host seats and invalid room claims, then safely admits former staff outdoors", () => {
  const raw = residentFixture();
  for (const r of raw.community.residents.slice(0, 2)) {
    r.job = "host";
    r.room = "studio";
  }
  raw.community.residents[2].job = "farmer";
  raw.community.residents[2].room = "studio";
  const copy = restore(raw);
  assert.deepEqual(
    studioResidents(copy).map((r) => r.id),
    ["resident-1"],
  );
  assert.equal(copy.community.residents[1].job, "idle");
  assert.equal(copy.community.residents[2].room, null);
  prepareCompanionPositions(copy);
  spacing(copy);
  assert.ok(companionActors(copy).some((r) => r.id === "resident-2"));
  assert.ok(companionActors(copy).some((r) => r.id === "resident-3"));
  delete raw.counts.L2;
  const noRoom = restore(raw);
  assert.equal(activeHost(noRoom), null);
  assert.deepEqual(studioResidents(noRoom), []);
  prepareCompanionPositions(noRoom);
  spacing(noRoom);
});

test("indoor staff consume neither outdoor collision positions nor visible companion budget", () => {
  const s = residentFixture();
  s.counts.V2 = 12;
  ensureCommunity(s);
  assignJob(s, "resident-1", "host");
  assignJob(s, "resident-2", "musician");
  arrive(s, () => studioResidents(s).length === 2);
  const actors = companionActors(s),
    visible = visibleCompanions(s, "resident-1");
  assert.ok(!actors.some((r) => r.room === "studio"));
  assert.ok(!visible.some((r) => r.room === "studio"));
  assert.equal(actors.length, 10 + s.community.golems.length);
  spacing(s);
  assert.equal(s.community.residents.length, 12);
});

test("idle strolling uses short real paths and awards no job money", () => {
  const s = fresh(0);
  s.counts.V2 = 3;
  ensureCommunity(s);
  prepareCompanionPositions(s);
  const original = s.community.residents.map((r) => ({ x: r.x, z: r.z }));
  let moved = false,
    sawTravel = false;
  const allowed = new Set([
    "idle",
    "travel",
    "working",
    "waiting",
    "handover",
    "carrying",
  ]);
  for (let i = 0; i < 500; i++) {
    const before = s.community.residents.map((r) => ({ x: r.x, z: r.z }));
    advance(s, 0.1);
    spacing(s);
    for (let j = 0; j < s.community.residents.length; j++) {
      const r = s.community.residents[j];
      assert.ok(allowed.has(r.activity));
      assert.ok(
        Math.hypot(r.x - before[j].x, r.z - before[j].z) <= 0.141,
        "movement must not teleport",
      );
      if (Math.hypot(r.x - original[j].x, r.z - original[j].z) > 0.4)
        moved = true;
      if (r.activity === "travel") sawTravel = true;
      assert.equal(r.jobEarned, 0);
    }
  }
  assert.ok(moved && sawTravel);
  close(s.money, baseIncome(s) * s.play);
  assert.equal(taskState(s, "music").cycle, 0);
});
