import { writeFileSync } from "node:fs";
import { CATALOG, ITEMS, ancestors } from "../src/catalog.js";
import { GUIDANCE_ITEMS, buyGuidance } from "../src/guidance.js";
import {
  fresh,
  n,
  buy,
  price,
  unlocked,
  rates,
  advance,
  action,
  mine,
  frontier,
  sites,
  PROJECT_TARGET,
} from "../src/game.js";
const withoutGuidance = process.argv.includes("--without-guidance");
function simulate(withLive) {
  const s = fresh(0),
    required = ancestors("Z3");
  if (withLive) for (const id of ancestors("L11")) required.add(id);
  if (withLive) for (const id of ancestors("L9")) required.add(id);
  const milestones = [],
    purchases = [];
  let time = 0;
  function purchase(i) {
    if (i.place && !n(s, i.id) && !sites(s, i.realm, null, i.id).length) {
      if (s.money >= price(s, ITEMS.V1, i.realm))
        buy(s, "V1", {
          ...frontier(s, i.realm).sort(
            (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z),
          )[0],
          realm: i.realm,
        });
      return false;
    }
    const result = buy(s, i.id);
    if (result.ok) {
      if (i.id === "E2") for (let j = 0; j < 12; j++) action(s, "end-eye");
      purchases.push({ at: time, id: i.id, level: n(s, i.id) });
      if (
        ["V2", "L2", "M8", "M16", "N1", "E2", "Z2", "Z3"].includes(i.id) &&
        n(s, i.id) === 1
      )
        milestones.push({
          id: i.id,
          name: i.name,
          at: time,
          rate: rates(s).total,
        });
    }
    return result.ok;
  }
  for (; time < 10800 && !s.completed; time++) {
    advance(s, 1);
    if (time % 2 === 0) mine(s, () => 1);
    if (time % 4) continue;
    const guidance = !withoutGuidance && GUIDANCE_ITEMS.find((item) => buyGuidance(s, item.id).ok);
    if (guidance) {
      purchases.push({ at: time, id: `guidance.${guidance.id}`, level: 1 });
      continue;
    }
    if (
      n(s, "V2") < 6 &&
      unlocked(s, ITEMS.V2) &&
      s.money >= price(s, ITEMS.V2)
    ) {
      purchase(ITEMS.V2);
      continue;
    }
    const next = CATALOG.filter(
      (i) => required.has(i.id) && !n(s, i.id) && unlocked(s, i),
    ).sort((a, b) => a.cost - b.cost)[0];
    if (next && s.money >= next.cost) {
      if (purchase(next)) continue;
    }
    const base = rates(s),
      project = n(s, "Z2") && s.project < PROJECT_TARGET;
    const utility = (r) =>
      project
        ? Object.entries(r.regions).reduce(
            (sum, [realm, v]) =>
              sum +
              (s.projectByRealm[realm] < PROJECT_TARGET / 3
                ? (v.potential / v.value) *
                  (realm === "overworld" ? 0.2 : realm === "nether" ? 1 : 3)
                : 0),
            0,
          )
        : r.total;
    const baseline = utility(base),
      choices = [];
    for (const i of CATALOG) {
      if (
        i.max <= 1 ||
        i.id === "V1" ||
        !unlocked(s, i) ||
        n(s, i.id) >= i.max ||
        i.family === "X"
      )
        continue;
      const copy = structuredClone(s);
      copy.money = 1e30;
      if (!buy(copy, i.id).ok) continue;
      const gain = utility(rates(copy)) - baseline;
      if (gain <= 0) continue;
      choices.push({ i, cost: price(s, i), roi: price(s, i) / gain });
    }
    const upgrade = choices.sort((a, b) => a.roi - b.roi)[0];
    const wait = next ? (next.cost - s.money) / Math.max(1, base.total) : 300;
    if (
      upgrade &&
      upgrade.cost <= s.money &&
      (project || upgrade.roi < Math.max(50, wait * 0.8))
    )
      purchase(upgrade.i);
  }
  return {
    scenario: withLive ? "with-livestream" : "production-only",
    seconds: time,
    completed: s.completed,
    guidance: s.guidance,
    milestones,
    total: s.total,
    counts: s.counts,
    project: s.project,
    projectByRealm: s.projectByRealm,
    purchases,
  };
}
const results = [simulate(false), simulate(true)];
writeFileSync(
  withoutGuidance ? "docs/qa/early-game-balance.json" : "docs/balance-results.json",
  JSON.stringify(
    {
      method:
        "Automated investment every 4 seconds, one tap every 2 seconds, fixed prices. Not a human playthrough.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(({ purchases, counts, ...rest }) => ({
      ...rest,
      purchaseCount: purchases.length,
    })),
    null,
    2,
  ),
);
