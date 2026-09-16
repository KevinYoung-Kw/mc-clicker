// Planning-only conservation and pacing checks, before runtime implementation.
import assert from "node:assert/strict";
import fs from "node:fs";
import { DIMENSION_RULES as D, ORDER_RULES as O } from "../src/economy.js";
const rows = [];
for (const [name, source, free, capacity] of [
  ["empty", 0, 100, 80],
  ["full-destination", 100, 0, 80],
  ["partial", 30, 100, 80],
  ["ghast", 500, 500, D.ghastCapacity],
  ["enderman", 500, 500, D.endermanCapacity],
  ["dragon", 2000, 2000, D.dragonCapacity],
]) {
  const moved = Math.min(source, free, capacity),
    left = source - moved;
  assert.equal(left + moved, source);
  assert.ok(moved <= free && moved <= capacity);
  rows.push({ name, source, free, capacity, moved });
}
for (const available of [0, 1, 10, 100, 1000]) {
  const project = Math.min(available * D.projectShare, 180),
    remaining = available - project;
  const order = Math.min(remaining, 64),
    sold = remaining - order;
  assert.equal(project + order + sold, available);
  rows.push({ name: "disjoint-dispatch", available, project, order, sold });
}
let heat = 0,
  made = 0,
  electricity = 0;
for (let t = 0; t < 360; t += 0.25) {
  heat = Math.min(D.heatCapacity, heat + D.heatPerBlaze * 0.25);
  const count = Math.min(15 * 0.25, heat / D.heatPerGoods);
  heat -= count * D.heatPerGoods;
  made += count;
  electricity += count * D.recoveredElectricityPerGoods;
  assert.ok(heat >= 0);
}
assert.equal(made, 5400);
assert.equal(electricity, 43200);
rows.push({ name: "one-blaze-one-furnace-360s", made, heat, electricity });
const result = {
  method:
    "Isolated planning equations, not full runtime balance or human play.",
  rules: D,
  orders: O,
  rows,
};
fs.mkdirSync("docs/v1.1l/simulation/dimensional-prototype", {
  recursive: true,
});
fs.writeFileSync(
  "docs/v1.1l/simulation/dimensional-prototype/results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "12 dimensional planning scenarios passed: bounded transfers, disjoint delivery pools, heat-limited recovery.",
);
