import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  BLOCK_SURFACES,
  blockMat,
  blockBatchMaterial,
} from "../src/block-materials.js";
import { World } from "../src/world.js";
import { ModelKit, boxGeometry, blockBox, mat } from "../src/models.js";
import { specialtyStall } from "../src/specialty-stalls.js";

test("block surfaces share textures and geometry without changing skin materials", () => {
  const g = new T.Group(),
    maps = new Set();
  for (const kind of BLOCK_SURFACES) {
    const first = blockMat(kind, "#a3ad94"),
      second = blockMat(kind, "#819b6f");
    assert.equal(first, blockMat(kind, "#a3ad94"));
    assert.equal(first.map, second.map);
    assert.equal(first.map.magFilter, T.NearestFilter);
    assert.equal(first.map.minFilter, T.NearestMipmapLinearFilter);
    assert.equal(first.map.image.width, 16);
    assert.ok(new Set(first.map.image.data).size > 2);
    maps.add(first.map);
    const mesh = blockBox(g, kind, "#a3ad94", 0, 0.5, 0);
    assert.equal(mesh.geometry, boxGeometry);
    assert.equal(mesh.material, first);
  }
  assert.equal(maps.size, BLOCK_SURFACES.length);
  assert.equal(mat("#ac835e").map, null);
  assert.throws(() => blockMat("unknown", "#fff"));
});

test("drill, windmill and press keep their bases grounded throughout their working cycles", () => {
  for (const method of ["drill", "windmill", "slimeMachine"]) {
    const root = new T.Group(),
      animations = [];
    const kit = new ModelKit(root, animations, {});
    kit[method](0, 0, 3);
    assert.ok(animations.length);
    for (let t = 0; t < 8; t += 0.1) {
      animations.forEach((fn) => fn(t));
      root.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(root);
      assert.ok(Math.abs(bounds.min.y) < 1e-6, `${method} at ${t}`);
      assert.ok(bounds.max.y < 2.6);
    }
    root.traverse((o) => {
      if (o.isMesh)
        assert.equal(
          o.geometry,
          boxGeometry,
          `${method}: structural box geometry`,
        );
    });
  }
});

test("slime compresses against its pad, rather than lifting its feet through the support", () => {
  const root = new T.Group(),
    animations = [];
  new ModelKit(root, animations, {}).slimeMachine(0, 0);
  let pad;
  root.traverse((o) => {
    if (o.userData.facilityPart === "slime-pad") pad = o;
  });
  assert.ok(pad);
  for (const t of [0, Math.PI / 6, Math.PI / 2]) {
    animations.forEach((fn) => fn(t));
    const b = new T.Box3().setFromObject(pad);
    assert.ok(Math.abs(b.min.y - 0.25) < 1e-6);
    assert.ok(b.max.y < 1.25);
  }
});

test("specialty stalls have different content but share grounded construction and reusable geometry", () => {
  for (const id of ["N2", "X2"]) {
    const model = specialtyStall(new T.Group(), id);
    const bounds = new T.Box3().setFromObject(model);
    assert.equal(bounds.min.y, 0);
    assert.ok(bounds.max.y < 1.7);
    let meshes = 0;
    const materials = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      materials.add(o.material);
      assert.equal(o.geometry, boxGeometry);
    });
    assert.ok(meshes > 20 && meshes <= 60);
    assert.ok(materials.size < 18);
    assert.equal(
      model.userData.facilityStyle,
      id === "N2" ? "piglin-trading-camp" : "decoration-stall",
    );
  }
});

test("colour batching retains each linear tint and transform while grouping only compatible surfaces", () => {
  const graph = new T.Group();
  const a = blockBox(graph, "wood", "#977054", 1, 2, 3);
  const b = blockBox(graph, "wood", "#665c48", -1, 4, 2);
  blockBox(graph, "iron", "#9da5a0", 0, 0, 0);
  b.userData.dynamic = true;
  const w = Object.create(World.prototype);
  Object.assign(w, { graph, scene: new T.Scene(), batch: [] });
  w.buildInstances();
  assert.equal(w.batch.length, 2);
  const shared = w.batch.find((batch) => batch.objects.includes(a));
  assert.deepEqual(shared.objects, [a, b]);
  assert.equal(shared.firstDynamic, 1);
  assert.equal(shared.mesh.material.color.getHex(), 0xffffff);
  assert.equal(shared.mesh.material.map, a.material.map);
  for (let i = 0; i < 2; i++) {
    const color = new T.Color(),
      matrix = new T.Matrix4(),
      original = shared.objects[i];
    shared.mesh.getColorAt(i, color);
    shared.mesh.getMatrixAt(i, matrix);
    for (const key of ["r", "g", "b"])
      assert.ok(Math.abs(color[key] - original.material.color[key]) < 1e-7);
    assert.deepEqual(matrix.elements, original.matrixWorld.elements);
  }
  assert.equal(blockBatchMaterial(mat("#ac835e")), null);
  assert.equal(blockBatchMaterial(a.material.clone()), null);
  assert.equal(blockBatchMaterial(blockMat("iron", "#edbd64", 0.5)), null);
  const custom = blockMat("iron", "#012345");
  custom.onBeforeCompile = () => {};
  assert.equal(blockBatchMaterial(custom), null);
});
