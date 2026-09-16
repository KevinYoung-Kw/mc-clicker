import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { appearance } from "../src/residents.js";
import { makeResident, makeCopper } from "../src/companion-models.js";
import {
  identitySeed,
  residentActivity,
  sampleResidentPose,
  createResidentMotion,
  MOTION_JOBS,
} from "../src/resident-motion.js";

const resident = (job = "idle", id = "resident-3") => ({
  id,
  look: appearance(2),
  job,
  activity: job === "idle" ? "idle" : "working",
  skills: {},
  path: [],
  cargo: null,
});
const numeric = (pose) =>
  Object.fromEntries(
    Object.entries(pose).filter(([, v]) => typeof v === "number"),
  );
function parts(root, name) {
  const found = [];
  root.traverse((o) => {
    if (o.userData.mobPart === name) found.push(o);
  });
  return found;
}
function visibleBounds(root) {
  const b = new T.Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible((o) => {
    if (o.isMesh) b.union(new T.Box3().setFromObject(o));
  });
  return b;
}
function rig(r, options) {
  const root = new T.Group(),
    animations = [],
    model = makeResident(root, r, animations, options);
  return { root, model, run: (t) => animations.forEach((fn) => fn(t)) };
}

test("job routines contain distinct meaningful phases and wait states never pretend to work", () => {
  const expected = {
    farmer: ["harvest", "adjust-hat", "inspect-crops"],
    miner: ["windup", "pick-strike", "recover"],
    rancher: ["shear", "check-flock"],
    crafter: ["hammer", "inspect-craft"],
    hauler: ["sort-cargo"],
    merchant: ["count-sale", "greet-customer"],
    musician: ["cue-record", "keep-beat"],
    engineer: ["tune-sequencer"],
    stagehand: ["signal-program", "check-stage"],
    host: ["speak"],
    researcher: ["read-research"],
  };
  const fingerprints = [];
  for (const job of MOTION_JOBS.filter((j) => j !== "idle")) {
    const r = resident(job),
      actions = new Set(),
      poses = [];
    for (let t = 0; t < 35; t += 0.13) {
      const p = sampleResidentPose(r, t, { speaking: true });
      actions.add(p.action);
      poses.push(numeric(p));
    }
    expected[job].forEach((action) =>
      assert.ok(actions.has(action), `${job}: ${action}`),
    );
    fingerprints.push(JSON.stringify(poses));
    r.activity = "waiting";
    assert.equal(
      sampleResidentPose(r, 3).action,
      job === "host" ? "listen" : "watch-workplace",
    );
  }
  assert.equal(new Set(fingerprints).size, MOTION_JOBS.length-1);
});

test("stable identity de-synchronizes neighbors without random calls or saved-state mutation", () => {
  const poses = [],
    before = [];
  for (let i = 0; i < 12; i++) {
    const r = resident("miner", `resident-${i + 1}`);
    before.push(structuredClone(r));
    const p = sampleResidentPose(r, 8.25);
    assert.deepEqual(p, sampleResidentPose(r, 8.25));
    poses.push(p.armRX + ":" + p.phase);
    assert.deepEqual(r, before[i]);
    assert.ok(identitySeed(r.id) >= 0 && identitySeed(r.id) < 1);
  }
  assert.equal(new Set(poses).size, 12);
});

test("new activity metadata and legacy saved rows select the same honest locomotion semantics", () => {
  assert.equal(residentActivity({ activity: "walk" }), "travel");
  assert.equal(
    residentActivity({ activity: { kind: "working" }, path: [{}] }),
    "working",
  );
  assert.equal(
    residentActivity({ activity: "waiting", cargo: { amount: 1 } }),
    "waiting",
  );
  assert.equal(residentActivity({ path: [{}], job: "farmer" }), "travel");
  assert.equal(residentActivity({ cargo: { amount: 1 } }), "carrying");
  assert.equal(residentActivity({ handover: 2, job: "miner" }), "handover");
  assert.equal(residentActivity({ job: "idle" }), "idle");
  assert.equal(residentActivity({ job: "farmer" }), "working");
});

test("walking to waiting blends smoothly and a frozen clock still reflects a new activity", () => {
  const r = resident("miner");
  r.activity = "travel";
  const motion = createResidentMotion(r),
    start = motion(4);
  r.activity = "waiting";
  const target = sampleResidentPose(r, 4.016),
    next = motion(4.016);
  for (const key of ["armRX", "legL", "bodyPitch"]) {
    assert.ok(
      Math.abs(next[key] - start[key]) <
        Math.abs(target[key] - start[key]) + 0.000001,
      key,
    );
  }
  r.activity = "handover";
  const frozen = motion(4.016);
  assert.equal(frozen.action, "handover");
  assert.ok(frozen.armRX < -0.5);
  for (const time of [NaN, Infinity, -100, 1e20, 1e20 + 0.01]) {
    const p = motion(time);
    for (const v of Object.values(numeric(p))) assert.ok(Number.isFinite(v));
  }
});

test("every resident has real torso-head-shoulder-elbow hierarchy and feet stay planted", () => {
  for (const job of MOTION_JOBS) {
    const r = resident(job),
      before = structuredClone(r),
      { root, model, run } = rig(r);
    const body = parts(model, "body")[0],
      head = parts(model, "head")[0],
      arms = parts(model, "arm"),
      elbows = parts(model, "elbow");
    assert.equal(head.parent, body);
    assert.ok(arms.every((a) => a.parent === body));
    assert.ok(elbows.every((e) => arms.includes(e.parent)));
    const position = model.position.toArray(),
      yaw = model.rotation.y;
    for (const activity of [
      "working",
      "travel",
      "waiting",
      "handover",
      "rest",
      "idle",
    ]) {
      r.activity = activity;
      for (let t = 0; t < 5; t += 0.1) {
        run(t);
        const b = visibleBounds(root);
        assert.ok(
          Math.abs(b.min.y) < 1e-6,
          `${job} ${activity} must keep a planted foot: ${b.min.y}`,
        );
        assert.ok(b.max.y < 1.3, `${job} height`);
        model.traverse((o) => {
          assert.ok(
            [
              ...o.position.toArray(),
              ...o.scale.toArray(),
              o.rotation.x,
              o.rotation.y,
              o.rotation.z,
            ].every(Number.isFinite),
          );
        });
      }
    }
    r.activity = before.activity;
    assert.deepEqual(r, before);
    assert.deepEqual(model.position.toArray(), position);
    assert.equal(model.rotation.y, yaw);
  }
});

test("indoor host keeps the resident identity and fits the reserved floor space", () => {
  const r = resident("host"),
    { root, model, run } = rig(r, {
      indoor: true,
      scale: 1,
      speaking: () => true,
    });
  assert.equal(model.userData.resident, r.id);
  assert.equal(model.scale.x, r.look.height);
  for (let t = 0; t < 22; t += 0.1) {
    run(t);
    const b = visibleBounds(root);
    assert.ok(
      b.min.x >= -0.375 &&
        b.max.x <= 0.375 &&
        b.min.z >= -0.5 &&
        b.max.z <= 0.5,
      JSON.stringify(b),
    );
    assert.equal(model.userData.residentMotion.action, "speak");
  }
  assert.equal(parts(model, "hand-tool").length, 1);
});

test("copper courier looks around, picks up, carries and settles without moving its simulation position", () => {
  const a = {
      id: "golem-2",
      upgrades: { basket: 1, sorting: 1, bell: 1 },
      activity: "idle",
      path: [],
      cargo: null,
    },
    before = structuredClone(a),
    root = new T.Group(),
    animations = [];
  const model = makeCopper(root, a, animations),
    run = (t) => animations.forEach((fn) => fn(t));
  run(0);
  const head = parts(model, "head")[0],
    start = head.rotation.y;
  for (let t = 0.1; t < 2; t += 0.1) run(t);
  assert.notEqual(head.rotation.y, start);
  a.activity = "working";
  for (let t = 2; t < 4; t += 0.1) run(t);
  assert.equal(model.userData.courierMotion.action, "sort-cargo");
  a.activity = "travel";
  a.path = [{}];
  a.cargo = { amount: 3 };
  for (let t = 4; t < 6; t += 0.1) run(t);
  assert.ok(parts(model, "cargo")[0].visible);
  assert.ok(parts(model, "arm").every((p) => p.rotation.x < -0.95));
  a.activity = "idle";
  a.path = [];
  a.cargo = null;
  for (let t = 6; t < 8; t += 0.1) run(t);
  assert.equal(parts(model, "cargo")[0].visible, false);
  assert.deepEqual(model.position.toArray(), [0, 0, 0]);
  assert.deepEqual(a, before);
  assert.equal(head.parent, parts(model, "body")[0]);
});
