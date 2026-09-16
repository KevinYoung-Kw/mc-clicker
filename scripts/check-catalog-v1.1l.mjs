import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { CATALOG, ITEMS } from "../src/catalog.js";
import { UPGRADE_CATALOG } from "../src/upgrade-catalog.js";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const base = json("docs/v1.1l/base-purchases.json").rows;
const table = json("docs/v1.1l/upgrade-purchases.json");
const mods = Array.isArray(table) ? table : table.rows;
assert.equal(base.length, CATALOG.length);
assert.equal(mods.length, UPGRADE_CATALOG.length);
for (const row of base)
  for (const key of ["cost", "growth", "max", "deps"])
    assert.deepEqual(ITEMS[row.id][key], row[key], `${row.id}.${key}`);
for (const row of mods) {
  const live = UPGRADE_CATALOG.find((x) => x.id === row.id);
  for (const key of [
    "basePrice",
    "growth",
    "maxLevel",
    "dependencies",
    "effects",
    "energy",
  ])
    assert.deepEqual(live[key], row[key], `${row.id}.${key}`);
}
const byId = Object.fromEntries(
  [...base.map((x) => ({ ...x, dependencies: x.deps })), ...mods].map((x) => [
    x.id,
    x,
  ]),
);
const done = new Set(),
  stack = new Set();
function visit(id) {
  assert.ok(byId[id], id);
  assert.ok(!stack.has(id), "cycle " + id);
  if (done.has(id)) return;
  stack.add(id);
  for (const dep of byId[id].dependencies || []) visit(dep);
  stack.delete(id);
  done.add(id);
}
Object.keys(byId).forEach(visit);
console.log(
  JSON.stringify({
    base: base.length,
    upgrades: mods.length,
    acyclic: done.size,
    runtimeMatchesTables: true,
  }),
);
