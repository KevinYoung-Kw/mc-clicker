import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, buy } from "../src/game.js";
import { ITEMS } from "../src/catalog.js";
import { purchaseStatus } from "../src/purchase-feedback.js";
import { takeShopHint } from "../src/shop-onboarding.js";

test("purchase feedback distinguishes money, prerequisites, placement and completion", () => {
  const s = fresh();
  s.money = 0.2;
  assert.equal(purchaseStatus(s, ITEMS.T1).reason, "还差 10 绿宝石");
  assert.equal(purchaseStatus(s, ITEMS.V1).kind, "locked");
  assert.deepEqual(purchaseStatus(s, ITEMS.V1).links, ["T1"]);
  s.money = 100;
  assert.equal(purchaseStatus(s, ITEMS.T1).kind, "ready");
  assert.ok(buy(s, "T1").ok);
  assert.equal(purchaseStatus(s, ITEMS.T1).reason, "已完成");
  assert.equal(purchaseStatus(s, ITEMS.V1, { id: "V1", kind: "expand" }).reason, "请点地图选择位置");
  assert.equal(purchaseStatus(s, ITEMS.V1, { id: "V1", kind: "expand", site: {x:0,z:0} }).kind, "placing");
  s.counts.V1 = 32;
  assert.equal(purchaseStatus(s, ITEMS.V1).kind, "ready");
  assert.equal(purchaseStatus(s, ITEMS.V1).action, "扩地");
});

test("level, capacity, dimension and project gates link to actionable prerequisite projects", () => {
  const s = fresh();
  assert.ok(purchaseStatus(s, ITEMS.V13).links.includes("V12"));
  assert.ok(purchaseStatus(s, ITEMS.E3).links.includes("E2"));
  assert.ok(purchaseStatus(s, ITEMS.Z3).links.includes("Z2"));
  Object.assign(s.counts, {T1:1,V1:1,V18:1,V2:6});
  assert.equal(purchaseStatus(s, ITEMS.V2).reason, "土地名额已满（4 位），扩地可增加居住空间");
  assert.deepEqual(purchaseStatus(s, ITEMS.V2).links,["V1"]);
});

test("shop discovery only fires at first affordability and survives saves without repeat prompts", () => {
  const s = fresh();
  s.money = 9;
  assert.equal(takeShopHint(s, 10), false);
  s.money = 10;
  assert.equal(takeShopHint(s, 10), true);
  assert.equal(takeShopHint(s, 10), false);
  assert.equal(takeShopHint(restore(JSON.parse(JSON.stringify(s))), 10), false);
  const old = fresh(); old.money = 100; old.counts.T1 = 1;
  delete old.shopHintSeen;
  assert.equal(takeShopHint(restore(old), 10), false);
});
