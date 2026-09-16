import test from "node:test";
import assert from "node:assert/strict";
import { projectProgress, PROJECT_TARGET } from "../src/project.js";
import { ownedGroups } from "../src/facility-shops.js";
import { advance, buy, restore } from "../src/game.js";
import { ITEMS } from "../src/catalog.js";
import { engineeringFixture } from "../scripts/engineering-fixture.mjs";

const base = engineeringFixture();
function at(values) {
  const s = structuredClone(base);
  s.projectByRealm = Object.fromEntries(
    ["overworld", "nether", "end"].map((r, i) => [r, values[i]]),
  );
  s.project = values.reduce((a, b) => a + b, 0);
  return s;
}
test("one purchased engineering site remains under construction, never a completed level-one upgrade", () => {
  const groups = ownedGroups(base, [ITEMS.Z2]);
  assert.deepEqual(groups.building, [ITEMS.Z2]);
  assert.deepEqual(groups.complete, []);
  assert.deepEqual(groups.upgradable, []);
  assert.equal(projectProgress(base).layer, 1);
  assert.equal(projectProgress(base).finished, 0);
  assert.equal(buy(structuredClone(base), "Z2").ok, false);
});
test("real deliveries advance through all three layers without another site purchase", () => {
  for (const values of [
    [59999, 0, 0],
    [60000, 59999, 0],
    [60000, 60000, 59999],
  ]) {
    const s = at(values),
      before = projectProgress(s);
    advance(s, 5);
    const after = projectProgress(s);
    assert.equal(after.finished, before.finished + 1);
    assert.equal(s.counts.Z2, 1);
    assert.ok(s.money >= base.money);
    assert.ok(
      s.events.some((e) => e.text.includes(`第 ${after.finished} 层落成`)),
    );
  }
});
test("all three dimensions must finish before the ending can be purchased once", () => {
  const s = at([60000, 60000, 59999]);
  assert.equal(buy(s, "Z3").ok, false);
  advance(s, 5);
  assert.equal(s.project, PROJECT_TARGET);
  assert.ok(projectProgress(s).complete);
  const before = s.money;
  assert.ok(buy(s, "Z3").ok);
  assert.equal(s.money, before - ITEMS.Z3.cost);
  assert.equal(buy(s, "Z3").ok, false);
  assert.deepEqual(ownedGroups(s, [ITEMS.Z2]).complete, [ITEMS.Z2]);
});
test("in-progress old saves keep delivery totals and the correct construction layer", () => {
  const s = at([40000, 30000, 20000]);
  delete s.projectFlow;
  const copy = restore(s);
  assert.equal(copy.counts.Z2, 1);
  assert.equal(copy.money, s.money);
  assert.deepEqual(copy.projectByRealm, s.projectByRealm);
  assert.equal(projectProgress(copy).layer, 2);
  assert.equal(projectProgress(copy).complete, false);
});
test("background time cannot finish a layer or issue an ending", () => {
  const s = at([60000, 60000, 59999]),
    before = structuredClone(s);
  advance(s, 467, { offline: true });
  assert.deepEqual(s.projectByRealm, before.projectByRealm);
  assert.equal(s.money, before.money);
  assert.equal(s.project, before.project);
  assert.equal(buy(s, "Z3").ok, false);
});
