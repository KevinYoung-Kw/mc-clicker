// Same five investment policies; V1.4.3 explicitly opts into the free connection
// preference and retries eligible links when range/land later improves.
import { mkdirSync, writeFileSync } from "node:fs";
import { simulate, ROUTES } from "./balance-v1.1l.mjs";
import { connectAll, setAutoConnect } from "../src/power.js";
const out = "docs/v1.4.3/qa/simulation";
mkdirSync(out, { recursive: true });
const results = [];
for (const route of ROUTES) {
  let connections = 0;
  const r = simulate(route, {
    afterIncome(s, t) {
      if (!s.counts.M5) return;
      if (!s.grid.learnedConnection) {
        connections += connectAll(s).connected.length;
        if (!s.grid.learnedConnection) return;
      }
      if (!s.grid.autoConnect) setAutoConnect(s, true);
      if (t % 15 === 0) connections += connectAll(s).connected.length;
    },
  });
  const { state, ...report } = r;
  writeFileSync(
    `${out}/${route.id}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  const summary = {
    route: route.id,
    completed: r.completed,
    seconds: r.seconds,
    longestWait: r.longestWait,
    connections,
    projectByRealm: r.projectByRealm,
  };
  results.push(summary);
  console.log(JSON.stringify(summary));
}
writeFileSync(
  `${out}/summary.json`,
  JSON.stringify(
    {
      method:
        "Deterministic foreground simulation, original five policies, real purchases/placement/jobs, one free auto-connect preference and retry every 15s. No money injection. Not a human playthrough.",
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => !r.completed)) process.exitCode = 1;
