import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { fresh } from "../src/game.js";
import { ITEMS } from "../src/catalog.js";
import { UPGRADE_CATALOG } from "../src/upgrades.js";
import { MODELED_UPGRADES } from "../src/upgrade-models.js";
import { makeObject, makeActor } from "../src/objects.js";
import { nearUpgrades } from "../src/upgrades-ui.js";
const actors = new Set(["N3", "N5", "N6", "E3", "E5", "E9"]);
function model(owner, s) {
  const root = new T.Group(),
    animations = [];
  const object = actors.has(owner)
    ? makeActor(root, owner, animations, 0, s)
    : makeObject(root, ITEMS[owner], s, animations);
  root.updateMatrixWorld(true);
  return { root, object, animations, bounds: new T.Box3().setFromObject(root) };
}
test("every purchased modification has physical parts; no model grows into an adjacent plot", () => {
  for (const owner of new Set(UPGRADE_CATALOG.map((row) => row.owner))) {
    const s = fresh();
    s.counts[owner] = 1;
    const before = model(owner, s);
    for (const row of UPGRADE_CATALOG.filter((row) => row.owner === owner)) {
      assert.ok(MODELED_UPGRADES.has(row.id), row.id);
      s.upgrades.levels[row.id] = row.maxLevel;
      s.upgrades.revision += row.maxLevel;
    }
    const after = model(owner, s);
    let module;
    after.root.traverse((o) => {
      if (o.name === "dedicated-upgrades") module = o;
    });
    assert.ok(module?.children.length, owner);
    for (const axis of ["x", "z"]) {
      assert.ok(
        after.bounds.min[axis] >= before.bounds.min[axis] - 0.035,
        owner + " min " + axis,
      );
      assert.ok(
        after.bounds.max[axis] <= before.bounds.max[axis] + 0.035,
        owner + " max " + axis,
      );
    }
    for (const t of [0, 0.2, 1, 4]) {
      for (const fn of after.animations) fn(t);
      after.root.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(after.root);
      assert.ok(Number.isFinite(b.min.x + b.max.y), owner);
    }
  }
});
test("the default modification list stays small and does not reshuffle while income grows", () => {
  const s = fresh();
  s.counts = { M9: 1, T3: 1, M4: 1, M7: 1, M8: 1 };
  const before = nearUpgrades(s, "M9").map((row) => row.id);
  assert.equal(before.length, 4);
  s.money = 1e15;
  assert.deepEqual(
    nearUpgrades(s, "M9").map((row) => row.id),
    before,
  );
});
