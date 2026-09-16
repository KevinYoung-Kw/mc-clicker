import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { ITEMS } from "../src/catalog.js";
import { fresh, restore, advance, buy } from "../src/game.js";
import { STUDIO, STUDIO_DEVICE_IDS } from "../src/studio-layout.js";
import { footprint, canPlace } from "../src/layout.js";
import { broadcastHouse } from "../src/village-models.js";
import { decorateStudio } from "../src/studio-decoration.js";

function room(state = fresh(0), interior = true) {
  const root = new T.Group(),
    animations = [];
  broadcastHouse(root, animations, interior, state);
  return { root, animations };
}
function equipment(root) {
  const items = [];
  root.traverse((o) => {
    if (o.userData.studioEquipment) items.push(o);
  });
  return items;
}
function withinRoom(object) {
  const b = new T.Box3().setFromObject(object);
  assert.ok(
    b.min.x >= -STUDIO.width / 2 && b.max.x <= STUDIO.width / 2,
    JSON.stringify(b),
  );
  assert.ok(
    b.min.z >= -STUDIO.depth / 2 && b.max.z <= STUDIO.depth / 2,
    JSON.stringify(b),
  );
  assert.ok(b.min.y >= -1e-6 && b.max.y < 2.4, JSON.stringify(b));
}
function fullStudio() {
  const s = fresh(0);
  for (const id of ["L2", ...STUDIO_DEVICE_IDS]) s.counts[id] = ITEMS[id].max;
  s.live.gifts = Array.from({ length: 5 }, (_, id) => ({ id }));
  s.live.rainCooldown = 40;
  s.live.host = 1;
  s.grid.last = { perDevice: { L12: 1 } };
  return s;
}

test("the separate studio preserves human furniture scale behind a two by two entrance", () => {
  assert.deepEqual(footprint("L2"), { w: 2, d: 2 });
  const { root } = room();
  const bounds = new T.Box3().setFromObject(root);
  assert.ok(bounds.max.x - bounds.min.x > 3.8);
  assert.ok(bounds.max.z - bounds.min.z > 2.8);
  assert.ok(bounds.max.y < 2.4);
  withinRoom(root);
  let desktop;
  root.traverse((o) => {
    if (o.userData.studioFurniture === "desk") desktop = o;
  });
  assert.ok(desktop);
  assert.ok(new T.Box3().setFromObject(desktop).max.y < 1.6);
});

test("each purchased channel upgrade gets its own interior object with no free equipment", () => {
  assert.equal(equipment(room().root).length, 0);
  for (const id of STUDIO_DEVICE_IDS) {
    const s = fresh(0);
    s.counts[id] = 1;
    for (const interior of [true]) {
      const { root } = room(s, interior);
      assert.deepEqual(
        equipment(root).map((o) => o.userData.studioEquipment),
        [id],
      );
    }
  }
  const s = fullStudio();
  let cameras = 0;
  room(s).root.traverse((o) => {
    if (o.userData.studioCamera !== undefined) cameras++;
  });
  assert.equal(cameras, ITEMS.L3.max);
});

test("all equipment and every combination of room decorations stay inside the same footprint", () => {
  const slots = ["studioDesk", "studioWall", "studioSign", "studioShelf"];
  for (let mask = 0; mask < 16; mask++) {
    const s = fullStudio();
    s.scenery.equipped = Object.fromEntries(
      slots.map((slot, j) => [slot, slot + "-" + ((mask >> j) & 1)]),
    );
    for (const interior of [true]) {
      const { root, animations } = room(s, interior);
      for (const t of [0, 1.25, 4.7]) {
        for (const animate of animations) animate(t);
        withinRoom(root);
        assert.deepEqual(
          equipment(root).map((o) => o.userData.studioEquipment),
          STUDIO_DEVICE_IDS,
        );
        root.traverse((o) => {
          if (o.userData.studioEquipment || o.userData.studioDecoration)
            withinRoom(o);
        });
      }
    }
  }
});

test("floor-standing purchases sit on the finished floor instead of floating above it", () => {
  const { root } = room(fullStudio());
  for (const object of equipment(root).filter((o) =>
    ["L3", "L4", "L6", "L10", "L12", "L13", "L14"].includes(
      o.userData.studioEquipment,
    ),
  )) {
    const bottom = new T.Box3().setFromObject(object).min.y;
    assert.ok(
      Math.abs(bottom - STUDIO.floorY) < 1e-6,
      object.userData.studioEquipment + ": " + bottom,
    );
  }
});

test("studio lighting responds to actual power instead of staying fully lit during a blackout", () => {
  const s = fullStudio(),
    { root, animations } = room(s),
    lamps = [];
  root.traverse((o) => {
    if (o.userData.studioLamp) lamps.push(o);
  });
  assert.equal(lamps.length, 4);
  for (const power of [0, 0.25, 1]) {
    s.grid.last.perDevice.L12 = power;
    for (const animate of animations) animate(1);
    for (const lamp of lamps) {
      assert.equal(lamp.visible, power > 0);
      assert.ok(Math.abs(lamp.scale.x - 0.255 * power) < 1e-6);
    }
  }
});

test("each decoration choice changes modeled details, not only the material color", () => {
  for (const slot of [
    "studioDesk",
    "studioWall",
    "studioSign",
    "studioShelf",
  ]) {
    const structures = [];
    for (const index of [0, 1]) {
      const s = fresh(0),
        root = new T.Group(),
        meshes = [];
      s.scenery.equipped[slot] = slot + "-" + index;
      decorateStudio(root, s);
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (o.isMesh) meshes.push(o.matrixWorld.toArray());
      });
      assert.ok(meshes.length >= 15, slot);
      structures.push(meshes);
    }
    assert.notDeepEqual(structures[0], structures[1], slot);
  }
});

test("a dense old studio migrates into a legal room while preserving purchases and ongoing income", () => {
  const old = JSON.parse(
    readFileSync(new URL("./fixtures/layout-v2.json", import.meta.url), "utf8"),
  );
  const s = restore(old, 0);
  assert.deepEqual(s.counts, { ...old.counts, V18: 1, V19: 0, V20: 0, V21: 0, V22: 0, V23: 0, V24: 0, V25: 0 });
  assert.equal(s.money, old.money);
  assert.ok(s.placements.L2);
  for (const id of STUDIO_DEVICE_IDS) {
    assert.equal(ITEMS[id].place, false, id);
    assert.equal(s.placements[id], undefined, id);
  }
  for (const [id, p] of Object.entries(s.placements))
    assert.ok(canPlace(s, id, p, id), id);
  const twice = restore(s, 0);
  assert.deepEqual(twice.placements, s.placements);
  assert.deepEqual(twice.chunks, s.chunks);
  const money = s.money;
  advance(s, 3);
  assert.ok(s.money > money);
  assert.ok(s.chunks.overworld.length >= old.chunks.overworld.length);
});

test("installed channel equipment needs no extra outdoor building site", () => {
  const s = fresh(0);
  s.counts.L2 = 1;
  s.research.completed={broadcasting:true,television:true,streaming:true,modern:true};
  s.money = 1e8;
  s.chunks.overworld = [{ x: 0, z: 0 }];
  for (const id of ["L3", "L4", "L5", "L6"]) {
    assert.ok(buy(s, id).ok, id);
    assert.equal(s.placements[id], undefined);
  }
});
