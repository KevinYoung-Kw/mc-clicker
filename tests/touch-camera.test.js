import test from "node:test";
import assert from "node:assert/strict";
import { createTouchCamera } from "../src/touch-camera.js";
import { controlsFor } from "../src/input-guidance.js";
const pair = (left = 60, right = 160, y = 100) => [
  { x: left, y },
  { x: right, y },
];

test("parallel two-finger swipes rotate substantially without zooming", () => {
  const gesture = createTouchCamera(pair());
  let yaw = 0,
    zoom = 1;
  for (let dx = 5; dx <= 80; dx += 5) {
    const step = gesture.update(pair(60 + dx, 160 + dx));
    yaw += step.yaw;
    zoom *= step.zoom;
  }
  assert.ok(Math.abs(yaw + 0.72) < 1e-9);
  assert.equal(zoom, 1);
});
test("pinching stays zoom-only even when the finger midpoint drifts", () => {
  const gesture = createTouchCamera(pair());
  let result = gesture.update(pair(50, 170));
  assert.equal(result.mode, "zoom");
  assert.equal(result.yaw, 0);
  result = gesture.update(pair(65, 225));
  assert.equal(result.mode, "zoom");
  assert.equal(result.yaw, 0);
  assert.ok(Math.abs(result.zoom - 0.75) < 1e-9);
});
test("orbit direction can reverse, with spacing noise unable to change modes", () => {
  const gesture = createTouchCamera(pair());
  assert.ok(gesture.update(pair(80, 180)).yaw < 0);
  const reverse = gesture.update(pair(60, 164));
  assert.ok(reverse.yaw > 0);
  assert.equal(reverse.mode, "orbit");
  assert.equal(reverse.zoom, 1);
});
test("small jitter is ignored and a deliberate twist remains available", () => {
  const gesture = createTouchCamera(pair());
  assert.equal(gesture.update(pair(61, 160)).mode, null);
  const twist = gesture.update([
    { x: 61, y: 86 },
    { x: 159, y: 114 },
  ]);
  assert.equal(twist.mode, "twist");
  assert.equal(twist.zoom, 1);
  assert.ok(twist.yaw < -0.2);
});
test("lifting fingers starts a new intent and angle wrapping cannot jump a full circle", () => {
  const gesture = createTouchCamera([
    { x: 160, y: 100 },
    { x: 60, y: 101 },
  ]);
  assert.equal(
    gesture.update([
      { x: 160, y: 100 },
      { x: 60, y: 99 },
    ]).mode,
    null,
  );
  assert.equal(createTouchCamera(pair()).update(pair(50, 170)).mode, "zoom");
  assert.equal(createTouchCamera(pair()).update(pair(80, 180)).mode, "orbit");
});
test("control hints describe only the current input method", () => {
  assert.ok(controlsFor("touch").join().includes("双指左右滑动旋转"));
  assert.ok(!/右键|滚轮|Shift/.test(controlsFor("touch").join()));
  assert.ok(controlsFor("mouse").join().includes("右键 / Shift 拖动旋转"));
  assert.ok(!controlsFor("mouse").join().includes("双指"));
});
