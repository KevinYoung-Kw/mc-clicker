import test from "node:test";
import assert from "node:assert/strict";
import { fresh } from "../src/game.js";
import { features, hasCosmetics } from "../src/progression-ui.js";
import { unlockSharing } from "../src/sharing.js";

test("new world exposes construction, then grows controls with purchased abilities", () => {
  const s = fresh();
  assert.deepEqual(
    Object.keys(features(s)).filter((k) => features(s)[k]),
    ["world", "build"],
  );
  s.counts.T1 = 1;
  s.counts.X1 = 1;
  assert.ok(features(s).expand && features(s).atlas);
  assert.equal(features(s).share, false);
  s.narrative.companionsShown=true;
  assert.equal(features(s).settings, true);
  assert.equal(features(s).share, true);
  s.counts.V3 = 1;
  s.money = 1200;
  assert.equal(unlockSharing(s).ok, true);
  assert.equal(features(s).share, true);
  assert.equal(features(s).live, false);
  s.counts.L2 = 1;
  s.counts.M5 = 1;
  s.counts.N1 = 1;
  assert.ok(features(s).live && features(s).network && features(s).realms);
});
test("a decor stall or garden does not reveal unpurchased customization settings", () => {
  const s = fresh();
  s.counts.X2 = 1;
  s.counts.X7 = 1;
  assert.equal(hasCosmetics(s), false);
  s.counts.X3 = 1;
  assert.equal(hasCosmetics(s), true);
  delete s.counts.X3;
  assert.equal(hasCosmetics(s), false);
  s.counts.X5 = 1;
  assert.equal(hasCosmetics(s), true);
});
