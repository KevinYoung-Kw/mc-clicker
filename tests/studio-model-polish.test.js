import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { fresh } from "../src/game.js";
import { studioSpec } from "../src/studio-placement.js";
import {
  studioDeviceModel,
  STUDIO_MODEL_IDS,
} from "../src/studio-device-models.js";
import { broadcastHouse } from "../src/village-models.js";
import { decorateStudio } from "../src/studio-decoration.js";

function fixture() {
  const s = fresh(0);
  for (let i = 1; i <= 14; i++) s.counts[`L${i}`] = 5;
  s.live.gifts = Array.from({ length: 5 }, (_, id) => ({ id }));
  s.live.rainCooldown = 40;
  s.live.host = 1;
  s.live.director = true;
  s.grid.last = { perDevice: { L12: 1 } };
  return s;
}
function render(id, state = fixture()) {
  const root = new T.Group(),
    animations = [];
  studioDeviceModel(root, id, state, animations);
  return { root, animations };
}
function boxes(root) {
  root.updateMatrixWorld(true);
  const result = [];
  root.traverseVisible((m) => {
    if (m.isMesh)
      result.push({ mesh: m, bounds: new T.Box3().setFromObject(m) });
  });
  return result;
}
function touching(a, b) {
  return ["x", "y", "z"].every(
    (axis) =>
      a.min[axis] <= b.max[axis] + 1e-6 && b.min[axis] <= a.max[axis] + 1e-6,
  );
}
function connected(boxes, start) {
  const seen = new Set(start);
  for (const i of seen)
    for (let j = 0; j < boxes.length; j++)
      if (!seen.has(j) && touching(boxes[i].bounds, boxes[j].bounds))
        seen.add(j);
  return seen;
}

test("all thirteen room devices use the actual placement scale throughout their animations", () => {
  const floor = ["L1", "L3", "L4", "L6", "L10", "L12", "L13", "L14"];
  for (const id of STUDIO_MODEL_IDS) {
    const { root, animations } = render(id),
      spec = studioSpec(id === "L3" ? "L3:0" : id);
    for (const time of [0, 0.8, 2.4, 4.7]) {
      animations.forEach((run) => run(time));
      const b = new T.Box3().setFromObject(root);
      assert.ok(
        b.min.x >= -spec.w / 2 - 1e-6 && b.max.x <= spec.w / 2 + 1e-6,
        `${id} width ${JSON.stringify(b)}`,
      );
      assert.ok(
        b.min.z >= -spec.d / 2 - 1e-6 && b.max.z <= spec.d / 2 + 1e-6,
        `${id} depth ${JSON.stringify(b)}`,
      );
      assert.ok(b.max.y <= 2.28 + 1e-6, id);
      if (floor.includes(id)) assert.ok(Math.abs(b.min.y - 0.2) < 1e-6, id);
      assert.ok(
        boxes(root).every(({ mesh }) => mesh.geometry.type === "BoxGeometry"),
        id,
      );
      assert.ok(
        boxes(root).some(({ mesh }) => mesh.material.map?.isDataTexture),
        id,
      );
    }
  }
});

test("camera head and celebration banner have a continuous physical support path to the floor", () => {
  for (const id of ["L3", "L14"]) {
    const parts = boxes(render(id).root),
      starts = parts.flatMap((p, i) =>
        Math.abs(p.bounds.min.y - 0.2) < 1e-6 ? [i] : [],
      );
    const supported = connected(parts, starts);
    const tallest = Math.max(...parts.map((p) => p.bounds.max.y));
    assert.ok(
      parts.some((p, i) => p.bounds.max.y === tallest && supported.has(i)),
      `${id} upper assembly lacks support`,
    );
  }
});

test("wall screens and ceiling projector connect to a visible mounting assembly", () => {
  for (const id of ["L5", "L7", "L8", "L9", "L11"]) {
    const parts = boxes(render(id).root),
      mounts = parts.flatMap((p, i) =>
        p.mesh.userData.studioMount ? [i] : [],
      );
    assert.equal(mounts.length, 1, id);
    const supported = connected(parts, mounts);
    assert.ok(supported.size >= 4, id);
    if (id !== "L7")
      assert.ok(
        parts[mounts[0]].bounds.min.z <= -0.079,
        `${id} mount misses wall`,
      );
    else assert.ok(Math.abs(parts[mounts[0]].bounds.max.y - 2.28) < 1e-6);
  }
});

test("shop and placed room resolve each channel component to the same shared model", () => {
  const root = new T.Group();
  broadcastHouse(root, [], true, fixture());
  const models = new Set();
  root.traverse((o) => {
    if (o.userData.studioModel) models.add(o.userData.studioModel);
  });
  assert.deepEqual([...models].sort(), [...STUDIO_MODEL_IDS].sort());
  const iconSource = readFileSync(
    new URL("../scripts/icon-studio.html", import.meta.url),
    "utf8",
  );
  assert.match(iconSource, /studioDeviceModel\(root, id, s, animations\)/);
  assert.match(iconSource, /STUDIO_MODEL_IDS\.includes\(id\)/);
});

test("equipped acoustic walls sit in front of base paneling rather than sharing its face", () => {
  for (const index of [0, 1]) {
    const state = fresh(0),
      root = new T.Group();
    state.scenery.equipped.studioWall = `studioWall-${index}`;
    decorateStudio(root, state);
    let wall;
    root.traverse((o) => {
      if (o.userData.studioDecoration === `studioWall-${index}`) wall = o;
    });
    const slats = boxes(wall).filter(({ mesh }) => mesh.scale.y > 1);
    assert.equal(slats.length, 18);
    assert.ok(
      slats.every(({ bounds }) => bounds.min.z > -2.293),
      "overlay must not coplane with base front face",
    );
  }
});

test("desktop equipment follows the actual plain or decorated worktop without a hovering gap", () => {
  for (const style of [null, "studioDesk-0", "studioDesk-1"]) {
    const state = fresh(0),
      root = new T.Group();
    if (style) state.scenery.equipped.studioDesk = style;
    broadcastHouse(root, [], true, state);
    let equipment;
    root.traverse((o) => {
      if (o.userData.studioDesktopEquipment) equipment = o;
    });
    assert.ok(equipment);
    const b = new T.Box3().setFromObject(equipment);
    assert.ok(
      Math.abs(b.min.y - (style ? 0.898 : 0.87)) < 1e-6,
      `${style} ${b.min.y}`,
    );
  }
});
