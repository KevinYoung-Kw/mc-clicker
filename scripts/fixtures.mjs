import {prepareResearchFor} from './research-fixture.mjs';
import {prepareRecruitHousing} from './housing-fixture.mjs';
import { setAutoConnect, connectAll } from '../src/power.js';
import { UPGRADE_CATALOG, buyUpgrade } from "../src/upgrades.js";
import {
  fresh,
  buy,
  frontier,
  sites,
  advance,
  action,
  PROJECT_TARGET,
} from "../src/game.js";
import { topological } from "../src/catalog.js";
import { buyEarlyGuidance } from "./early-fixture.mjs";
// Test fixtures grant funds only; every facility still passes the real purchase rules.
export function completeFixture() {
  const s = fresh();
  setAutoConnect(s,true);
  s.money = 1e20;
  buyEarlyGuidance(s);
  const expand = (realm) => {
    const choice = frontier(s, realm).sort(
      (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || a.z - b.z,
    )[0];
    const result = buy(s, "V1", { ...choice, realm });
    if (!result.ok) throw Error("Land: " + result.reason);
  };
  for (const item of topological().filter(i=>i.id!=="V20")) {
    if (s.counts[item.id]) continue;
    prepareResearchFor(s,item.id);
    if (item.gate?.id)
      while ((s.counts[item.gate.id] || 0) < item.gate.level) {
        if(item.gate.id === "V2")prepareRecruitHousing(s);
        prepareResearchFor(s,item.gate.id);
        const result = buy(s, item.gate.id);
        if (!result.ok) throw Error(item.gate.id + ": " + result.reason);
      }
    if (item.gate?.metric === "viewers") { connectAll(s); advance(s, 1000); }
    if (item.gate?.metric === "project") {
      // This all-content fixture invests its granted funds in the real network.
      // A single level of every facility is no longer a shortcut around cargo.
      for (const id of ["M2", "M7", "M9", "M16", "V3", "N3", "E4", "E5"])
        while ((s.counts[id] || 0) < 5) {
          const result = buy(s, id);
          if (!result.ok) throw Error(id + ": " + result.reason);
        }
      for (let pass = 0; pass < 3; pass++)
        for (const upgrade of UPGRADE_CATALOG)
          while (buyUpgrade(s, upgrade.id).ok) {}
      advance(s, 20000);
      if (s.project < PROJECT_TARGET)
        throw Error("Project stalled at " + s.project);
    }
    while (item.place && !sites(s, item.realm, null, item.id).length) {
      try {
        expand(item.realm);
      } catch (error) {
        throw Error(
          `${item.id} needs land (${s.counts.V1} purchased): ${error.message}`,
        );
      }
    }
    const result = buy(s, item.id);
    if (!result.ok) throw Error(item.id + ": " + result.reason);
    if (item.id === "E2") for (let j = 0; j < 12; j++) action(s, "end-eye");
  }
  while(s.chunks.overworld.length<4 || !sites(s,'overworld',null,'V20').length)expand('overworld');
  if(s.play<900)advance(s,900-s.play);
  const garden=buy(s,'V20');if(!garden.ok)throw Error('V20: '+garden.reason);
  s.realm = "overworld";
  connectAll(s);
  s.live.peak=Math.max(s.live.peak,s.live.viewers);
  s.live.director = false;
  s.live.shot = "V4";
  s.live.camera = "overworld";
  return s;
}
