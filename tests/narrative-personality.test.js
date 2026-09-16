import test from 'node:test';
import assert from 'node:assert/strict';
import { restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { NARRATION, IDLE_LINES, advanceNarrative, currentNarration, chooseNarratorOffer } from '../src/narrative.js';
import { recentDecoration, decorationCopy, narratorOffer } from '../src/narrative-personality.js';
import { recordNarrativeAction } from '../src/narrative-behavior.js';
import { buyWeb, equipWeb, resetWeb } from '../src/presentation.js';
import { buyUpgrade, upgradeLevel } from '../src/upgrades.js';
import { advanceEasterEggs, offeredEgg } from '../src/easter-eggs.js';

function state(keep) {
  const s = fresh(); s.play = 1000; s.money = 100000; s.counts.X2 = 3;
  s.guidance.info = true; s.narrative.companionsShown = true;
  s.narrative.seen = [...NARRATION, ...IDLE_LINES].map(r => r.id).filter(id => !keep.includes(id));
  return s;
}
function step(s, n, options = {}) {
  const starts = []; let previous = s.narrative.current?.id;
  for (let i = 0; i < n; i++) {
    s.play++; advanceNarrative(s, 1, options);
    const id = s.narrative.current?.id;
    if (id && id !== previous) starts.push(id);
    previous = id;
  }
  return starts;
}
function purchase(s, id) {
  const result = buyWeb(s, id);
  if (result.ok) recordNarrativeAction(s, 'purchase', { id });
  return result;
}
function clothes() {
  const s = state(['suggest-notice']);
  s.narrative.lastCosmeticAt = 800;
  return s;
}
function cooling() {
  const s = state(['suggest-cooling']);
  Object.assign(s.counts, { M9: 2, M7: 1 }); s.grid.last = { perDevice: { M9: 10 } };
  return s;
}

test('only successful recent decoration purchases are comments, not ownership, equipping or failed checkout', () => {
  const s = state(['decoration:title']);
  s.webAppearance.owned['web-title-oak'] = true;
  equipWeb(s, 'web-title-oak'); assert.equal(recentDecoration(s), null);
  assert.deepEqual(step(s, 10), []);
  assert.equal(purchase(s, 'web-title-oak').ok, false);
  assert.equal(recentDecoration(s), null);
  assert.ok(purchase(s, 'web-title-first-block').ok);
  assert.deepEqual(step(s, 4), ['decoration:title']);
  assert.equal(s.narrative.current.target.id, 'web-title-first-block');
  assert.equal(currentNarration(s).expressionId, 'decor-title');
});

test('rapid purchases use the latest equipped item and stop when that item is removed', () => {
  const s = state(['decoration:title', 'decoration:theme']);
  purchase(s, 'web-title-oak'); s.play++; purchase(s, 'web-theme-redstone');
  // This theme costs more than the fixture wallet; failure cannot supersede a real purchase.
  assert.equal(recentDecoration(s).id, 'web-title-oak');
  s.money = 500000; purchase(s, 'web-theme-redstone');
  assert.equal(decorationCopy(s), 'decor-theme-redstone');
  assert.deepEqual(step(s, 4), ['decoration:theme']);
  resetWeb(s, 'theme'); step(s, 1);
  assert.equal(currentNarration(s), null);
  assert.deepEqual(step(s, 70), [], 'older purchases cannot be replayed after removing the latest');
});

test('category-once, two-minute spacing and expiry survive reload without a purchase backlog', () => {
  let s = state(['decoration:title', 'decoration:notice']);
  purchase(s, 'web-title-oak'); step(s, 15);
  assert.ok(s.narrative.seen.includes('decoration:title'));
  purchase(s, 'web-notice-paper'); assert.deepEqual(step(s, 50), []);
  s = restore(s);
  assert.ok(s.narrative.lastCosmeticAt > 0);
  assert.deepEqual(step(s, 120), [], 'expired shopping observations stay quiet');
  purchase(s, 'web-notice-stone'); assert.deepEqual(step(s, 5), ['decoration:notice']);
  step(s, 15); s = restore(s);
  purchase(s, 'web-title-birch'); assert.deepEqual(step(s, 130), []);
});

test('muting consumes eligible decoration observations; imported clothes do not cause a replay', () => {
  const s = state(['decoration:title']); s.guidance.notices = false;
  purchase(s, 'web-title-oak'); step(s, 1); s.guidance.notices = true;
  assert.deepEqual(step(s, 20), []);
  const loaded = restore(s); assert.deepEqual(step(loaded, 20), []);
});

test('optional asks wait for midgame, a quiet gap, previous shopping and surplus money', () => {
  const s = clothes(); s.play = 600; s.narrative.lastCosmeticAt = 400;
  assert.deepEqual(step(s, 50), []);
  s.play = 800; s.money = 639;
  assert.deepEqual(step(s, 60), []);
  s.money = 640; s.narrative.quiet = 0;
  assert.deepEqual(step(s, 44), []);
  assert.deepEqual(step(s, 1), ['suggest-notice']);
  assert.equal(s.money, 640); assert.equal(narratorOffer(s, 'suggest-notice').cost, 160);
  // Money spent elsewhere need not make a still-affordable visible choice disappear.
  s.money = 160; step(s, 1); assert.equal(currentNarration(s)?.id, 'suggest-notice');
  s.money = 159; step(s, 1); assert.equal(currentNarration(s), null);
  const alreadyDressed = clothes(); purchase(alreadyDressed, 'web-notice-stone');
  assert.deepEqual(step(alreadyDressed, 60), []);
});

test('accepting names the existing checkout without charging; declining, ignoring and double-clicking cannot charge', () => {
  for (const accept of [true, false]) {
    const s = clothes(); step(s, 45); const before = s.money;
    const result = chooseNarratorOffer(s, 'suggest-notice', accept);
    assert.equal(result.ok, true); assert.equal(s.money, before);
    assert.equal(result.purchase?.id ?? null, accept ? 'web-notice-paper' : null);
    assert.equal(chooseNarratorOffer(s, 'suggest-notice', true).ok, false);
    assert.deepEqual(step(s, 70), []);
    if (accept) {
      assert.ok(buyWeb(s, result.purchase.id).ok); assert.equal(s.money, before - 160);
      assert.equal(buyWeb(s, result.purchase.id).ok, false); assert.equal(s.money, before - 160);
    }
  }
  const ignored = clothes(); const before = ignored.money; step(ignored, 75);
  assert.equal(ignored.money, before); assert.ok(ignored.narrative.seen.includes('suggest-notice'));
  assert.deepEqual(step(restore(ignored), 120), []);
});

test('cooling suggestion checks real equipment and prerequisites; work-cycle pauses do not remove its buttons', () => {
  const locked = cooling(); locked.counts.M9 = 1;
  assert.equal(narratorOffer(locked, 'suggest-cooling'), null); assert.deepEqual(step(locked, 60), []);
  const idle = cooling(); idle.grid.last.perDevice.M9 = 0;
  assert.deepEqual(step(idle, 60), []);
  const s = cooling(); step(s, 45); assert.equal(currentNarration(s)?.id, 'suggest-cooling');
  s.grid.last.perDevice.M9 = 0; step(s, 1); assert.equal(currentNarration(s)?.id, 'suggest-cooling');
  const before = s.money, result = chooseNarratorOffer(s, 'suggest-cooling', true);
  assert.equal(result.purchase.cost, 12000); assert.equal(s.money, before);
  assert.ok(buyUpgrade(s, result.purchase.id).ok);
  assert.equal(upgradeLevel(s, 'drill-cooling'), 1); assert.equal(s.money, before - 12000);
  assert.equal(narratorOffer(s, 'suggest-cooling'), null);
});

test('stale, muted, background and menu choices cannot bypass checkout or interrupt other work', () => {
  const s = clothes(); step(s, 45); purchase(s, 'web-notice-paper');
  assert.equal(chooseNarratorOffer(s, 'suggest-notice', true).ok, false);
  step(s, 1); assert.equal(currentNarration(s), null);
  const paused = clothes(); assert.deepEqual(step(paused, 60, { available: false }), []);
  const menu = clothes(); assert.deepEqual(step(menu, 60, { context: { surface: () => 'shop' } }), []);
  const room = clothes(); assert.deepEqual(step(room, 60, { context: { surface: () => 'world', realm: () => 'studio' } }), []);
  const muted = clothes(); step(muted, 45); muted.guidance.notices = false;
  assert.equal(chooseNarratorOffer(muted, 'suggest-notice', true).ok, false);
});

test('suggestions share breathing room with eggs and are at least six minutes apart', () => {
  const s = cooling(); s.narrative.lastSuggestionAt = s.play;
  assert.deepEqual(step(s, 359), []);
  assert.deepEqual(step(s, 1), ['suggest-cooling']);
  const eggRecent = clothes(); eggRecent.easterEggs.lastOfferAt = eggRecent.play;
  assert.deepEqual(step(eggRecent, 239), []);
  assert.deepEqual(step(eggRecent, 14), ['suggest-notice']);
  const egg = state([]); egg.play = 2000; egg.counts.M5 = 1; egg.counts.M16 = 1;
  egg.narrative.lastSuggestionAt = egg.play;
  advanceEasterEggs(egg, 1, { quiet: true }); assert.equal(offeredEgg(egg), null);
});
