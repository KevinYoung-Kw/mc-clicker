import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { World } from "../src/world.js";
import { STUDIO } from "../src/studio-layout.js";
import { studioSpec } from "../src/studio-placement.js";

function cameraWorld() {
  const w = Object.create(World.prototype);
  Object.assign(w, {
    view: "overworld",
    studio: false,
    shot: null,
    pan: new T.Vector3(2, 0, -3),
    zoom: 0.8,
    yaw: 0.7,
    displayYaw: 0,
    cameraStates: new Map(),
    cameraContext: "overworld",
    selectRing: { visible: false },
    cameraOffset: new T.Vector3(13, 13, 16),
    container: { clientHeight: 800 },
    baseSize: 5,
    displaySize: 4,
    pointers: new Map(),
    renderer: { domElement: { setPointerCapture() {} } },
    resize() {},
    onAction() {},
  });
  return w;
}

test('mobile pinch can inspect closer while desktop retains its limit and gestures do not select',()=>{
  const previous=globalThis.window;
  try{
    for(const [width,expected] of [[390,.18],[1440,.45]]){
      globalThis.window={innerWidth:width};
      const w=cameraWorld(),events=[];w.pick=()=>null;w.onAction=e=>events.push(e);
      const p={button:0,pointerId:1,clientX:100,clientY:100};
      w.down(p);w.down({...p,pointerId:2,clientX:200});
      w.drag({...p,clientX:-1000});w.drag({...p,pointerId:2,clientX:1300});w.flushTouchCamera();
      assert.equal(w.zoom,expected);
      w.up({...p,pointerId:2});w.up(p);
      assert.deepEqual(events.filter(e=>e.type!=='hold-end'),[]);
    }
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test("room entry and broadcast monitoring preserve independent room and world cameras", () => {
  const w = cameraWorld();
  w.setStudio(true);
  w.setShot("L2");
  assert.equal(w.interior, true);
  assert.deepEqual(w.pan.toArray(), [0, 0, 0]);
  w.pan.set(0.5, 0, 0.25);
  w.zoom = 0.6;
  w.rotateView(1.2);
  w.setShot("V4");
  assert.deepEqual(w.pan.toArray(), [2, 0, -3]);
  assert.equal(w.zoom, 0.8);
  assert.equal(w.yaw, 0.7);
  w.setShot("L2");
  assert.deepEqual(w.pan.toArray(), [0.5, 0, 0.25]);
  assert.equal(w.zoom, 0.6);
  assert.ok(Math.abs(w.yaw - 1.2) < 1e-10);
  w.setStudio(false);
  w.setShot(null);
  assert.deepEqual(w.pan.toArray(), [2, 0, -3]);
  assert.equal(w.zoom, 0.8);
  assert.equal(w.yaw, 0.7);
});

test("panning follows camera rotation and keeps the room within a bounded reach", () => {
  const a = cameraWorld(),
    b = cameraWorld();
  a.pan.set(0, 0, 0);
  b.pan.set(0, 0, 0);
  b.displayYaw = Math.PI / 2;
  a.panPixels(80, 40);
  b.panPixels(80, 40);
  const expected = a.pan
    .clone()
    .applyAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2);
  assert.ok(b.pan.distanceTo(expected) < 1e-8);
  b.studio = true;
  b.shot = "L2";
  b.panPixels(1e6, 1e6);
  assert.ok(Math.abs(b.pan.x) <= STUDIO.width * 0.7);
  assert.ok(Math.abs(b.pan.z) <= STUDIO.depth * 0.7);
});

test("physical room props select their entity and multi-touch never buys or selects", () => {
  const w = cameraWorld(),
    events = [];
  w.onAction = (event) => events.push(event);
  w.pick = () => ({ userData: { studioKey: "L3:1", studioId: "L3" } });
  const p = { button: 0, pointerId: 1, clientX: 100, clientY: 100 };
  w.down(p);
  w.up(p);
  assert.deepEqual(
    events.filter((e) => e.type !== "hold-end"),
    [{ type: "studio-select", key: "L3:1", id: "L3" }],
  );
  events.length = 0;
  w.down(p);
  w.down({ ...p, pointerId: 2, clientX: 200 });
  w.drag({ ...p, pointerId: 2, clientX: 250, clientY: 140 });
  w.up({ ...p, pointerId: 2 });
  w.up(p);
  assert.deepEqual(
    events.filter((e) => e.type !== "hold-end"),
    [],
  );
  assert.equal(w.yaw, 0.7); // a pinch must not also rotate or pan
  assert.ok(w.zoom < 0.8);
  assert.deepEqual(w.pan.toArray(), [2, 0, -3]);
  const zoom = w.zoom;
  w.down(p);
  w.down({ ...p, pointerId: 2, clientX: 200 });
  w.drag({ ...p, clientX: 140 });
  w.drag({ ...p, pointerId: 2, clientX: 240 });
  w.flushTouchCamera(); // both pointer events arrive before the next render
  assert.ok(w.yaw < 0.4);
  assert.equal(w.zoom, zoom);
  w.up({ ...p, pointerId: 2 });
  w.up(p);
  assert.equal(events.filter((e) => e.type !== "hold-end").length, 0);
});

test("canceling a touch gesture drops stale pointers and cannot select a prop on release", () => {
  const w = cameraWorld(),
    events = [];
  w.onAction = (event) => events.push(event);
  w.pick = () => ({ userData: { studioKey: "L3:1", studioId: "L3" } });
  const p = { button: 0, pointerId: 1, clientX: 100, clientY: 100 };
  w.down(p);
  w.cancelPointers();
  w.up(p);
  assert.equal(w.pointers.size, 0);
  assert.equal(events.filter((e) => e.type !== "hold-end").length, 0);
  w.down(p);
  w.up(p);
  assert.equal(events.filter((e) => e.type === "studio-select").length, 1);
});

test("room placement previews snap to the model grid and wall mounting plane", () => {
  const w = cameraWorld();
  w.mode = { kind: "studio-move", key: "L6", rotation: 1 };
  w.pointerRay = () => {};
  w.ray = {
    ray: new T.Ray(new T.Vector3(1.12, 10, 0.68), new T.Vector3(0, -1, 0)),
  };
  w.floorPlane = new T.Plane(new T.Vector3(0, 1, 0), -STUDIO.floorY);
  w.wallPlane = new T.Plane(new T.Vector3(0, 0, 1), 1.25);
  w.floorPoint = new T.Vector3();
  assert.deepEqual(w.studioSiteAt({}), { x: 1, z: 0.75, rotation: 1 });
  w.mode = { kind: "studio-move", key: "L5", rotation: 0 };
  w.ray.ray.set(new T.Vector3(0.62, 1.2, 10), new T.Vector3(0, 0, -1));
  assert.deepEqual(w.studioSiteAt({}), {
    x: 0.5,
    z: studioSpec("L5").default.z,
    rotation: 0,
  });
});

test("mutating a placement candidate refreshes its ghost without rebuilding an unchanged preview", () => {
  const w = cameraWorld();
  let refreshes = 0;
  w.refreshMarkers = () => refreshes++;
  const mode = {
    kind: "studio-move",
    key: "L6",
    site: { x: 1, z: 0.75, rotation: 0 },
  };
  w.setMode(mode);
  w.setMode(mode);
  assert.equal(refreshes, 1);
  mode.site.x = 1.25;
  w.setMode(mode);
  assert.equal(refreshes, 2);
  mode.rotation = 1;
  w.setMode(mode);
  assert.equal(refreshes, 3);
});

test("facility framing measures the transformed model, leaves working space and preserves yaw", () => {
  const w = cameraWorld();
  const root = new T.Group();
  root.add(new T.Mesh(new T.BoxGeometry(2, 4, 3)));
  root.position.set(8, 2, -6); root.scale.setScalar(2);
  w.roots = {M8: root};
  const shot = w.itemCamera('M8');
  assert.deepEqual(shot.point.toArray(), [8,2,-6]);
  assert.equal(shot.size, 9.6);
  w.aspect = 0.7;
  w.inspectPoint(shot.point, shot.size);
  assert.equal(w.yaw, 0.7);
  assert.ok(w.focusSize > 8);
  assert.equal(w.itemCamera('missing'), null);
});
