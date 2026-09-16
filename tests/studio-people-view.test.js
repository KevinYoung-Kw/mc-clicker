import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { fresh } from "../src/game.js";
import { ensureStudio } from "../src/studio-placement.js";
import { studioStaffPlaces } from "../src/studio-staff-layout.js";
import { studioDeviceModel } from "../src/studio-device-models.js";
import { World } from "../src/world.js";

test("host workstation is a grounded facility and does not manufacture a resident", () => {
  const g = studioDeviceModel(new T.Group(), "L4", fresh(), []);
  let residents = 0;
  g.traverse((o) => {
    if (o.userData.resident || o.userData.mobPart === "head") residents++;
  });
  assert.equal(residents, 0);
  const bounds = new T.Box3().setFromObject(g);
  assert.ok(Math.abs(bounds.min.y - 0.2) < 1e-6);
  assert.ok(bounds.max.x - bounds.min.x <= 0.75);
  assert.ok(bounds.max.z - bounds.min.z <= 1);
});

test("indoor staff follow the real record player while retaining separate safe floor positions", () => {
  const s = fresh();
  s.counts = {
    L1: 1,
    L2: 1,
    L3: 3,
    L4: 1,
    L6: 1,
    L10: 1,
    L12: 1,
    L13: 1,
    L14: 1,
  };
  ensureStudio(s);
  const people = [
    { id: "h", job: "host" },
    { id: "m", job: "musician" },
  ];
  const before = JSON.stringify(s);
  const spots = studioStaffPlaces(s, people);
  assert.equal(JSON.stringify(s), before);
  assert.equal(spots.size, 2);
  assert.ok(
    Math.hypot(
      spots.get("h").x - spots.get("m").x,
      spots.get("h").z - spots.get("m").z,
    ) > 0.6,
  );
  const first = spots.get("m");
  assert.ok(
    Math.hypot(
      first.x - s.studio.placements.L1.x,
      first.z - s.studio.placements.L1.z,
    ) < 1.5,
  );
  s.studio.placements.L1 = { x: 2.5, z: 1.75, rotation: 0 };
  const moved = studioStaffPlaces(s, people).get("m");
  assert.ok(moved.x > 0 && Math.abs(moved.x) <= 2.5 && Math.abs(moved.z) <= 2);
  assert.notDeepEqual(first, moved);
});

test("canvas resize redraws an existing frame synchronously without advancing game state", () => {
  const oldDocument = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const calls = [],
      s = fresh(),
      before = JSON.stringify(s);
    const w = Object.create(World.prototype);
    Object.assign(w, {
      container: { getBoundingClientRect: () => ({ width: 390, height: 582 }) },
      renderer: {
        setSize: (width, height) => calls.push(["size", width, height]),
        render: () => calls.push(["render"]),
      },
      camera: new T.OrthographicCamera(),
      scene: new T.Scene(),
      graph: new T.Group(),
      state: s,
      hasRenderedFrame: true,
      renderWidth: 390,
      renderHeight: 537,
      zoom: 1,
      update: (force, repaint) => calls.push(["render", force, repaint]),
    });
    w.resize();
    assert.deepEqual(calls, [
      ["size", 390, 582],
      ["render", false, true],
    ]);
    assert.equal(JSON.stringify(s), before);
    w.resize();
    assert.equal(calls.length, 2, "same-size pointer moves do not add renders");
    w.renderHeight = 537;
    globalThis.document.hidden = true;
    w.resize();
    assert.equal(calls.filter(([kind]) => kind === "render").length, 1);
  } finally {
    globalThis.document = oldDocument;
  }
});
