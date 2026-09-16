import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { fresh } from "../src/game.js";
import { CATALOG, ITEMS } from "../src/catalog.js";
import { makeObject, makeActor } from "../src/objects.js";
import {
  OUTDOOR_ACTORS,
  outdoorPreview,
  outdoorPlacementArea,
  fitOutdoorModel,
  placementSurface,
  PLACEMENT_STYLE,
} from "../src/construction-preview.js";
import { canPlace, buildSites, placementReason } from "../src/layout.js";

test("all outdoor previews leave the live save untouched and release only their own materials", () => {
  for (const item of CATALOG.filter((i) => i.place)) {
    const state = fresh(),
      before = structuredClone(state);
    const preview = outdoorPreview(state, item.id);
    assert.deepEqual(state, before, `${item.id}: preview changed the save`);
    let meshes = 0,
      disposed = 0;
    const materials = new Set();
    preview.root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      assert.equal(o.castShadow, false);
      o.geometry.addEventListener("dispose", () =>
        assert.fail(`${item.id}: disposed shared geometry`),
      );
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        assert.equal(m.opacity, PLACEMENT_STYLE.ghostOpacity);
        assert.equal(m.depthWrite, false);
        if (!materials.has(m)) m.addEventListener("dispose", () => disposed++);
        materials.add(m);
      }
    });
    assert.ok(meshes > 0, item.id);
    const scene = new T.Group();
    scene.add(preview.root);
    preview.dispose();
    assert.equal(scene.children.length, 0);
    assert.equal(disposed, materials.size);
  }
});

test("previews match the finished model scale and ground contact for buildings of different sizes and levels", () => {
  for (const id of [
    "L1",
    "T7",
    "V18",
    "V4",
    "M2",
    "M4",
    "M7",
    "M9",
    "L2",
    "N3",
    "E2",
  ]) {
    for (const level of [1, 3]) {
      const s = fresh();
      s.counts[id] = level;
      const final = new T.Group();
      if (OUTDOOR_ACTORS.has(id)) makeActor(final, id, [], 0, s);
      else makeObject(final, ITEMS[id], s, []);
      fitOutdoorModel(final, id, s);
      const ghost = outdoorPreview(s, id, true);
      const a = new T.Box3().setFromObject(final),
        b = new T.Box3().setFromObject(ghost.root);
      assert.ok(
        a.min.distanceTo(b.min) < 1e-7 && a.max.distanceTo(b.max) < 1e-7,
        `${id} Lv.${level}`,
      );
      assert.ok(Math.abs(b.min.y - 0.16) < 1e-7, `${id} ground contact`);
      ghost.dispose();
    }
  }
});

test("adjacent legal cells form one quiet surface without internal grid lines or repeated badges", () => {
  const sites = [
      { x: 0, z: 0 },
      { x: 0.5, z: 0 },
      { x: 0, z: 0.5 },
      { x: 0.5, z: 0.5 },
    ],
    before = structuredClone(sites);
  const surface = placementSurface(sites);
  assert.equal(surface.root.children.length, 2);
  assert.equal(surface.fill.geometry.attributes.position.count, 24);
  assert.equal(
    surface.root.children[1].geometry.attributes.position.count,
    16,
    "only eight external boundary segments",
  );
  assert.deepEqual(sites, before);
  surface.dispose();
});

test("wider outdoor hit areas always snap to a legal site and cannot turn blocked positions green", () => {
  const s = fresh();
  s.counts.V1 = 1;
  s.placements.V18 = { x: -1.5, z: -1.5, realm: "overworld" };
  for (const id of ["L1", "T7", "V4", "L2"]) {
    const legal = buildSites(s, "overworld", id),
      area = outdoorPlacementArea(s, legal);
    for (const p of area.sites) {
      const snapped = area.siteAt(p);
      assert.ok(
        snapped && canPlace(s, id, snapped),
        `${id}: every green point must select a valid site`,
      );
      assert.equal(placementReason(s, id, snapped), "");
    }
    assert.equal(
      area.siteAt({ x: 0, z: 0 }),
      null,
      "keep the mining block unavailable",
    );
    assert.equal(
      area.siteAt({ x: -1.5, z: -1.5 }),
      null,
      "keep existing buildings unavailable",
    );
  }
  const isolated = outdoorPlacementArea(s, [
    { x: 1.5, z: 1.5, realm: "overworld" },
  ]);
  const surface = placementSurface(isolated.sites, { step: isolated.step });
  const bounds = new T.Box3().setFromObject(surface.root);
  assert.equal(
    bounds.max.x - bounds.min.x,
    0.75,
    "half-grid target grows from 0.5 to 0.75",
  );
  surface.dispose();
});

test("placement breathing stays visible, reuses geometry, and stops in reduced motion", () => {
  const surface = placementSurface([{ x: 0, z: 0 }]),
    geometry = surface.fill.geometry;
  surface.pulse(0.65);
  const bright = surface.fill.material.opacity;
  surface.pulse(1.95);
  const dim = surface.fill.material.opacity;
  assert.ok(bright > dim && dim >= 0.25 && bright <= 0.4);
  surface.pulse(0, true);
  const fixed = surface.fill.material.opacity;
  surface.pulse(100, true);
  assert.equal(surface.fill.material.opacity, fixed);
  assert.equal(surface.fill.geometry, geometry);
  surface.dispose();
});
