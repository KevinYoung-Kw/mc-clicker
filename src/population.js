import {activeLevel} from './facility-storage.js';
import { ITEMS } from "./catalog.js";
export const RESIDENT_LIMIT = 24;
export const LEGACY_RESIDENT_LIMIT = 60;

// Space and village services both matter. Only recruitment uses this capacity;
// a migrated save never loses residents, their jobs or their paid-for income.
export function populationSupport(s) {
  const n = (id) => activeLevel(s,id);
  const plots = n("V1") ? s.chunks.overworld.length : 0;
  const land = Math.min(RESIDENT_LIMIT, plots ? 4 + (plots - 1) * 2 : 0);
  const services = Math.min(
    RESIDENT_LIMIT,
    6 + n("V4") * 2 + (n("V6") ? 4 : 0) + (n("V14") ? 8 : 0),
  );
  return {
    plots,
    land,
    services,
    capacity: Math.min(land, services),
    next: land <= services ? "V1" : serviceOptions(s)[0],
  };
}

export function populationBlock(s) {
  const p = populationSupport(s);
  if (p.land === p.services)
    return {
      reason: `土地与村庄支持都已满（${p.capacity} 位），需扩地并完善农牧设施`,
      links: ["V1", ...serviceOptions(s)],
    };
  return p.next === "V1"
    ? {
        reason: `土地名额已满（${p.capacity} 位），扩地可增加居住空间`,
        links: ["V1"],
      }
    : {
        reason: `村庄支持名额已满（${p.capacity} 位），升级麦田或建设水井、钟楼`,
        links: serviceOptions(s),
      };
}

function serviceOptions(s) {
  return ["V4", "V6", "V14"].filter(id => (s.counts[id] || 0) < ITEMS[id].max);
}
