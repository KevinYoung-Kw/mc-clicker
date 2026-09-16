import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { projectWorldPoint } from "../src/world-projection.js";

test("mining anchor stays in CSS coordinates through viewport offset, zoom and camera pan", () => {
  const camera = new T.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const viewport = { left: 12, top: 96, width: 320, height: 320 };
  const point = new T.Vector3(1, 1, 0);
  assert.deepEqual(projectWorldPoint(point, camera, viewport), {
    x: 212,
    y: 216,
  });
  camera.zoom = 2;
  camera.updateProjectionMatrix();
  assert.deepEqual(projectWorldPoint(point, camera, viewport), {
    x: 252,
    y: 176,
  });
  camera.position.x = 1;
  camera.lookAt(1, 0, 0);
  assert.deepEqual(projectWorldPoint(point, camera, viewport), {
    x: 172,
    y: 176,
  });
  assert.equal(
    projectWorldPoint(new T.Vector3(0, 0, 30), camera, viewport),
    null,
  );
});

test("a rotated and scaled block projects its own upper face instead of a stage percentage", () => {
  const parent = new T.Group(),
    block = new T.Group();
  parent.add(block);
  parent.position.set(3, 0, -2);
  parent.rotation.y = 0.7;
  block.position.y = 0.16;
  block.scale.setScalar(0.67);
  parent.updateMatrixWorld(true);
  const point = new T.Vector3(0, 1.35, 0).applyMatrix4(block.matrixWorld);
  const camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(9, 10, 8);
  camera.lookAt(point);
  const viewport = { left: 430, top: 96, width: 700, height: 480 };
  const screen = projectWorldPoint(point, camera, viewport);
  assert.ok(Math.abs(screen.x - 780) < 1e-8);
  assert.ok(Math.abs(screen.y - 336) < 1e-8);
});
