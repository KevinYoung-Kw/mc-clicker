import test from "node:test";
import assert from "node:assert/strict";
import { fresh, buy, restore } from "../src/game.js";
import { captureFirstVictory, victorySource } from "../src/victory.js";
import { RELEASE_NAME } from "../src/release.js";
function finish() {
  const s = fresh();
  s.counts = { Z2: 1 };
  s.project = 180000;
  s.projectByRealm = { overworld: 60000, nether: 60000, end: 60000 };
  s.play = 3600;
  s.total = 123456;
  s.money = 500;
  assert.equal(buy(s, "Z3").ok, true);
  return s;
}
test("first actual creative-mode purchase captures an independent immutable world and stats", () => {
  const s = finish();
  assert.ok(Object.isFrozen(s.victory.snapshot.counts));
  assert.equal(s.victory.snapshot.play, 3600);
  assert.equal(s.victory.release, RELEASE_NAME);
  s.money += 100;
  s.play += 200;
  s.counts.M9 = 6;
  s.collection.owned.test = true;
  assert.equal(s.victory.snapshot.money, 500);
  assert.equal(s.victory.snapshot.counts.M9, undefined);
  assert.equal(captureFirstVictory(s), false);
  assert.equal("victory" in s.victory.snapshot, false);
  assert.throws(() => {
    s.victory.snapshot.play = 1;
  }, TypeError);
  const view = victorySource(s);
  view.snapshot.money = 0;
  assert.equal(s.victory.snapshot.money, 500);
});
test("snapshot survives save/load, later construction does not replace first finish", () => {
  const s = finish();
  s.money = 999;
  s.play = 4000;
  const reloaded = restore(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.play, 4000);
  assert.equal(reloaded.victory.snapshot.play, 3600);
  assert.equal(reloaded.victory.snapshot.total, 123456);
  assert.ok(Object.isFrozen(reloaded.victory));
  assert.equal(reloaded.completed, true);
  assert.equal(victorySource(reloaded).label, "首次通关");
});
test("old winners use current construction explicitly, never fabricate a historical snapshot", () => {
  const s = finish();
  delete s.victory;
  s.version = 5;
  s.counts.M9 = 2;
  const loaded = restore(s),
    source = victorySource(loaded);
  assert.equal(loaded.completed, true);
  assert.equal(loaded.victory, null);
  assert.equal(source.historical, false);
  assert.equal(source.label, "当前建设 · 历史通关");
  assert.equal(source.snapshot.counts.M9, 2);
  assert.equal(victorySource(fresh()), null);
});
test("imported nested snapshot data is stripped before validation and cannot recurse", () => {
  const s = finish(),
    raw = JSON.parse(JSON.stringify(s));
  raw.victory.snapshot.victory = raw.victory;
  const loaded = restore(raw);
  assert.equal(loaded.victory.snapshot.victory, undefined);
  const bad = finish();
  bad.victory = {
    version: 1,
    snapshot: { completed: true, counts: { Z3: 1 }, version: 999 },
  };
  assert.equal(restore(bad).victory, null);
});

test('schema-6 first victory keeps historical JSON and weather byte-for-byte',()=>{
 const s=JSON.parse(JSON.stringify(finish()));s.version=6;s.victory.snapshot.version=6;
 delete s.webAppearance;delete s.environment;delete s.scenery;
 delete s.victory.snapshot.webAppearance;delete s.victory.snapshot.environment;delete s.victory.snapshot.scenery;
 s.victory.snapshot.collection={version:2,owned:{'world-snow':true,'frame-2':true},equipped:{frame:'frame-2'},disabled:{}};
 const before=JSON.stringify(s.victory.snapshot),r=restore(s);
 assert.equal(JSON.stringify(r.victory.snapshot),before);assert.equal(r.version,10);assert.equal(r.victory.snapshot.version,6);
 assert.equal(JSON.stringify(restore(r).victory.snapshot),before);
});
