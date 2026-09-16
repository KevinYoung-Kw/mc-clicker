import test from "node:test";
import assert from "node:assert/strict";
import { createMobileCamera } from "../src/mobile-camera.js";

function fixture() {
  let enabled = true;
  const initial = {
    pan: { x: 2.2, y: 0, z: -1.6 },
    zoom: 0.47,
    yaw: 0.35,
    focusId: null,
    focusPoint: null,
  };
  const world = {
    cameraContext: "overworld",
    state: structuredClone(initial),
    captureCamera() {
      return structuredClone(this.state);
    },
    restoreCamera(s) {
      this.state = structuredClone(s);
    },
    inspectPoint(point, size) {
      this.state = {
        ...this.state,
        pan: { x: 0, y: 0, z: 0 },
        zoom: 1,
        focusPoint: point,
        focusSize: size,
      };
    },
  };
  const flow = createMobileCamera({
    camera: () => world,
    enabled: () => enabled,
  });
  return {
    world,
    flow,
    initial,
    desktop() {
      enabled = false;
    },
  };
}
test("opening and closing panels repeatedly preserves the exact freely chosen camera", () => {
  const { world, flow, initial } = fixture();
  for (let i = 0; i < 8; i++) {
    flow.sync(true);
    assert.deepEqual(world.state, initial);
    flow.sync(true); // changing shop category, resizing and HUD refreshes
    flow.sync(false);
    assert.deepEqual(world.state, initial);
  }
});
test("changing placement candidates cannot replace either the overview or free-view bookmark", () => {
  const { world, flow, initial } = fixture();
  flow.sync(true);
  world.state.pan.x = 0.5; // the player can also drag the shop overview
  const overview = world.captureCamera();
  flow.preview({ x: 6, y: 0, z: 3 }, 2);
  flow.sync(true);
  flow.preview({ x: 7, y: 0, z: 4 }, 2);
  assert.equal(flow.inspecting, true);
  assert.equal(world.state.focusPoint.x, 7);
  assert.ok(flow.overview());
  assert.deepEqual(world.state, overview);
  flow.preview({ x: 7, y: 0, z: 4 }, 2);
  flow.sync(false); // closing directly from the just-built site is valid
  assert.deepEqual(world.state, initial);
});
test("each dimension and the studio retain independent free-view bookmarks", () => {
  const { world, flow, initial } = fixture();
  flow.sync(true);
  world.cameraContext = "studio";
  world.state = { ...structuredClone(initial), zoom: 0.8, yaw: 1.2 };
  const studio = world.captureCamera();
  flow.sync(true);
  flow.preview({ x: 1, y: 1, z: -2 }, 1);
  flow.sync(false);
  assert.deepEqual(world.state, studio);
  world.cameraContext = "overworld";
  flow.sync(false);
  assert.deepEqual(world.state, initial);
});
test("desktop browsing never receives mobile camera overrides, including portrait-to-landscape transitions", () => {
  const { world, flow, initial, desktop } = fixture();
  flow.sync(true);
  desktop();
  flow.sync(true);
  assert.deepEqual(world.state, initial);
  flow.preview({ x: 5, y: 0, z: 3 }, 2);
  flow.sync(false);
  assert.deepEqual(world.state, initial);
});

test("desktop panels keep the free view until selection, and closing restores it exactly", () => {
  const {world, initial} = fixture();
  const flow = createMobileCamera({camera: () => world, enabled: () => true, overviewOnOpen: () => false});
  flow.sync(true);
  assert.deepEqual(world.state, initial);
  flow.preview({x:8,y:1,z:3}, 4);
  assert.equal(world.state.yaw, initial.yaw);
  world.state.pan.x = 1.3; // a player can keep moving after inspecting
  flow.sync(true); // HUD updates cannot pull the camera back to the facility
  assert.equal(world.state.pan.x, 1.3);
  flow.preview({x:3,y:1,z:5}, 2);
  assert.equal(world.state.focusSize, 2);
  flow.overview();
  assert.deepEqual(world.state, initial);
  flow.preview({x:3,y:1,z:5}, 2);
  flow.sync(false);
  assert.deepEqual(world.state, initial);
});

test('panning while a plain menu is open is retained on close, without a reset',()=>{
 const {world,flow}=fixture();flow.sync(true);world.state.pan.x=7;world.state.zoom=2;flow.sync(false);assert.equal(world.state.pan.x,7);assert.equal(world.state.zoom,2);
});
