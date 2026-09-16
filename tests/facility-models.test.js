import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { FACILITY_TYPES, blockFacility } from "../src/facility-models.js";
import { industrialBuilding } from "../src/industrial-models.js";
import { makeObject } from "../src/objects.js";
import { boxGeometry } from "../src/models.js";
import { ITEMS } from "../src/catalog.js";
import { fresh } from "../src/game.js";

function parts(root, name) {
  const result = [];
  root.traverse((o) => {
    if (o.userData.facilityPart === name) result.push(o);
  });
  return result;
}
const bounds = (o) => {
  o.updateWorldMatrix(true, true);
  return new T.Box3().setFromObject(o);
};
const build = (type, animations = []) =>
  blockFacility(new T.Group(), type, animations);

test("block facilities are grounded, finite, and share pixel box geometry", () => {
  for (const type of FACILITY_TYPES) {
    const animations = [],
      root = build(type, animations);
    assert.ok(root, type);
    assert.ok(Math.abs(bounds(root).min.y) < 1e-7, type + " starts at floor");
    let meshes = 0,
      textured = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (!o.userData.nonSolid) assert.equal(o.geometry, boxGeometry, type);
      if (o.material.map) {
        textured++;
        assert.equal(o.material.map.magFilter, T.NearestFilter, type);
        assert.ok(
          [
            T.NearestFilter,
            T.NearestMipmapNearestFilter,
            T.NearestMipmapLinearFilter,
          ].includes(o.material.map.minFilter),
          type,
        );
      }
    });
    assert.ok(meshes <= 32, type + " keeps a small geometry budget");
    assert.ok(textured > 0, type + " has an explicit pixel material");
    for (const t of [0, 0.5, 1.7, 4.2, 100]) {
      animations.forEach((fn) => fn(t));
      const b = bounds(root);
      assert.ok(
        b.min.toArray().concat(b.max.toArray()).every(Number.isFinite),
        type,
      );
      assert.ok(b.min.y >= -1e-7, type + " animation does not cross floor");
    }
  }
});

test("well exposes recessed water inside four basin walls and four roof supports", () => {
  const root = build("well"),
    water = bounds(parts(root, "water")[0]),
    walls = parts(root, "basin-wall"),
    posts = parts(root, "fence-post");
  assert.equal(walls.length, 4);
  assert.equal(posts.length, 4);
  for (const wall of walls) assert.ok(water.max.y < bounds(wall).max.y);
  const rays = new T.Raycaster(
    new T.Vector3(0.25, 3, 0.25),
    new T.Vector3(0, -1, 0),
  );
  // Removing the intentional canopy lets a vertical ray reach water in the void.
  const basin = [...walls, ...parts(root, "water")];
  const hits = rays.intersectObjects(basin, false);
  assert.equal(hits[0].object.userData.facilityPart, "water");
  const roofBottom = Math.min(
    ...parts(root, "roof-slab").map((o) => bounds(o).min.y),
  );
  for (const post of posts) assert.ok(bounds(post).max.y >= roofBottom);
});

test("blast furnace is a cube with separated upper vent and lower animated fire mouth", () => {
  const animations = [],
    root = build("furnace", animations),
    body = bounds(parts(root, "furnace-body")[0]).getSize(new T.Vector3());
  assert.equal(body.x, body.y);
  assert.equal(body.y, body.z);
  assert.equal(parts(root, "vent-grille").length, 3);
  const vent = bounds(parts(root, "vent-recess")[0]),
    fire = bounds(parts(root, "fire-mouth")[0]);
  assert.ok(vent.min.y > fire.max.y);
  const flame = parts(root, "fire")[0],
    before = flame.scale.y;
  animations.forEach((fn) => fn(0.8));
  assert.notEqual(flame.scale.y, before);
  assert.ok(parts(root, "iron-band").length >= 6);
});

test("hopper and composter have open tops while storage containers keep distinct parts", () => {
  const hopper = build("hopper");
  assert.equal(parts(hopper, "intake-rim").length, 4);
  assert.ok(
    bounds(parts(hopper, "open-intake")[0]).max.y <
      bounds(parts(hopper, "intake-rim")[0]).max.y,
  );
  assert.equal(parts(hopper, "funnel-step").length, 2);
  assert.equal(parts(hopper, "outlet").length, 1);
  const compost = build("compost");
  assert.equal(parts(compost, "latch").length, 0);
  assert.equal(parts(compost, "open-stave").length, 4);
  assert.ok(
    bounds(parts(compost, "compost")[0]).max.y <
      bounds(parts(compost, "open-stave")[0]).max.y,
  );
  assert.equal(parts(build("shulkerbox"), "shell-recess").length, 1);
  assert.equal(parts(build("enderchest"), "ender-inlay").length, 2);
});

test("piston head stays attached to its telescoping shaft throughout the cycle", () => {
  const animations = [],
    root = build("piston", animations);
  for (let tick = 0; tick < 60; tick++) {
    animations.forEach((fn) => fn(tick * 0.1));
    const shaft = bounds(parts(root, "moving-shaft")[0]);
    const head = bounds(parts(root, "piston-head")[0]);
    assert.ok(Math.abs(shaft.max.y - head.min.y) < 1e-7);
  }
});

test("redstone plates, observer, dispenser and lamp communicate their actual block function", () => {
  assert.equal(parts(build("repeater"), "torch-head").length, 2);
  assert.equal(parts(build("comparator"), "torch-head").length, 3);
  assert.equal(parts(build("observer"), "output-signal").length, 1);
  assert.equal(parts(build("dispenser"), "nozzle-opening").length, 1);
  const lamp = build("lamp"),
    on = parts(lamp, "lamp-on")[0],
    off = parts(lamp, "lamp-off")[0];
  assert.ok(on.visible && !off.visible);
  assert.deepEqual(bounds(on), bounds(off));
  assert.ok(bounds(on).max.y < bounds(parts(lamp, "lamp-block")[0]).max.y);
});

test("brewing bottles stand on their pads and generator axle touches its housing", () => {
  const brew = build("brew"),
    floor = bounds(parts(brew, "brewing-base")[0]).max.y;
  for (const bottle of parts(brew, "potion-bottle"))
    assert.ok(Math.abs(bounds(bottle).min.y - floor) < 1e-7);
  const motor = build("motor"),
    housing = bounds(parts(motor, "power-housing")[0]),
    axle = bounds(parts(motor, "axle")[0]);
  assert.ok(axle.min.x <= housing.max.x);
  assert.equal(parts(brew, "blaze-rod").length, 1);
  assert.equal(parts(brew, "potion-bottle").length, 3);
});

test("beacon and End crystal retain different containment and functional silhouettes", () => {
  const beacon = build("beacon"),
    crystal = build("crystal");
  assert.equal(parts(beacon, "iron-pyramid").length, 2);
  assert.equal(parts(beacon, "beacon-core").length, 1);
  assert.equal(parts(beacon, "beacon-beam")[0].userData.nonSolid, true);
  assert.equal(parts(crystal, "crystal-cage").length, 1);
  assert.equal(parts(crystal, "crystal-frame").length, 12);
  assert.equal(parts(crystal, "beacon-beam").length, 0);
  assert.equal(parts(crystal, "crystal-core")[0].geometry, boxGeometry);
});

test("freight gantries support their roofs and keep carts within the original platform", () => {
  for (const id of ["M17", "N12"]) {
    const animations = [],
      root = industrialBuilding(new T.Group(), id, animations),
      base = bounds(parts(root, "foundation")[0]);
    assert.ok(Math.abs(base.min.y) < 1e-7);
    const beamTop = Math.max(
      ...parts(root, "gantry-beam").map((o) => bounds(o).max.y),
    );
    const outerRoofBottom = Math.min(
      ...parts(root, "roof-slab").map((o) => bounds(o).min.y),
    );
    assert.ok(beamTop >= outerRoofBottom);
    for (let t = 0; t < 15; t += 0.2) {
      animations.forEach((fn) => fn(t));
      const cargo = bounds(parts(root, "cargo-cart")[0]);
      assert.ok(cargo.min.x >= base.min.x && cargo.max.x <= base.max.x);
    }
    assert.equal(parts(root, "freight-portal").length, id === "N12" ? 1 : 0);
  }
  const foundry = industrialBuilding(new T.Group(), "N4", []);
  assert.equal(parts(foundry, "heat-chamber").length, 1);
  assert.equal(parts(foundry, "fire-mouth").length, 1);
  assert.equal(parts(foundry, "chimney").length, 2);
});

test("real purchase dispatch uses shared semantic models and grounds the room jukebox outside", () => {
  const state = fresh();
  for (const [id, kind] of [
    ["M2", "blast-furnace"],
    ["V6", "water-well"],
    ["T7", "crafting-table"],
    ["N10", "beacon"],
    ["E8", "crystal"],
    ["E10", "brew"],
    ["Z1", "command"],
  ]) {
    const root = makeObject(new T.Group(), ITEMS[id], state, []);
    let found = false;
    root.traverse((o) => {
      found ||= o.userData.facility === kind;
    });
    assert.ok(found, id);
    assert.equal(root.userData.item, id);
  }
  const jukebox = makeObject(new T.Group(), ITEMS.L1, state, []);
  assert.ok(Math.abs(bounds(jukebox).min.y) < 1e-7);
  let shared = false;
  jukebox.traverse((o) => {
    shared ||= o.userData.studioModel === "L1";
  });
  assert.ok(shared);
});

test("exposed block faces avoid differently coloured coplanar overlaps", () => {
  const models = [
    ...[...FACILITY_TYPES].map((type) => [type, build(type)]),
    ...["N4", "M17", "N12"].map((id) => [
      id,
      industrialBuilding(new T.Group(), id, []),
    ]),
  ];
  for (const [name, root] of models) {
    root.updateWorldMatrix(true, true);
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || o.material.transparent) return;
      // A rotated book/crystal is intentionally not an axis-aligned block.
      const e = o.matrixWorld.elements;
      for (const offset of [0, 4, 8]) {
        const nonzero = [e[offset], e[offset + 1], e[offset + 2]].filter(
          (v) => Math.abs(v) > 1e-7,
        );
        if (nonzero.length !== 1) return;
      }
      meshes.push({ mesh: o, box: bounds(o) });
    });
    for (let i = 0; i < meshes.length; i++)
      for (let j = i + 1; j < meshes.length; j++) {
        const a = meshes[i],
          b = meshes[j];
        if (a.mesh.material === b.mesh.material) continue;
        for (const axis of ["x", "y", "z"])
          for (const face of ["min", "max"]) {
            const coplanar =
              Math.abs(a.box[face][axis] - b.box[face][axis]) < 1e-7;
            const area = ["x", "y", "z"]
              .filter((d) => d !== axis)
              .every(
                (d) =>
                  Math.min(a.box.max[d], b.box.max[d]) -
                    Math.max(a.box.min[d], b.box.min[d]) >
                  0.003,
              );
            assert.ok(
              !(coplanar && area),
              name +
                ": " +
                a.mesh.userData.facilityPart +
                "/" +
                b.mesh.userData.facilityPart +
                " on " +
                axis +
                "/" +
                face,
            );
          }
      }
  }
});
