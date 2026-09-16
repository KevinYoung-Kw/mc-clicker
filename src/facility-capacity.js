import {powerCompensation} from './power-compatibility.js';
import {activeLevel} from './facility-storage.js';
import { upgradeMultiplier } from "./upgrades.js";

// Shared by simulation and purchase comparisons. These are base capacities;
// working state, power allocation and regional boosts remain in the simulation.
export function scaledCount(s, id) {
  const count = activeLevel(s,id);
  return count * (count >= 25 ? 3 : count >= 10 ? 1.8 : count >= 5 ? 1.25 : 1);
}
export function drillCapacity(s) {
  return scaledCount(s, "M9") * 14 * Math.min(upgradeMultiplier(s, "M9", "raw"), 2 * upgradeMultiplier(s, "M9", "outlet"));
}
export function furnaceCapacity(s) {
  return scaledCount(s, "M2") * 5 * Math.min(upgradeMultiplier(s, "M2", "process"), 2 * upgradeMultiplier(s, "M2", "inlet"));
}
export function generationCapacity(s, id) {
  if (!activeLevel(s,id)) return 0;
  return (["M6"].includes(id) ? activeLevel(s,id) : scaledCount(s,id)) * ({ M6: 6, M7: 32, M15: 60, E8: 180 }[id] || 0) * upgradeMultiplier(s, id, "generation") + powerCompensation(s,id);
}

export function purchasedGenerationCapacity(s,id) { return generationCapacity({...s,facilityStorage:{},grid:{...s.grid,powerCompensation:{}}},id); }
