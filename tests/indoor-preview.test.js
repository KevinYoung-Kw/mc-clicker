import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World } from "../src/world.js";
import { fresh } from "../src/game.js";
import { COLLECTION } from "../src/collection.js";
import { studioSpec } from "../src/studio-placement.js";
import {
  STUDIO_MODEL_IDS,
  studioDeviceModel,
} from "../src/studio-device-models.js";
import { decorateStudio } from "../src/studio-decoration.js";
import { placementCue } from "../src/construction-preview.js";

function previewWorld() {
  const world = Object.create(World.prototype),
    state = fresh(), cue = placementCue();
  state.counts.L2 = 1;
  Object.assign(world, {
    state,
    studio: true,
    shot: "L2",
    markerGroup: new T.Group(),
    markers: [],
    studioCue: cue,
    studioGhost: cue.fill,
    studioOutline: cue.outline,
  });
  return world;
}
function meshes(root) {
  const result = [];
  root.traverse((o) => {
    if (o.isMesh) result.push(o);
  });
  return result;
}
function start(world, id, key = id, kind = "studio-build") {
  world.setMode({ id, key, kind, rotation: 0, site: null });
  return world.studioModelGhost;
}

test("every indoor device previews its actual geometry with isolated translucent materials", () => {
  for (const id of STUDIO_MODEL_IDS) {
    const world = previewWorld(),
      before = JSON.stringify(world.state),
      key = id === "L3" ? "L3:0" : id;
    const ghost = start(world, id, key),
      actual = studioDeviceModel(new T.Group(), id, world.state, []),
      shown = meshes(ghost),
      real = meshes(actual);
    assert.ok(shown.length > 1, id + " has a model instead of a box");
    assert.equal(shown.length, real.length, id);
    for (let i = 0; i < shown.length; i++) {
      assert.equal(shown[i].geometry, real[i].geometry, id);
      assert.notEqual(shown[i].material, real[i].material, id);
      assert.equal(shown[i].material.map, real[i].material.map, id);
      assert.equal(shown[i].material.transparent, true, id);
      assert.ok(
        shown[i].material.opacity > 0 && shown[i].material.opacity < 1,
        id,
      );
      assert.equal(shown[i].material.depthWrite, false, id);
      assert.equal(shown[i].castShadow, false, id);
      assert.equal(
        real[i].material.opacity,
        1,
        id + " leaves shared materials untouched",
      );
    }
    assert.equal(
      JSON.stringify(world.state),
      before,
      id + " does not buy or equip during preview",
    );
    world.setMode(null);
  }
});

test("indoor decorations preview each selected design, including fixed desk and whole wall", () => {
  for (const item of COLLECTION.filter((i) =>
    ["studio", "flag"].includes(i.category),
  )) {
    const world = previewWorld(),
      before = JSON.stringify(world.state),
      spec = studioSpec(item.slot),
      ghost = start(world, item.id, item.slot);
    assert.equal(ghost.userData.previewId, item.id);
    assert.ok(meshes(ghost).length > 3, item.id);
    assert.ok(
      ghost.children.some((o) => o.userData.studioDecoration === item.id),
      item.id,
    );
    // Compare the prospective result at its canonical position with real equipment.
    world.showStudioGhost(spec.default);
    ghost.updateWorldMatrix(true, true);
    const actualRoot = new T.Group(),
      presentation = {
        counts: { L2: 1 },
        scenery: {
          owned: { [item.id]: true },
          equipped: { [item.slot]: item.id },
        },
      };
    decorateStudio(actualRoot, presentation);
    let actual;
    actualRoot.traverse((o) => {
      if (o.userData.studioDecoration === item.id) actual = o;
    });
    actual.updateWorldMatrix(true, true);
    const a = new T.Box3().setFromObject(actual),
      b = new T.Box3().setFromObject(ghost);
    assert.ok(
      a.min.distanceTo(b.min) < 1e-7 && a.max.distanceTo(b.max) < 1e-7,
      item.id + " sits on the same real surface",
    );
    assert.equal(
      JSON.stringify(world.state),
      before,
      item.id + " does not alter collection",
    );
    world.setMode(null);
  }
});

test("moving or rotating an indoor preview reuses geometry and materials while validity changes", () => {
  const world = previewWorld(),
    ghost = start(world, "L3", "L3:0"),
    materials = [...world.studioPreviewMaterials],
    children = [...world.markerGroup.children];
  const good = world.studioCandidates[0];
  world.showStudioGhost(good);
  assert.equal(ghost.userData.valid, true);
  const green = materials[0].color.clone();
  for (let i = 0; i < 20; i++)
    world.showStudioGhost({ x: good.x, z: good.z, rotation: i % 4 });
  world.showStudioGhost({ x: 30, z: 30, rotation: 1 });
  assert.equal(ghost.userData.valid, false);
  assert.ok(materials.every((m) => !m.depthTest));
  assert.ok(!materials[0].color.equals(green));
  assert.deepEqual(world.studioPreviewMaterials, materials);
  assert.equal(world.studioModelGhost, ghost);
  assert.equal(ghost.rotation.y, Math.PI / 2);
  world.mode.site = { ...good };
  world.setMode(world.mode);
  assert.equal(world.studioModelGhost, ghost);
  assert.equal(world.markerGroup.children.length, children.length);
  assert.ok(
    children.every((o) => world.markerGroup.children.includes(o)),
    "available surface remains cached",
  );
});

test("cancel and scene exit dispose only preview-owned materials and do not retain old ghosts", () => {
  const world = previewWorld(),
    ghost = start(world, "L3", "L3:0");
  let disposedMaterials = 0,
    disposedGeometry = 0;
  const materials = [...world.studioPreviewMaterials],
    geometries = new Set(meshes(ghost).map((o) => o.geometry));
  materials.forEach((m) =>
    m.addEventListener("dispose", () => disposedMaterials++),
  );
  const onGeometryDispose = () => disposedGeometry++;
  geometries.forEach((g) => g.addEventListener("dispose", onGeometryDispose));
  world.setMode(null);
  assert.equal(disposedMaterials, materials.length);
  assert.equal(disposedGeometry, 0);
  assert.equal(ghost.parent, null);
  assert.equal(world.studioModelGhost, null);
  assert.equal(world.markerGroup.children.length, 0);
  start(world, "L3", "L3:0", "studio-move");
  world.studio = false;
  world.mode = null;
  world.refreshMarkers();
  assert.equal(world.studioModelGhost, null);
  assert.equal(disposedGeometry, 0);
  geometries.forEach((g) =>
    g.removeEventListener("dispose", onGeometryDispose),
  );
});
