import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { ITEMS } from '../src/catalog.js';
import { assignJob } from '../src/residents.js';
import { NARRATION, IDLE_LINES, advanceNarrative, currentNarration, narrationLines, notePurchaseConfirmation } from '../src/narrative.js';

const ids = [...NARRATION, ...IDLE_LINES].map(r => r.id);
function focus(s, keep) {
  s.guidance.info = true; s.narrative.companionsShown = true;
  s.narrative.seen = ids.filter(id => !keep.includes(id));
}
function purchase(s, id) { assert.ok(buy(s, id).ok, `valid purchase: ${id}`); }
function tick(s, seconds, options = {}) {
  const lines = []; let previous = '';
  for (let i = 0; i < seconds * 5; i++) {
    s.play += .2; advanceNarrative(s, .2, options);
    const c = currentNarration(s), key = c ? `${c.id}:${c.index}` : '';
    if (c && key !== previous) lines.push(c);
    previous = key;
  }
  return lines;
}
function base(keep) {
  const s = fresh(); s.money = 1e9; s.research.completed["basic-power"]=true; focus(s, keep);
  for (const id of ['T1', 'V1', 'V18', 'T7']) purchase(s, id);
  for (let i = 0; i < 3; i++) purchase(s, 'V1'); // physical room for each valid branch
  return s;
}
// Enumerate actual catalog dependencies, not a recommended shopping sequence.
function orders(remaining, owned, path = []) {
  if (!remaining.length) return [path];
  return remaining.filter(id => ITEMS[id].deps.every(dep => owned.has(dep))).flatMap(id =>
    orders(remaining.filter(next => next !== id), new Set([...owned, id]), [...path, id]));
}

test('all legal box, mining and power purchase orders teach the same independent mechanics', () => {
  const paths = orders(['T2', 'M1', 'M4', 'M5'], new Set(['T1', 'V1', 'V18', 'T7']));
  assert.equal(paths.length, 12);
  assert.ok(paths.some(p => p.indexOf('M4') < p.indexOf('M1')));
  assert.ok(paths.some(p => p.indexOf('M4') > p.indexOf('M1')));
  for (const path of paths) {
    let s = base(['haul-use', 'power-use']);
    for (const [index, id] of path.entries()) {
      purchase(s, id);
      tick(s, 3, { available: false }); // purchase receipts/menu, no heard dialogue
      if (index === 1) s = restore(s);
    }
    const before = s.money, lines = tick(s, 50);
    assert.deepEqual(lines.filter(l => l.id === 'haul-use').map(l => l.index), [0, 1], path.join(' → '));
    assert.deepEqual(lines.filter(l => l.id === 'power-use').map(l => l.index), [0, 1]);
    const haul = lines.filter(l => l.id === 'haul-use').map(l => l.text);
    assert.match(haul[0], /储物箱/); assert.match(haul[1], /工业 → 物流/);
    assert.ok(haul.every(text => !/总算|这边的货|刚买|刚才/.test(text)));
    assert.equal(s.money, before, 'teaching cannot change production or income');
    assert.deepEqual(tick(restore(s), 210), [], 'no replay after reload or delayed backfill');
  }
});

test('box bought well before mining can explain storage without pretending it was just built', () => {
  let s = base(['haul-use']); purchase(s, 'M4');
  assert.deepEqual(tick(s, 240), [], 'a box alone does not assume a production source');
  s = restore(s); purchase(s, 'T2'); purchase(s, 'M1');
  const lines = tick(s, 20);
  assert.equal(lines.length, 2); assert.equal(lines[0].id, 'haul-use');
  assert.match(lines[0].text, /^储物箱能多存些货/);
});

test('already assigned hauling cancels queued logistics advice, even when mining comes later', () => {
  const s = base(['haul-use']); purchase(s, 'M4'); purchase(s, 'V2');
  assert.ok(assignJob(s, s.community.residents[0].id, 'hauler').ok);
  purchase(s, 'T2'); purchase(s, 'M1');
  assert.deepEqual(tick(restore(s), 35), []);
});

test('mail callback requires the actual prerequisite and the complete earlier sentence, not a skipped ID', () => {
  assert.ok(ITEMS.V18.deps.includes('V1'), 'callback must be reviewed if the purchase dependency changes');
  const s = base(['mail']);
  assert.ok(s.narrative.seen.includes('land'));
  const fallback = narrationLines(s, 'mail');
  assert.ok(!fallback.join('').includes('刚才'));
  s.narrative.history.push({ id: 'land', text: '先安个邮箱' });
  assert.deepEqual(narrationLines(s, 'mail'), fallback, 'a partial line does not support the joke');
  s.narrative.history = [{ id: 'land', text: narrationLines(s, 'land').join(' ') }];
  assert.match(narrationLines(restore(s), 'mail')[0], /邮箱.*刚才随口说的/);
  delete s.counts.V1;
  assert.deepEqual(narrationLines(s, 'mail'), fallback, 'history alone cannot replace a purchase prerequisite');
});

test('free friends are explained briefly even if the player already freed goal tracking', () => {
  const s = fresh(); s.guidance.info = true; s.guidance.goals = true;
  const lines = tick(s, 25), intro = lines.filter(l => l.id === 'companions');
  assert.equal(intro.length, 1, 'keep a single caption before the existing fly-in');
  assert.match(intro[0].text, /设置.*声音.*分享.*链接.*纪念卡/);
  assert.ok(!lines.some(l => l.id === 'friend'), 'do not call a bought friend captive');
  assert.ok(s.narrative.companionsShown);
  assert.ok(tick(restore(s), 25).every(l => l.id !== 'companions'));
});

test('camera tip waits for eight real buildings and a quiet gap, without an arbitrary fifteen-minute cutoff', () => {
  const s = base(['camera-controls']);
  for (const id of ['M4', 'T2', 'M1', 'M2', 'V2', 'V3', 'V4']) purchase(s, id);
  assert.equal(Object.keys(s.placements).filter(id => ITEMS[id]?.place).length, 7);
  purchase(s, 'V1'); purchase(s, 'M4'); // expansion and upgrading a building do not add a new building
  assert.deepEqual(tick(s, 30), [], 'land, tools and residents do not count as buildings');
  s.play = 950; purchase(s, 'M5'); // slow players can still receive the camera tip
  assert.equal(Object.keys(s.placements).filter(id => ITEMS[id]?.place).length, 8);
  tick(s, 2, { available: false });
  assert.deepEqual(tick(s, 11), []);
  assert.equal(tick(s, 2)[0]?.id, 'camera-controls');
  tick(s, 20);
  assert.ok(tick(restore(s), 30).every(line => line.id !== 'camera-controls'));
});

test('confirmation hint waits for ten paid confirmations, follows core help and respects opting out', () => {
  const s = base(['confirmations', 'haul-use']); purchase(s, 'M4'); purchase(s, 'T2'); purchase(s, 'M1');
  for (let i = 0; i < 9; i++) notePurchaseConfirmation(s, { manual: true, paid: 10 });
  assert.ok(!NARRATION.find(r => r.id === 'confirmations').when(s));
  notePurchaseConfirmation(s, { manual: true, paid: 10 });
  const lines = tick(s, 50);
  assert.equal(lines[0].id, 'haul-use');
  assert.ok(lines.some(line => line.id === 'confirmations'));
  // Check the gap itself using the existing simulation clock, not UI timers.
  const waiting = base(['confirmations']); waiting.narrative.confirmations = 10;
  tick(waiting, 2, { available: false });
  assert.deepEqual(tick(waiting, 11), []);
  assert.equal(tick(waiting, 2)[0]?.id, 'confirmations');
  waiting.skipPurchaseConfirmation = true;
  assert.deepEqual(tick(restore(waiting), 30), []);
});

test('a queued camera hint from the old building threshold waits without expiring before eight buildings', () => {
  let s = base(['camera-controls']);
  for (const id of ['M4', 'T2', 'M1']) purchase(s, id);
  s.narrative.eligibleAt['camera-controls'] = 1; // saved under the previous four-building condition
  s.play = 140;
  s = restore(s);
  assert.deepEqual(tick(s, 140), []);
  assert.ok(!s.narrative.seen.includes('camera-controls'), 'waiting is not the same as already heard');
  for (const id of ['M2', 'V2', 'V3', 'V4', 'M5']) purchase(s, id);
  tick(s, 1, { available: false });
  assert.deepEqual(tick(s, 11), []);
  assert.equal(tick(s, 2)[0]?.id, 'camera-controls');
});
