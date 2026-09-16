import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { World } from '../src/world.js';

function fixture() {
  const rect = { width: 390, height: 264.171875 }, calls = [];
  const world = Object.assign(Object.create(World.prototype), {
    container: { getBoundingClientRect: () => rect },
    renderer: { setSize: (w, h) => calls.push([w, h]) },
    camera: new T.OrthographicCamera(),
    pan: new T.Vector3(1, 0, -2), zoom: 0.6, yaw: 0.8,
    focusPoint: { x: 1, y: 0.2, z: 1 }, focusSize: 2,
    displaySize: 3.5, displayYaw: 0.7,
  });
  return { world, rect, calls };
}
const ratio = w => (w.camera.right - w.camera.left) / (w.camera.top - w.camera.bottom);

test('a purchase returning to the last observed size repairs its intermediate projection before drawing', () => {
  const { world: w, rect, calls } = fixture();
  w.resize(); // Last size ResizeObserver delivered.
  const bookmark = w.captureCamera();
  rect.height = 529;
  w.resize(); // Synchronous purchase layout before removing room-placing.
  rect.height = 264.171875; // Same observed size: no new observer notification.
  w.resize(false); // Render preparation must still catch the stale projection.
  assert.equal(w.renderHeight, 264);
  assert.equal(ratio(w), rect.width / rect.height);
  assert.deepEqual(calls, [[390, 264], [390, 529], [390, 264]]);
  assert.deepEqual(w.captureCamera(), bookmark);
  assert.equal(w.displaySize, 3.5);
  assert.equal(w.displayYaw, 0.7);
});

test('steady frames do not reallocate or re-project; subpixel changes preserve the CSS aspect', () => {
  const { world: w, rect, calls } = fixture();
  w.resize();
  let projections = 0;
  w.camera.updateProjectionMatrix = () => projections++;
  for (let i = 0; i < 120; i++) w.resize(false);
  assert.equal(calls.length, 1);
  assert.equal(projections, 0);
  rect.height = 264.25; // Same rounded buffer, different CSS aspect.
  w.resize(false);
  assert.equal(calls.length, 1);
  assert.equal(projections, 1);
  assert.equal(ratio(w), rect.width / rect.height);
});

test('hidden and zero-size layouts retain the valid projection until the room returns', () => {
  const { world: w, rect, calls } = fixture();
  w.resize();
  for (const height of [0, 0.2, -1, NaN, Infinity]) {
    rect.height = height;
    w.resize(false);
  }
  assert.equal(calls.length, 1);
  assert.ok(Number.isFinite(ratio(w)));
  rect.width = 844; rect.height = 180;
  w.resize(false);
  assert.equal(w.renderWidth, 844);
  assert.equal(w.renderHeight, 180);
  assert.equal(ratio(w), rect.width / rect.height);
});

test('frame preparation never recursively redraws a resizing canvas', () => {
  const { world: w, rect, calls } = fixture();
  w.resize();
  w.hasRenderedFrame = true;
  w.graph = new T.Group();
  w.update = () => { throw Error('recursive frame'); };
  rect.height = 529;
  w.resize(false);
  assert.equal(calls.length, 2);
});

test('continuous land edits keep the same world-space camera as island bounds change',()=>{
 const {world:w}=fixture();w.focusPoint=null;w.focusSize=null;w.center=new T.Vector3(2.5,0,0);w.baseSize=8;
 const before=w.captureCamera({absolute:true}),target=w.center.clone().add(w.pan),visible=w.baseSize*w.zoom;
 w.center.set(5,0,-2.5);w.baseSize=10;w.restoreCamera(before);
 assert.ok(w.center.clone().add(w.pan).distanceTo(target)<1e-9);
 assert.ok(Math.abs(w.baseSize*w.zoom-visible)<1e-9);
 assert.equal(w.yaw,before.yaw);
});
