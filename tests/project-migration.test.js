import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore } from "../src/game.js";
import { PROJECT_TARGET, projectProgress } from "../src/project.js";
test("legacy total-only engineering keeps completed layers and total progress", () => {
  for (const version of [2, 3, 4, 5]) {
    const raw = fresh();
    raw.version = version;
    raw.counts = { Z2: 1 };
    raw.project = 123456;
    delete raw.projectByRealm;
    delete raw.projectGoal;
    raw.money = 999;
    const s = restore(raw);
    assert.equal(s.project, 123456);
    assert.equal(s.money, 999);
    assert.equal(projectProgress(s).finished, 2);
    assert.equal(s.projectGoal, PROJECT_TARGET);
  }
});
test("a changed historical target migrates every realm proportionally, without losing any completed layer", () => {
  const raw = fresh();
  raw.projectGoal = 90000;
  raw.projectByRealm = { overworld: 30000, nether: 15000, end: 6000 };
  raw.project = 51000;
  const s = restore(raw);
  assert.deepEqual(s.projectByRealm, {
    overworld: 60000,
    nether: 30000,
    end: 12000,
  });
  assert.equal(s.project, 102000);
  const copy = restore(s);
  assert.deepEqual(copy.projectByRealm, s.projectByRealm);
});
test("old winner without dimension records retains finished engineering and creative-mode qualification", () => {
  const raw = fresh();
  raw.version = 2;
  raw.counts = { Z2: 1, Z3: 1 };
  raw.completed = true;
  delete raw.projectByRealm;
  const s = restore(raw);
  assert.equal(s.completed, true);
  assert.equal(s.project, PROJECT_TARGET);
  assert.equal(projectProgress(s).finished, 3);
  assert.equal(s.victory, null);
});
