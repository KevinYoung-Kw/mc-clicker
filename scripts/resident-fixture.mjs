import {prepareResearchFor} from './research-fixture.mjs';
import {prepareRecruitHousing} from './housing-fixture.mjs';
import { setAutoConnect, connectAll } from '../src/power.js';
import { fresh, buy, sites, frontier } from "../src/game.js";
import { ancestors, topological } from "../src/catalog.js";
import { buyEarlyGuidance } from "./early-fixture.mjs";
// Funds-only fixture: placement and purchase dependencies still use the real rules.
export function residentFixture() {
  const s = fresh(0);
  setAutoConnect(s,true);
  s.money = 1e8;
  buyEarlyGuidance(s);
  const required = new Set();
  for (const id of [
    "V9",
    "V10",
    "V13",
    "V15",
    "M14",
    "M20",
    "M7",
    "L4",
    "L6",
    "X1",
  ]) {
    required.add(id);
    for (const p of ancestors(id)) required.add(p);
  }
  function expand() {
    const edge = frontier(s).sort(
      (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z),
    )[0];
    const r = buy(s, "V1", edge);
    if (!r.ok) throw Error(r.reason);
  }
  for (const i of topological().filter((i) => required.has(i.id))) {
    if (s.counts[i.id]) continue;
    prepareResearchFor(s,i.id);
    if (i.gate?.id)
      while ((s.counts[i.gate.id] || 0) < i.gate.level) {
        if(i.gate.id === "V2")prepareRecruitHousing(s);
        prepareResearchFor(s,i.gate.id);
        const r = buy(s, i.gate.id);
        if (!r.ok) {
          if (i.gate.id === "V2") {
            expand();
            continue;
          }
          throw Error(r.reason);
        }
      }
    while (i.place && !sites(s, i.realm, null, i.id).length) expand();
    const r = buy(s, i.id);
    if (!r.ok) throw Error(i.id + ": " + r.reason);
  }
  while (s.counts.V2 < 9) {
    prepareRecruitHousing(s);
    const r = buy(s, "V2");
    if (!r.ok) expand();
  }
  connectAll(s);
  s.live.peak=Math.max(s.live.peak,s.live.viewers);
  s.live.director = false;
  s.realm = "overworld";
  s.reducedMotion = true;
  s.energy = 50;
  return s;
}
if (process.argv[1]?.endsWith("resident-fixture.mjs"))
  console.log(JSON.stringify(residentFixture()));
