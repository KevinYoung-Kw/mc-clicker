import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { makeMailbox, updateMailbox } from "../src/mailbox-model.js";
import { boxGeometry } from "../src/models.js";

const bounds = (root) => {
  root.updateWorldMatrix(true, true);
  return new T.Box3().setFromObject(root);
};
const meshes = (root) => {
  const result = [];
  root.traverse((object) => object.isMesh && result.push(object));
  return result;
};

test("mailbox is grounded and fits its half-block plot with raised or lowered flag", () => {
  const root = makeMailbox(new T.Group());
  for (const level of [1, 3, 5]) {
    for (const unread of [0, 1, 2, 25]) {
      updateMailbox(root, { level, unread, ready: unread > 0 });
      const box = bounds(root),
        size = box.getSize(new T.Vector3());
      assert.ok(
        box.min.toArray().concat(box.max.toArray()).every(Number.isFinite),
      );
      assert.ok(Math.abs(box.min.y) < 1e-7, "foot rests on the ground");
      assert.ok(box.min.x >= -0.25 && box.max.x <= 0.25);
      assert.ok(box.min.z >= -0.25 && box.max.z <= 0.25);
      assert.ok(
        size.y > size.x * 1.5 && size.y < 0.85,
        "post remains compact and readable",
      );
    }
  }
});

test("mailbox shares pixel boxes and materials, and never creates an anonymous resident", () => {
  const first = makeMailbox(new T.Group(), 5, 3),
    second = makeMailbox(new T.Group(), 5, 3),
    a = meshes(first),
    b = meshes(second);
  assert.equal(a.length, b.length);
  assert.ok(a.length <= 32, "small facility mesh budget");
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].geometry, boxGeometry);
    assert.equal(a[i].material, b[i].material);
    assert.equal(a[i].castShadow, true);
    assert.equal(a[i].receiveShadow, true);
    if (a[i].material.map)
      assert.equal(a[i].material.map.magFilter, T.NearestFilter);
  }
  first.traverse((object) => assert.equal(object.userData.resident, undefined));
  assert.equal(first.userData.facility, "mailbox");
});

test("mail indicators and postal upgrades change existing graph parts without allocating resources", () => {
  const root = makeMailbox(new T.Group()),
    original = meshes(root),
    geometries = original.map((mesh) => mesh.geometry),
    materials = original.map((mesh) => mesh.material);
  assert.equal(root.userData.mailboxFlag.rotation.x, Math.PI / 2);
  assert.ok(root.userData.mailboxLetters.every((letter) => !letter.visible));
  for (let i = 0; i < 300; i++) {
    updateMailbox(root, {
      level: 1 + (i % 5),
      unread: i % 4,
      ready: i % 2 === 1,
    });
  }
  assert.deepEqual(meshes(root), original);
  assert.deepEqual(
    meshes(root).map((mesh) => mesh.geometry),
    geometries,
  );
  assert.deepEqual(
    meshes(root).map((mesh) => mesh.material),
    materials,
  );
  updateMailbox(root, { level: 5, unread: 2, ready: true });
  assert.equal(root.userData.mailboxFlag.rotation.x, 0);
  assert.deepEqual(
    root.userData.mailboxLetters.map((letter) => letter.visible),
    [true, true, false],
  );
  assert.ok(root.userData.mailboxLevelBands.every((band) => band.visible));
  assert.equal(root.userData.mailboxRewardSeal.visible, true);
  updateMailbox(root, { unread: 0 });
  assert.equal(root.userData.mailboxFlag.rotation.x, Math.PI / 2);
  assert.equal(
    root.userData.mailboxRewardSeal.visible,
    true,
    "read mail can still have unclaimed rewards",
  );
  assert.equal(root.userData.mailboxState.level, 5);
});

test("invalid model state cannot introduce non-finite transforms or upgrade levels", () => {
  const root = makeMailbox(new T.Group(), Infinity, NaN);
  updateMailbox(root, { level: -2, unread: -1 });
  assert.deepEqual(root.userData.mailboxState, {
    level: 1,
    unread: 0,
    ready: false,
  });
  updateMailbox(root, { level: 100, unread: Infinity });
  assert.deepEqual(root.userData.mailboxState, {
    level: 5,
    unread: 0,
    ready: false,
  });
  assert.ok(
    bounds(root)
      .min.toArray()
      .concat(bounds(root).max.toArray())
      .every(Number.isFinite),
  );
});
