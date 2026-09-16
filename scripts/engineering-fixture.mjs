import { completeFixture } from "./fixtures.mjs";
export function engineeringFixture() {
  // All facilities passed their real prerequisites in completeFixture. Rewind
  // only the engineering delivery/ending for isolated release verification.
  const s = completeFixture();
  delete s.counts.Z3;
  s.completed = false;
  s.completedAt = 0;
  s.project = 0;
  s.projectByRealm = { overworld: 0, nether: 0, end: 0 };
  s.projectFlow = { overworld: 0, nether: 0, end: 0 };
  s.money = 1e12;
  s.reducedMotion = true;
  s.realm = "overworld";
  return s;
}
