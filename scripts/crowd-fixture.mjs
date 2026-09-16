import { residentFixture } from "./resident-fixture.mjs";
import { ensureCommunity } from "../src/residents.js";
import { buy } from "../src/game.js";
export function crowdFixture() {
  const s = residentFixture();
  for (const id of [
    "V4",
    "V4",
    "V4",
    "V4",
    "V4",
    "V7",
    "V7",
    "M4",
    "M4",
    "V15",
    "V15",
  ]) {
    const result = buy(s, id);
    if (!result.ok) throw Error(`${id}: ${result.reason}`);
  }
  // Historical save: forty-five purchased residents were legal before the cap.
  s.version = 3;
  s.counts.V2 = 45;
  ensureCommunity(s);
  for (const r of s.community.residents) {
    delete r.reserve;
    delete r.previousJob;
  }
  for (const [i, job] of [
    [0, "farmer"],
    [1, "farmer"],
    [44, "farmer"],
    [2, "rancher"],
    [3, "rancher"],
    [4, "hauler"],
    [5, "hauler"],
    [6, "miner"],
    [7, "crafter"],
    [8, "musician"],
    [9, "engineer"],
    [10, "stagehand"],
  ])
    s.community.residents[i].job = job;
  s.community.residents[44].name = "南瓜老师";
  s.community.residents[44].skills.farming = 4;
  s.community.residents[43].name = "老朋友";
  s.community.residents[43].skills.crafting = 3;
  s.reducedMotion = false;
  return s;
}
if (process.argv[1]?.endsWith("crowd-fixture.mjs"))
  console.log(JSON.stringify(crowdFixture()));
