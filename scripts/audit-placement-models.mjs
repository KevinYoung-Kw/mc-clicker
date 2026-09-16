import * as T from "three";
import { writeFileSync } from "node:fs";
import { CATALOG } from "../src/catalog.js";
import { fresh } from "../src/game.js";
import { makeObject, makeActor } from "../src/objects.js";
import { footprint, MODEL_INSET } from "../src/layout.js";

const state = fresh(),
  cases = [],
  failures = [];
const flying = ["N6", "N9", "E9"],
  actors = ["N3", "N5", "N8", "E3", "E5"];
for (const item of CATALOG) state.counts[item.id] = 1;
for (const item of CATALOG.filter((i) => i.place && !flying.includes(i.id))) {
  for (const level of new Set([
    1,
    Math.min(3, item.max),
    Math.min(10, item.max),
  ])) {
    state.counts[item.id] = level;
    const root = new T.Group(),
      animations = [];
    if (actors.includes(item.id)) makeActor(root, item.id, animations);
    else makeObject(root, item, state, animations);
    const size = new T.Box3().setFromObject(root).getSize(new T.Vector3()),
      plot = footprint(item.id);
    root.scale.setScalar(
      Math.min(
        (plot.w - MODEL_INSET * 2) / size.x,
        (plot.d - MODEL_INSET * 2) / size.z,
      ) * (item.id === "L2" ? 1 : Math.min(1, 0.9 + (level - 1) * 0.012)),
    );
    let width = 0,
      depth = 0;
    for (let t = 0; t <= 32; t += 0.4) {
      animations.forEach((fn) => fn(t));
      const actual = new T.Box3().setFromObject(root).getSize(new T.Vector3());
      width = Math.max(width, actual.x);
      depth = Math.max(depth, actual.z);
    }
    const row = {
      id: item.id,
      name: item.name,
      level,
      plot,
      maximumModel: { width, depth },
    };
    cases.push(row);
    if (width > plot.w + 0.01 || depth > plot.d + 0.01) failures.push(row);
    state.counts[item.id] = 1;
  }
}
const report = {
  buildings: new Set(cases.map((c) => c.id)).size,
  sampledLevels: cases.length,
  sampleDurationSeconds: 32,
  flyingAboveRoofs: flying,
  failures,
  cases,
};
writeFileSync(
  new URL("../docs/qa/placement-model-audit.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    buildings: report.buildings,
    sampledLevels: cases.length,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
