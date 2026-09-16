import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { makeActor } from "../src/objects.js";
import { copperGolem } from "../src/mob-models.js";
import { mobEnvelope, readMobActivity } from "../src/mob-motion.js";

const movingIds = [
  "V8",
  "V9",
  "V10",
  "V16",
  "N3",
  "N5",
  "N6",
  "N8",
  "N9",
  "E3",
  "E5",
  "E9",
];
function fixture(id, variant = 0) {
  const callbacks = [],
    root = makeActor(new T.Group(), id, callbacks, variant),
    parts = {};
  root.traverse((o) => {
    if (o.userData.mobPart) (parts[o.userData.mobPart] ||= []).push(o);
  });
  return {
    root,
    parts,
    callbacks,
    tick: (t) => callbacks.forEach((fn) => fn(t)),
  };
}
function pose(root) {
  const result = [];
  root.traverse((o) =>
    result.push([
      ...o.position.toArray(),
      ...o.rotation.toArray().slice(0, 3),
      ...o.scale.toArray(),
    ]),
  );
  return result;
}
function advance(f, start, end, hz = 60) {
  for (let i = Math.round(start * hz); i <= end * hz; i++) f.tick(i / hz);
}

test("activity follows actual ancestor movement, smooths start/stop, and reads game state without mutating it", () => {
  const ancestor = new T.Group(),
    actor = new T.Group(),
    model = new T.Group();
  ancestor.add(actor);
  actor.add(model);
  actor.userData.activity = "work";
  ancestor.userData.walking = true;
  assert.equal(
    readMobActivity(model),
    "walk",
    "powered nested model must still walk when its anchor moves",
  );
  ancestor.userData.walking = false;
  actor.userData.activity = { kind: "waiting" };
  assert.equal(readMobActivity(model), "idle");
  actor.userData.activity = { type: "working" };
  assert.equal(readMobActivity(model), "work");
  const motion = mobEnvelope(model),
    data = JSON.stringify(actor.userData);
  motion(0);
  for (let t = 1; t <= 60; t++) motion(t / 60);
  assert.ok(model.userData.mobMotion.work > 0.99);
  assert.equal(JSON.stringify(actor.userData), data);
  actor.userData.activity = "travel";
  const first = { ...motion(61 / 60) };
  assert.ok(first.walk > 0 && first.walk < 0.15);
  for (let t = 62; t <= 120; t++) motion(t / 60);
  actor.userData.activity = "idle";
  const stop = { ...motion(121 / 60) };
  assert.ok(stop.walk > 0.85, "stopping cannot instantly lock limbs at rest");
  const frozen = { ...motion(121 / 60) };
  assert.deepEqual({ ...motion(121 / 60) }, frozen);
});

test("four-legged animals have distinct hinged faces, ears, tails and diagonal walking gait", () => {
  for (const id of ["V8", "V9", "V10"]) {
    const f = fixture(id, 2);
    assert.equal(f.parts.leg.length, 4);
    assert.equal(f.parts.ear.length, 2);
    assert.equal(f.parts.tail.length, 1);
    assert.equal(f.parts.head.length, 1);
    f.tick(0);
    const resting = pose(f.root);
    advance(f, 0, 2);
    assert.notDeepEqual(
      pose(f.root),
      resting,
      id + " should breathe, look and flick ears while waiting",
    );
    assert.notEqual(f.parts.head[0].rotation.y, 0);
    assert.notEqual(f.parts.tail[0].rotation.x, 0);
    f.root.userData.walking = true;
    advance(f, 2, 3);
    const legs = f.parts.leg;
    assert.ok(Math.abs(legs[0].rotation.z) > 0.05);
    assert.ok(Math.abs(legs[0].rotation.z - legs[3].rotation.z) < 1e-9);
    assert.ok(Math.abs(legs[0].rotation.z + legs[1].rotation.z) < 1e-9);
    f.root.userData.walking = false;
    const before = legs[0].rotation.z;
    f.tick(3 + 1 / 60);
    assert.ok(Math.abs(legs[0].rotation.z - before) < 0.04);
  }
});

test("walking and waiting keep every grounded species above the terrain without changing collision-root scale", () => {
  for (const id of ["V8", "V9", "V10", "V16", "N5", "N8", "E3", "E5"]) {
    const f = fixture(id, 1),
      scale = f.root.scale.toArray();
    for (let frame = 0; frame < 360; frame++) {
      f.root.userData.activity =
        frame < 90 ? "idle" : frame < 240 ? "walk" : "work";
      f.tick(frame / 30);
      f.root.updateWorldMatrix(true, true);
      assert.deepEqual(
        f.root.scale.toArray(),
        scale,
        id + " must never squash its collision root",
      );
      const bounds = new T.Box3().setFromObject(f.root);
      assert.ok(
        bounds.min.y >= -1e-7,
        id + " feet cross the ground at frame " + frame,
      );
      if (["V8", "V9", "V10"].includes(id)) {
        assert.ok(
          bounds.max.x - bounds.min.x < 0.56,
          "animal stays inside its existing 0.3 radius",
        );
        assert.ok(bounds.min.y < 0.004, "one diagonal pair remains planted");
      }
    }
  }
});

test("iron golem breathes and surveys its surroundings, then settles gradually after walking", () => {
  const f = fixture("V16");
  f.tick(0);
  const initial = pose(f.root);
  advance(f, 0, 2);
  assert.notDeepEqual(pose(f.root), initial);
  assert.ok(Math.abs(f.parts.head[0].rotation.y) > 0.04);
  f.root.userData.activity = "walk";
  advance(f, 2, 4);
  const before = f.parts.leg[0].rotation.x;
  assert.ok(Math.abs(before) > 0.03);
  f.root.userData.activity = "waiting";
  f.tick(4 + 1 / 60);
  assert.ok(Math.abs(f.parts.leg[0].rotation.x - before) < 0.035);
  advance(f, 4 + 1 / 60, 5.5);
  assert.ok(Math.abs(f.parts.leg[0].rotation.x) < 0.0001);
});

test("blaze rings keep their voxel structure and speed up smoothly during real work", () => {
  const idle = fixture("N3"),
    work = fixture("N3");
  work.root.userData.activity = "work";
  advance(idle, 0, 1);
  advance(work, 0, 1);
  const a = idle.parts["blaze-rod"][0],
    b = work.parts["blaze-rod"][0],
    angleA = Math.atan2(a.position.x, a.position.z),
    angleB = Math.atan2(b.position.x, b.position.z);
  assert.ok(angleB > angleA * 1.7);
  assert.equal(work.parts["blaze-rod"].length, 12);
  assert.notDeepEqual(
    work.parts["rod-tier-0"][0].children[0].position.toArray(),
    work.parts["rod-tier-1"][0].children[0].position.toArray(),
  );
  work.root.userData.activity = "waiting";
  const before = b.position.clone();
  work.tick(1 + 1 / 60);
  assert.ok(
    b.position.distanceTo(before) < 0.015,
    "transition cannot jump between orbit phases",
  );
});

test("alien creatures articulate connected parts and show work separately from waiting", () => {
  for (const [id, part] of [
    ["N6", "tentacle"],
    ["N9", "head"],
    ["E5", "shell"],
    ["E9", "wing"],
    ["N5", "magma-layer"],
    ["E3", "arm"],
    ["N8", "arm"],
  ]) {
    const idle = fixture(id),
      work = fixture(id);
    work.root.userData.activity = "work";
    advance(idle, 0, 3);
    advance(work, 0, 3);
    assert.notDeepEqual(
      idle.parts[part].map(pose),
      work.parts[part].map(pose),
      id + " work differs from idle",
    );
  }
  const ghast = fixture("N6");
  for (const leg of ghast.parts.tentacle) {
    assert.equal(leg.parent, ghast.parts.body[0]);
    assert.equal(
      leg.position.y,
      -0.555,
      "tentacles pivot at body surface, not at their centre",
    );
  }
  const dragon = fixture("E9");
  for (let i = 1; i < dragon.parts.tail.length; i++)
    assert.equal(dragon.parts.tail[i].parent, dragon.parts.tail[i - 1]);
});

test("all creature animation reuses geometry/materials, stays finite and freezes at a held timestamp", () => {
  for (const id of movingIds) {
    const f = fixture(id),
      geometry = new Set(),
      materials = new Set();
    let meshes = 0;
    f.root.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        geometry.add(o.geometry);
        materials.add(o.material);
        assert.equal(o.geometry.type, "BoxGeometry");
      }
    });
    assert.equal(geometry.size, 1, id + " uses the shared box");
    const callbacks = f.callbacks.length;
    f.root.userData.activity = "work";
    advance(f, 0, 4);
    const frozen = pose(f.root);
    for (let i = 0; i < 10; i++) f.tick(4);
    assert.deepEqual(
      pose(f.root),
      frozen,
      id + " cannot animate while presentation time is paused",
    );
    let after = 0;
    f.root.traverse((o) => {
      if (o.isMesh) {
        after++;
        assert.ok(geometry.has(o.geometry));
        assert.ok(materials.has(o.material));
      }
    });
    assert.equal(after, meshes);
    assert.equal(f.callbacks.length, callbacks);
    assert.ok(pose(f.root).flat().every(Number.isFinite));
  }
});

test("copper geometry constructor remains neutral for resident-owned courier animation", () => {
  const model = copperGolem(new T.Group(), 1);
  assert.ok(model.root && model.head && model.body);
  assert.equal(model.arms.length, 2);
  assert.equal(model.legs.length, 2);
  assert.equal(model.head.position.y, 0.79);
  assert.equal(model.root.userData.mobMotion, undefined);
});
