import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { fresh, restore, buy, sites, formatWallet } from "../src/game.js";
import { footprint, canPlace } from "../src/layout.js";
import { broadcastHouse } from "../src/village-models.js";
import { ITEMS } from "../src/catalog.js";

test("small devices have more half-block choices; studio entrance occupies two by two land squares", () => {
  const s = fresh();
  s.counts.V1 = 1;
  s.chunks.overworld.push({ x: 1, z: 0 });
  assert.ok(
    sites(s, "overworld", null, "L1").length >
      sites(s, "overworld", null, "L2").length,
  );
  assert.deepEqual(footprint("L1"), { w: 0.5, d: 0.5 });
  assert.deepEqual(footprint("L2"), { w: 2, d: 2 });
  const p = sites(s, "overworld", null, "L2")[0];
  s.placements.L2 = p;
  assert.equal(canPlace(s, "L1", { ...p, x: p.x + 0.5 }), false);
  assert.equal(canPlace(s, "L2", p, "L2"), true);
  assert.equal(canPlace(s, "L2", { x: 2, z: 2, realm: "overworld" }), false);
});
test("purchase checks the complete footprint and never charges for an overlap", () => {
  const s = fresh();
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};
  s.money = 1e6;
  s.counts = { V1: 1, V3: 2, L1: 1, M5: 1, M6: 1 };
  s.chunks.overworld.push({ x: 1, z: 0 });
  const p = sites(s, "overworld", null, "L2")[0];
  s.placements.T7 = { ...p, x: p.x + 0.5 };
  const money = s.money;
  assert.equal(buy(s, "L2", p).ok, false);
  assert.equal(s.money, money);
  delete s.placements.T7;
  assert.equal(buy(s, "L2", p).ok, true);
});
test("old full-world layout keeps every purchase and is stable after migration", () => {
  const old = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/layout-v2.json", import.meta.url),
      "utf8",
    ),
  );
  const migrated = restore(old),
    twice = restore(migrated);
  assert.deepEqual(migrated.counts, { ...old.counts, V18: 1, V19: 0, V20: 0, V21: 0, V22: 0, V23: 0, V24: 0, V25: 0 });
  assert.equal(
    Object.keys(migrated.placements).length,
    Object.entries(old.counts).filter(
      ([id, count]) =>
        count &&
        (ITEMS[id]?.place ||
          (["M10", "M11", "M12", "M13"].includes(id) && old.placements[id])) &&
        !(id === "L1" && old.counts.L2),
    ).length + 1, // The earned legacy mailbox is the only newly granted building.
  );
  for (const [id, p] of Object.entries(migrated.placements))
    assert.ok(canPlace(migrated, id, p, id), id);
  assert.deepEqual(twice.placements, migrated.placements);
  assert.equal(migrated.money, old.money);
});
test("wallet shows precise sub-million changes and enough significant digits thereafter", () => {
  assert.equal(formatWallet(15023), "15,023");
  assert.equal(formatWallet(15024), "15,024");
  assert.equal(formatWallet(999999.9), "999,999");
  assert.equal(formatWallet(1234567), "1.234M");
  assert.equal(formatWallet(Infinity), "0");
  assert.equal(formatWallet(1e20), "100.000Qi");
  assert.equal(formatWallet(1e9), "1.000B");
  assert.equal(formatWallet(1e12), "1.000T");
  assert.equal(formatWallet(1e15), "1.000Qa");
});
test("recording light animation preserves its tiny scale inside the independent room", () => {
  const scene = new T.Group(),
    animations = [];
  const room = broadcastHouse(scene, animations, true);
  for (let tick = 0; tick < 50; tick++)
    for (const fn of animations) fn(tick * 0.1);
  room.updateMatrixWorld(true);
  const size = new T.Box3().setFromObject(room).getSize(new T.Vector3());
  assert.ok(size.x <= 6 && size.z <= 5 && size.y <= 2.4, JSON.stringify(size));
});
