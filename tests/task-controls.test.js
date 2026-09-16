import test from "node:test";
import assert from "node:assert/strict";
import { fresh } from "../src/game.js";
import { ensureCommunity, assignJob } from "../src/residents.js";
import { taskControl } from "../src/task-controls.js";
import { taskState } from "../src/operations.js";

function farm() {
  const s = fresh();
  Object.assign(s.counts, { V2: 1, V4: 1 });
  ensureCommunity(s);
  s.harvest.farm = 1;
  return s;
}
test("manual work, assigned villagers and reassignment expose the actual controller", () => {
  const s = farm();
  assert.equal(taskControl(s, "farm").label, "点击采集");
  assert.equal(taskControl(s, "farm").disabled, false);
  assert.ok(assignJob(s, "resident-1", "farmer").ok);
  assert.equal(taskControl(s, "farm").label, "村民托管中");
  assert.match(taskControl(s, "farm").detail, /可点击协助/);
  assert.ok(assignJob(s, "resident-1", "idle").ok);
  s.counts.V2 = 25;
  ensureCommunity(s);
  s.community.residents[24].job = "farmer";
  assert.equal(taskControl(s, "farm").mode, "manual");
});
test("automation distinguishes absent supply, running, pause, disconnect and waiting for a harvest", () => {
  const s = farm();
  Object.assign(s.counts, { M5: 1, M10: 1, M14: 1 });
  s.grid.automation.farm = 1;
  assert.equal(taskControl(s, "farm").label, "红石等待供电");
  s.counts.M6 = 20;
  assert.equal(taskControl(s, "farm").label, "红石自动运行");
  assert.match(taskControl(s, "farm").detail, /E\/秒/);
  s.grid.disabled.push("M14");
  assert.equal(taskControl(s, "farm").label, "红石已暂停");
  s.grid.disabled = [];
  s.grid.links.V4 = false;
  assert.equal(taskControl(s, "farm").label, "红石未接通");
  delete s.grid.links.V4;
  s.harvest.farm = 0.5;
  assert.equal(taskControl(s, "farm").label, "红石自动待机");
  assert.equal(taskControl(s, "farm").disabled, true);
});
test("music cooldown and queued manual assistance stay visible without permitting duplicate work", () => {
  const s = farm();
  s.counts.L1 = 1;
  assert.equal(taskControl(s, "music").label, "手动触发");
  taskState(s, "music").cooldown = 6.5;
  assert.match(taskControl(s, "music").detail, /7 秒/);
  assert.equal(taskControl(s, "music").disabled, true);
  taskState(s, "farm").manual = true;
  assert.equal(taskControl(s, "farm").disabled, true);
  assert.match(taskControl(s, "farm").detail, /手动协助/);
});
test("piston collection reports the hopper power instead of an unrelated stopped piston", () => {
  const s = fresh();
  Object.assign(s.counts, { M3: 1, M5: 1, M6: 20, M8: 1 });
  s.harvest.piston = 20;
  s.grid.disabled.push("M3");
  assert.equal(taskControl(s, "piston").label, "红石自动运行");
  s.grid.disabled.push("M8");
  assert.equal(taskControl(s, "piston").label, "红石已暂停");
  s.grid.disabled = [];
  s.grid.links.M8 = false;
  assert.equal(taskControl(s, "piston").label, "红石未接通");
  delete s.grid.links.M8;
  s.counts.M6 = 0;
  assert.equal(taskControl(s, "piston").label, "红石等待供电");
});
