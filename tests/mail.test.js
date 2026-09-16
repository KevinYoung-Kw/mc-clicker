import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, ITEMS, ancestors, topological } from "../src/catalog.js";
import {
  fresh,
  buy,
  advance,
  rates,
  restore,
  requirements,
  price,
  redeemMail,
  settleOffline,
  VERSION,
} from "../src/game.js";
import { buyGuidance } from "../src/guidance.js";
import { canPlace } from "../src/layout.js";
import { MAIL_CATALOG } from "../src/mail-content.js";
import {
  freshMail,
  mailSummary,
  readMail,
  claimMail,
  deliverMail,
  postalLevel,
  postalRate,
  postalUpgradeCost,
  upgradePostal,
  mailRewardPreview,
} from "../src/mail.js";

const WECHAT = "welcome-wechat",
  XHS = "welcome-xiaohongshu",
  GROUP = "community-wechat-group";
function mailbox() {
  const s = fresh(100);
  s.money = 1000;
  for (const [id, guidance] of [
    ["T1"],
    ["goals", true],
    ["V1"],
    ["info", true],
    ["V18"],
  ])
    assert.ok((guidance ? buyGuidance(s, id) : buy(s, id)).ok, id);
  return s;
}

test("mailbox is a 20-emerald physical early required node between land and work/village", () => {
  assert.equal(VERSION, 10);
  assert.equal(CATALOG.length, 104);
  assert.equal(topological().length, 104);
  assert.equal(ancestors("Z3").size, 47);
  assert.equal(ITEMS.V18.place, true);
  assert.equal(ITEMS.V18.model, "mailbox");
  assert.equal(ITEMS.V18.max, 1);
  const s = fresh();
  s.money = 500;
  assert.deepEqual(s.mail, freshMail());
  assert.ok(buy(s, "T1").ok);
  assert.ok(buyGuidance(s, "goals").ok);
  assert.ok(buy(s, "V1").ok);
  assert.deepEqual(requirements(s, ITEMS.V18), []);
  assert.deepEqual(requirements(s, ITEMS.T7), ["邮箱"]);
  assert.deepEqual(requirements(s, ITEMS.V2), ["邮箱"]);
  assert.equal(buy(s, "T7").ok, false);
  assert.equal(buy(s, "V2").ok, false);
  assert.equal(price(s, ITEMS.V18), 20);
  const before = s.money;
  assert.ok(buy(s, "V18").ok);
  assert.equal(s.money, before - 20);
  assert.ok(s.placements.V18);
  assert.ok(canPlace(s, "V18", s.placements.V18, "V18"));
  assert.equal(postalLevel(s), 1);
  assert.ok(buy(s, "V2").ok);
  assert.ok(buy(s, "T7").ok);
  assert.equal(buy(s, "V18").ok, false);
});

test("building delivers exactly three activity letters once; listing neither reads nor pays", () => {
  assert.deepEqual(
    MAIL_CATALOG.map((m) => [m.id, m.type]),
    [
      [WECHAT, "activity"],
      [XHS, "activity"],
      [GROUP, "activity"],
    ],
  );
  for (const item of MAIL_CATALOG) {
    assert.equal(item.expiresAt, null);
    assert.equal(item.reward.kind, "claim-rate");
  }
  const s = mailbox(),
    before = structuredClone(s);
  assert.deepEqual(mailSummary(s), {
    total: 3,
    unread: 3,
    unclaimed: 0,
    claimed: 0,
  });
  assert.deepEqual(s, before);
  assert.equal(deliverMail(s, WECHAT).ok, false);
  assert.equal(deliverMail(s, "invented").ok, false);
  assert.equal(claimMail(s, WECHAT).ok, false);
  assert.equal(redeemMail(s, XHS).ok, false);
  assert.deepEqual(s, before);
});

test("first read and reread do not freeze a reward; claiming uses the later actual HUD rate", () => {
  const s = mailbox();
  s.play = 20;
  s.rate = 3.125;
  const wallet = s.money;
  assert.equal(readMail(s, WECHAT).first, true);
  assert.equal(s.mail.letters[WECHAT].readAt, 20);
  assert.equal(s.mail.letters[WECHAT].reward, null);
  assert.equal(s.mail.letters[WECHAT].claimedRate, null);
  assert.equal(s.money, wallet);
  s.play = 65;
  s.rate = 18.75;
  assert.equal(readMail(s, WECHAT).first, false);
  assert.equal(s.mail.letters[WECHAT].readAt, 20);
  assert.deepEqual(mailRewardPreview(s), { rate: 18.75, value: 93.75 });
  assert.deepEqual(redeemMail(s, WECHAT), { ok: true, value: 93.75 });
  assert.equal(s.mail.letters[WECHAT].claimedRate, 18.75);
  assert.equal(s.mail.letters[WECHAT].claimedAt, 65);
  assert.equal(s.money, wallet + 93.75);
  assert.equal(s.mailIncome, 93.75);
});

test("two letters are independent and each claim is once-only across repeats and export/import", () => {
  const s = mailbox();
  readMail(s, WECHAT);
  readMail(s, XHS);
  s.rate = 5;
  assert.equal(redeemMail(s, WECHAT).value, 25);
  const once = structuredClone(s);
  for (let i = 0; i < 10; i++) assert.equal(redeemMail(s, WECHAT).ok, false);
  assert.deepEqual(s, once);
  const restored = restore(JSON.parse(JSON.stringify(s)), 20000);
  restored.rate = 100;
  assert.equal(redeemMail(restored, WECHAT).ok, false);
  assert.equal(restored.mail.letters[WECHAT].reward, 25);
  assert.equal(redeemMail(restored, XHS).value, 500);
  assert.equal(restored.mailIncome, 525);
  assert.deepEqual(mailSummary(restored), {
    total: 3,
    unread: 1,
    unclaimed: 0,
    claimed: 2,
  });
  const twice = restore(JSON.parse(JSON.stringify(restored)));
  assert.equal(redeemMail(twice, XHS).ok, false);
  assert.deepEqual(twice.mail, restored.mail);
});

test("zero and invalid actual rates safely claim zero once, with no arbitrary minimum or infinity", () => {
  for (const rate of [0, -1, Infinity, NaN, "50", Number.MAX_VALUE]) {
    const s = mailbox(),
      before = s.money;
    readMail(s, WECHAT);
    s.rate = rate;
    assert.deepEqual(redeemMail(s, WECHAT), { ok: true, value: 0 });
    assert.equal(s.money, before);
    assert.equal(s.mailIncome, 0);
    assert.equal(s.mail.letters[WECHAT].claimedAt, 0);
    s.rate = 100;
    assert.equal(redeemMail(s, WECHAT).ok, false);
  }
});

test("postal upgrades have fixed prices, spend atomically and cap at level five", () => {
  const freshState = fresh();
  assert.equal(postalRate(freshState), 0);
  assert.equal(upgradePostal(freshState).ok, false);
  const s = mailbox();
  s.money = 900;
  for (const [level, cost, rate] of [
    [2, 40, 2],
    [3, 100, 4],
    [4, 240, 7],
    [5, 520, 11],
  ]) {
    assert.equal(postalUpgradeCost(s), cost);
    s.rate = 1e12;
    assert.equal(postalUpgradeCost(s), cost);
    const before = structuredClone(s);
    s.money = cost - 1;
    const poor = structuredClone(s);
    assert.equal(upgradePostal(s).ok, false);
    assert.deepEqual(s, poor);
    s.money = before.money;
    assert.deepEqual(upgradePostal(s), { ok: true, cost, level, rate });
  }
  assert.equal(s.money, 0);
  assert.equal(postalUpgradeCost(s), null);
  const capped = structuredClone(s);
  assert.equal(upgradePostal(s).ok, false);
  assert.deepEqual(s, capped);
  assert.equal(restore(JSON.parse(JSON.stringify(s))).mail.postalLevel, 5);
});

test("postal income accrues only through foreground advance and does not run while offline", () => {
  const s = mailbox();
  const before = s.money;
  assert.equal(rates(s).postal, 1);
  advance(s, 4.5);
  assert.equal(s.money, before + 4.5);
  assert.equal(s.postalIncome, 4.5);
  assert.equal(s.rate, 1);
  assert.equal(s.productionIncome, 0);
  assert.equal(s.liveIncome, 0);
  const foreground = structuredClone(s);
  assert.equal(advance(s, 467, { offline: true }), 0);
  assert.deepEqual(s, foreground);
  settleOffline(s, s.savedAt + 467000);
  assert.equal(s.money, foreground.money);
  assert.equal(s.postalIncome, foreground.postalIncome);
  const restored = restore(JSON.parse(JSON.stringify(s)), 1000000);
  assert.equal(restored.money, s.money);
  assert.equal(restored.postalIncome, 4.5);
});

test("mail payouts stay separate from production and host attribution, and never inflate the rate", () => {
  const s = mailbox();
  advance(s, 2);
  readMail(s, WECHAT);
  const before = rates(s),
    oldRate = s.rate;
  assert.equal(redeemMail(s, WECHAT).value, 5);
  assert.equal(s.rate, oldRate);
  assert.deepEqual(rates(s), before);
  assert.equal(s.productionIncome, 0);
  assert.equal(s.liveIncome, 0);
  assert.equal(s.community.jobIncome, 0);
  advance(s, 1);
  assert.equal(s.rate, 1);
  assert.equal(s.postalIncome, 3);
  assert.equal(s.mailIncome, 5);
});

test("legacy saves receive an earned mailbox without losing buildings, while v5 cannot skip purchase", () => {
  for (const version of [2, 3, 4]) {
    const old = fresh();
    old.version = version;
    Object.assign(old.counts, { T1: 1, V1: 1, T7: 1, V2: 1 });
    old.placements.T7 = { x: -1, z: -1, realm: "overworld" };
    old.money = 321;
    delete old.mail;
    const loaded = restore(old);
    assert.equal(loaded.version, 10);
    assert.equal(loaded.money, 321);
    assert.equal(loaded.counts.V18, 1);
    assert.equal(loaded.counts.T7, 1);
    for (const id of ["T7", "V18"])
      assert.ok(canPlace(loaded, id, loaded.placements[id], id));
    assert.equal(mailSummary(loaded).unread, 3);
    assert.equal(postalLevel(loaded), 1);
    assert.deepEqual(restore(loaded).mail, loaded.mail);
  }
  for (const version of [4, 5]) {
    const modern = fresh();
    modern.version = version;
    Object.assign(modern.counts, { T1: 1, V1: 1, T7: 1, V2: 1 });
    if (version === 5) delete modern.mail;
    const loaded = restore(modern);
    assert.equal(loaded.counts.V18, 0);
    assert.equal(postalLevel(loaded), 0);
    assert.ok(requirements(loaded, ITEMS.V2).includes("邮箱"));
  }
  const earlyLegacy = fresh();
  earlyLegacy.version = 4;
  earlyLegacy.counts = { T1: 1, V1: 1 };
  delete earlyLegacy.mail;
  assert.equal(restore(earlyLegacy).counts.V18, 0);
});

test("unclaimed old read snapshots migrate to claim-time rates, but historical claims remain spent", () => {
  const s = mailbox();
  s.version = 4;
  const old = {
    deliveredAt: 0,
    readAt: 10,
    readRate: 3,
    reward: 15,
    claimedAt: null,
    blocked: false,
  };
  s.mail.letters[WECHAT] = { ...old };
  s.mail.letters[XHS] = { ...old, claimedAt: 12 };
  const loaded = restore(s);
  assert.equal(loaded.mail.letters[WECHAT].reward, null);
  assert.equal(loaded.mail.letters[WECHAT].claimedRate, null);
  assert.equal(loaded.mail.letters[WECHAT].readAt, 10);
  loaded.rate = 200;
  assert.equal(redeemMail(loaded, WECHAT).value, 1000);
  assert.equal(loaded.mail.letters[XHS].reward, 15);
  assert.equal(loaded.mail.letters[XHS].claimedRate, 3);
  assert.equal(redeemMail(loaded, XHS).ok, false);
});

test("corrupt claim receipts and missing v5 mail cannot become fresh reward opportunities", () => {
  const s = mailbox();
  s.rate = 10;
  readMail(s, WECHAT);
  redeemMail(s, WECHAT);
  for (const patch of [
    { claimedAt: undefined },
    { claimedAt: "0" },
    { claimedAt: -1 },
    { claimedRate: NaN },
    { claimedRate: Infinity },
    { reward: 999 },
    { readAt: null },
    { blocked: "false" },
  ]) {
    const broken = structuredClone(s);
    Object.assign(broken.mail.letters[WECHAT], patch);
    const loaded = restore(broken),
      before = loaded.money;
    loaded.rate = 1e9;
    assert.equal(readMail(loaded, WECHAT).first, false);
    assert.equal(redeemMail(loaded, WECHAT).ok, false);
    assert.equal(loaded.money, before);
    assert.equal(loaded.mail.letters[WECHAT].blocked, true);
    assert.equal(redeemMail(restore(loaded), WECHAT).ok, false);
  }
  for (const breakState of [
    (raw) => delete raw.mail,
    (raw) => delete raw.mail.letters[WECHAT],
    (raw) => (raw.mail = null),
  ]) {
    const broken = structuredClone(s);
    breakState(broken);
    const loaded = restore(broken);
    assert.equal(readMail(loaded, WECHAT).first, false);
    assert.equal(redeemMail(loaded, WECHAT).ok, false);
  }
});

test("group invitation reaches old saves once and pays the claim-time rate without reopening older rewards", () => {
  const old = mailbox();
  old.rate = 4;
  readMail(old, WECHAT);
  redeemMail(old, WECHAT);
  readMail(old, XHS);
  const previousLetters = structuredClone(old.mail.letters);
  delete old.mail.letters[GROUP];
  old.mail.catalogVersion = 1;
  for (const withoutCatalogVersion of [false, true]) {
    const fixture = structuredClone(old);
    if (withoutCatalogVersion) delete fixture.mail.catalogVersion;
    const loaded = restore(fixture);
    assert.equal(loaded.mail.catalogVersion, 2);
    assert.equal(loaded.mail.letters[GROUP].blocked, false);
    assert.equal(loaded.mail.letters[GROUP].readAt, null);
    for (const id of [WECHAT, XHS])
      assert.deepEqual(loaded.mail.letters[id], previousLetters[id]);
    loaded.rate = 3;
    const wallet = loaded.money;
    readMail(loaded, GROUP);
    assert.equal(loaded.money, wallet);
    assert.equal(loaded.mail.letters[GROUP].reward, null);
    const later = restore(loaded);
    later.rate = 12.5;
    assert.deepEqual(redeemMail(later, GROUP), { ok: true, value: 62.5 });
    assert.equal(later.money, wallet + 62.5);
    assert.equal(later.rate, 12.5);
    const reloaded = restore(later);
    reloaded.rate = 500;
    assert.equal(redeemMail(reloaded, GROUP).ok, false);
    assert.equal(reloaded.mail.letters[GROUP].reward, 62.5);
    assert.equal(redeemMail(reloaded, WECHAT).ok, false);
    assert.equal(deliverMail(reloaded, GROUP).ok, false);
  }
});

test("a later catalogue letter arrives once without reopening old receipts, and core tutorials wait for their prerequisite", () => {
  const s = mailbox();
  readMail(s, WECHAT);
  s.rate = 4;
  redeemMail(s, WECHAT);
  const next = {
    id: "future-core-guide",
    type: "tutorial",
    introducedVersion: 3,
    delivery: { requires: ["M5"] },
  };
  MAIL_CATALOG.push(next);
  try {
    const waiting = restore(s);
    assert.equal(waiting.mail.catalogVersion, 3);
    assert.equal(waiting.mail.letters[next.id], undefined);
    assert.equal(deliverMail(waiting, next.id).ok, false);
    waiting.counts.M5 = 1;
    assert.equal(deliverMail(waiting, next.id).ok, true);
    assert.equal(deliverMail(waiting, next.id).ok, false);
    assert.equal(redeemMail(waiting, WECHAT).ok, false);
    assert.equal(readMail(waiting, next.id).first, true);
    assert.equal(claimMail(waiting, next.id).ok, false);
    assert.equal(waiting.mail.letters[WECHAT].reward, 20);
    const alreadyUnlocked = structuredClone(s);
    alreadyUnlocked.counts.M5 = 1;
    const arrived = restore(alreadyUnlocked);
    assert.equal(arrived.mail.letters[next.id].readAt, null);
    assert.equal(arrived.mail.letters[next.id].blocked, false);
    assert.deepEqual(restore(arrived).mail, arrived.mail);
  } finally {
    MAIL_CATALOG.pop();
  }
});
