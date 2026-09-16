import { buy } from "../src/game.js";
import { buyGuidance, guidanceOwned } from "../src/guidance.js";

// Fixture funds are supplied by callers; every early ability is actually paid.
export function buyEarlyGuidance(s) {
  for (const id of ["T1", "goals", "V1", "info", "V18"]) {
    const ability = id === "goals" || id === "info";
    if (ability ? guidanceOwned(s, id) : s.counts[id] > 0) continue;
    const result = ability ? buyGuidance(s, id) : buy(s, id);
    if (!result.ok) throw Error(`${id}: ${result.reason}`);
  }
  return s;
}
