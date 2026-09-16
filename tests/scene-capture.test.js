import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { visibleSceneBounds, fittedSceneCamera } from "../src/world.js";

test("photo bounds include transformed visible buildings but exclude hidden cutaway geometry", () => {
  const graph = new T.Group(),
    material = new T.MeshBasicMaterial();
  const building = new T.Mesh(new T.BoxGeometry(2, 4, 3), material);
  building.position.set(5, 2, -3);
  graph.add(building);
  const hidden = new T.Group();
  hidden.visible = false;
  hidden.add(new T.Mesh(new T.BoxGeometry(1000, 1000, 1000), material));
  graph.add(hidden);
  const backdrop = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
  backdrop.position.set(100, 200, -100);
  backdrop.userData.captureBackdrop = true;
  graph.add(backdrop);
  graph.updateMatrixWorld(true);
  const before = graph.matrixWorld.clone(),
    bounds = visibleSceneBounds(graph);
  assert.deepEqual(bounds.min.toArray(), [4, 0, -4.5]);
  assert.deepEqual(bounds.max.toArray(), [6, 4, -1.5]);
  assert.deepEqual(graph.matrixWorld, before);
});

test("photo camera tightly fits asymmetric world bounds at landscape and portrait aspect ratios", () => {
  for (const [width, height] of [
    [1440, 1000],
    [720, 1200],
  ])
    for (const angle of [0, Math.PI / 2, Math.PI]) {
      const bounds = new T.Box3(
          new T.Vector3(-14, -0.6, -7),
          new T.Vector3(24, 12, 32),
        ),
        direction = new T.Vector3(13, 13, 16).applyAxisAngle(
          new T.Vector3(0, 1, 0),
          angle,
        ),
        camera = fittedSceneCamera(bounds, direction, width, height),
        points = [];
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            points.push(new T.Vector3(x, y, z).project(camera));
      assert.ok(
        points.every(
          (p) =>
            Math.abs(p.x) < 0.93 && Math.abs(p.y) < 0.93 && Math.abs(p.z) < 1,
        ),
      );
      assert.ok(
        Math.max(...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])) >
          0.9,
      );
    }
});

test("invalid photo frames fail explicitly", () => {
  assert.throws(() => visibleSceneBounds(new T.Group()), /没有可拍摄/);
  assert.throws(
    () => fittedSceneCamera(new T.Box3(), new T.Vector3(1, 1, 1), 0, 1000),
    /无效/,
  );
});

test("instance translations and parent transforms participate in bounds and actual photo framing", () => {
  const graph = new T.Group(),
    cubes = new T.InstancedMesh(
      new T.BoxGeometry(2, 2, 2),
      new T.MeshBasicMaterial(),
      3,
    );
  cubes.position.set(3, 0, 4);
  cubes.setMatrixAt(0, new T.Matrix4().makeTranslation(-40, 1, 20));
  cubes.setMatrixAt(1, new T.Matrix4().makeTranslation(30, 8, -10));
  cubes.setMatrixAt(2, new T.Matrix4().makeScale(0, 0, 0));
  graph.add(cubes);
  graph.updateMatrixWorld(true);
  const before = [...cubes.instanceMatrix.array],
    bounds = visibleSceneBounds(graph);
  assert.deepEqual(bounds.min.toArray(), [-38, 0, -7]);
  assert.deepEqual(bounds.max.toArray(), [34, 9, 25]);
  const camera = fittedSceneCamera(
    bounds,
    new T.Vector3(13, 13, 16),
    1440,
    1000,
    graph,
  );
  for (const point of [new T.Vector3(-37, 1, 24), new T.Vector3(33, 8, -6)]) {
    point.project(camera);
    assert.ok(Math.abs(point.x) < 0.93 && Math.abs(point.y) < 0.93);
  }
  assert.deepEqual([...cubes.instanceMatrix.array], before);
});
