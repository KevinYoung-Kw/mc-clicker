import test from "node:test";
import assert from "node:assert/strict";
import { advance, restore, move } from "../src/game.js";
import { assignJob, residentBase } from "../src/residents.js";
import {
  companionActors,
  companionNavigation,
  COMPANION_RADIUS,
  COMPANION_SPACING,
} from "../src/operations.js";
import { buildingObstacles } from "../src/layout.js";
import { Navigation } from "../src/navigation.js";
import { residentFixture } from "../scripts/resident-fixture.mjs";

test("field path admits villagers but not oversized bodies, while planted beds stay solid", () => {
  const nav = new Navigation(
    [{ x: 0, z: 0 }],
    buildingObstacles("V4", { x: 0, z: 0 }),
  );
  assert.ok(nav.segment({ x: 0, z: -1.5 }, { x: 0, z: 1.5 }, COMPANION_RADIUS));
  assert.equal(nav.segment({ x: 0, z: -1.5 }, { x: 0, z: 1.5 }, 0.4), false);
  assert.equal(nav.clear(0.65, 0, COMPANION_RADIUS), false);
});

test("farm rotation redirects real work rounds into the new passage without stopping the job",()=>{
  const s=residentFixture(),farm=s.placements.V4;
  assert.equal(move(s,'V4',{...farm,rotation:1}),true);
  assert.equal(assignJob(s,'resident-1','farmer').ok,true);
  let inField=false;
  for(let i=0;i<1200;i++){
    advance(s,.1);const r=s.community.residents[0];
    assert.ok(companionNavigation(s).clear(r.x,r.z,COMPANION_RADIUS));
    if(Math.abs(r.z-farm.z)<.15&&Math.abs(r.x-farm.x)<.75)inField=true;
  }
  assert.ok(inField,'farmer entered the east-west aisle');
  assert.ok(s.community.residents[0].jobsDone>0);
});

test("profession rounds physically change work positions and preserve production, B and collision clearance", () => {
  const s = residentFixture();
  const initialPlay=s.play, initialBase=s.community.residents.map(r=>r.baseEarned);
  const roles = ["farmer", "rancher", "miner", "crafter", "engineer"];
  const moved = roles.map(() => 0),
    positions = roles.map(() => new Set());
  roles.forEach((job, i) =>
    assert.ok(assignJob(s, `resident-${i + 1}`, job).ok),
  );
  let inField = false;
  for (let i = 0; i < 1400; i++) {
    const before = s.community.residents.map((r) => ({ x: r.x, z: r.z }));
    advance(s, 0.1);
    const nav = companionNavigation(s),
      actors = companionActors(s);
    for (let j = 0; j < roles.length; j++) {
      const r = s.community.residents[j],
        d = Math.hypot(r.x - before[j].x, r.z - before[j].z);
      if (i > 0) assert.ok(d <= 0.141, `${r.job} walks, never teleports: ${d}`);
      assert.ok(nav.clear(r.x, r.z, COMPANION_RADIUS));
      if (r.workTour && d > 0) moved[j] += d;
      if (r.workSpot && !r.path.length)
        positions[j].add(`${r.x.toFixed(1)},${r.z.toFixed(1)}`);
      const farm = s.placements.V4;
      if (
        r.job === "farmer" &&
        Math.abs(r.x - farm.x) < 0.15 &&
        Math.abs(r.z - farm.z) < 0.75
      )
        inField = true;
    }
    for (const a of actors)
      for (const b of actors)
        if (a !== b)
          assert.ok(
            Math.hypot(a.x - b.x, a.z - b.z) >= COMPANION_SPACING - 1e-7,
          );
  }
  assert.ok(inField, "farmer actually works inside the field along its path");
  roles.forEach((job, i) => {
    const r = s.community.residents[i];
    assert.ok(moved[i] > 0.65, `${job}: local movement ${moved[i]}`);
    assert.ok(positions[i].size >= 2, `${job}: distinct working positions`);
    assert.ok(r.jobsDone > 0, `${job}: actual job continues`);
    assert.ok(
      Math.abs(r.baseEarned-initialBase[i] - residentBase(s, r) * (s.play-initialPlay)) < 1e-5,
      `${job}: full B preserved`,
    );
  });
});

test("saved work rounds and reassignment do not retain stale routes or change personal history", () => {
  let s = residentFixture();
  assignJob(s, "resident-1", "farmer");
  for (let i = 0; i < 600 && !s.community.residents[0].workTour; i++)
    advance(s, 0.1);
  const old = s.community.residents[0];
  assert.ok(old.workTour);
  s = restore(JSON.parse(JSON.stringify(s)));
  const r = s.community.residents[0];
  assert.equal(r.name, old.name);
  assert.equal(r.baseEarned, old.baseEarned);
  assert.ok(assignJob(s, r.id, "miner").ok);
  assert.equal(r.workTour, false);
  assert.equal(r.path.length, 0);
  assert.equal(r.workMoveAt, 0);
  advance(s, 50);
  assert.equal(r.job, "miner");
  assert.ok(r.jobsDone > 0);
});
