import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ModelKit } from "../src/models.js";
import { makeResident, makeCopper } from "../src/companion-models.js";
import { makeActor } from "../src/objects.js";
import { appearance } from "../src/residents.js";

function coincidentColoredFaces(root) {
  root.updateWorldMatrix(true, true);
  const meshes = [],
    overlaps = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push({ o, b: new T.Box3().setFromObject(o) });
  });
  for (let i = 0; i < meshes.length; i++)
    for (let j = i + 1; j < meshes.length; j++) {
      const a = meshes[i],
        b = meshes[j];
      if (a.o.material === b.o.material) continue;
      for (const axis of ["x", "y", "z"])
        for (const face of ["min", "max"]) {
          if (Math.abs(a.b[face][axis] - b.b[face][axis]) > 1e-7) continue;
          if (
            ["x", "y", "z"]
              .filter((d) => d !== axis)
              .every(
                (d) =>
                  Math.min(a.b.max[d], b.b.max[d]) -
                    Math.max(a.b.min[d], b.b.min[d]) >
                  0.002,
              )
          )
            overlaps.push([i, j, axis, face]);
        }
    }
  return overlaps;
}

test("grass block dirt pixels do not compete for the same depth plane", () => {
  const root = new T.Group();
  new ModelKit(root, [], {}).block();
  assert.deepEqual(coincidentColoredFaces(root), []);
});

test("all resident appearance variants keep hair and skin on distinct surfaces", () => {
  for (let i = 0; i < 24; i++) {
    const root = new T.Group();
    makeResident(
      root,
      { id: `resident-${i}`, look: appearance(i), job: "idle", skills: {} },
      [],
    );
    let head;
    root.traverse((o) => {
      if (o.userData.mobPart === "head") head = o;
    });
    assert.ok(head);
    assert.deepEqual(coincidentColoredFaces(head), [], "appearance " + i);
  }
});

test("copper courier shares the icon model and retains carrying and walking feedback", () => {
  const courier = {
      id: "golem-2",
      upgrades: { basket: 2, sorting: 1, bell: 1 },
      path: [],
      cargo: null,
    },
    animations = [],
    root = new T.Group();
  const copper = makeCopper(root, courier, animations),
    parts = [];
  copper.traverse((o) => {
    if (o.userData.mobPart) parts.push(o);
  });
  assert.equal(copper.userData.golem, courier.id);
  assert.equal(copper.userData.item, "V15");
  assert.equal(copper.userData.mob, "copper-golem");
  assert.ok(parts.some((o) => o.userData.mobPart === "lightning-rod"));
  const cargo = parts.find((o) => o.userData.mobPart === "cargo"),
    arms = parts.filter((o) => o.userData.mobPart === "arm");
  animations.forEach((fn) => fn(1));
  assert.equal(cargo.visible, false);
  courier.path = [{ x: 1, z: 1 }];
  courier.cargo = { amount: 5 };
  animations.forEach((fn) => fn(2));
  assert.equal(cargo.visible, true);
  assert.ok(arms.every((o) => o.rotation.x < -0.9));
  assert.notEqual(copper.rotation.z, 0);
  const icon = makeActor(new T.Group(), "V15", []);
  assert.ok(icon.children.some((o) => o.userData.mob === "copper-golem"));
});

test("iron golem silhouette has wide shoulders and long arms within its walking footprint", () => {
  const root = makeActor(new T.Group(), "V16", []),
    parts = {};
  root.traverse((o) => {
    if (o.userData.mobPart && !parts[o.userData.mobPart])
      parts[o.userData.mobPart] = o;
  });
  root.updateWorldMatrix(true, true);
  const whole = new T.Box3().setFromObject(root).getSize(new T.Vector3()),
    head = new T.Box3().setFromObject(parts.head).getSize(new T.Vector3()),
    arm = new T.Box3().setFromObject(parts.arm).getSize(new T.Vector3());
  assert.ok(whole.x <= 0.68 && whole.y > 1.1);
  assert.ok(arm.y > head.y * 2);
  assert.ok(whole.x > head.x * 2);
});

test("blaze has twelve distinct orbiting rods in three height bands and only voxel geometry", () => {
  const animations = [],
    root = makeActor(new T.Group(), "N3", animations),
    rods = [],
    tiers = [];
  root.traverse((o) => {
    if (o.userData.mobPart === "blaze-rod") rods.push(o);
    if (o.userData.mobPart?.startsWith("rod-tier-")) tiers.push(o);
    if (o.isMesh) assert.equal(o.geometry.type, "BoxGeometry");
  });
  assert.equal(rods.length, 12);
  assert.equal(tiers.length, 3);
  const before = rods.map((o) => o.position.toArray());
  animations.forEach((fn) => fn(2));
  assert.notDeepEqual(
    rods.map((o) => o.position.toArray()),
    before,
  );
  for (let i = 0; i < 3; i++)
    assert.ok(
      tiers[i].children.every(
        (o) => Math.abs(o.position.y - (0.24 + i * 0.37)) <= 0.026,
      ),
    );
});
