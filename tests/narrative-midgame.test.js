import test from 'node:test';
import assert from 'node:assert/strict';
import { restore, advance, buy } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { NARRATION, IDLE_LINES, advanceNarrative, currentNarration } from '../src/narrative.js';
import { MIDGAME_NARRATION } from '../src/narrative-midgame.js';
import { MAIL_CATALOG } from '../src/mail-content.js';
import { claimMail, readMail } from '../src/mail.js';

const ids = [...NARRATION, ...IDLE_LINES].map(r => r.id);
function state(keep) {
  const s = fresh(); s.play = 1100; s.guidance.info = true; s.narrative.companionsShown = true;
  s.narrative.seen = ids.filter(id => !keep.includes(id)); return s;
}
function step(s, seconds, options = {}) {
  const starts = []; let last = '';
  for (let i = 0; i < seconds; i++) {
    s.play++; advanceNarrative(s, 1, options);
    const c = currentNarration(s); if (c && c.id !== last) starts.push({ id: c.id, at: s.play });
    last = c?.id || '';
  }
  return starts;
}
function shortage(s, fraction) {
  s.counts.M5 = 1; s.grid.learnedConnection = true;
  s.grid.last = { loads: [{ id: 'M9', enabled: true, rated: 12, actual: 12 * fraction, fraction }] };
}

test('sustained shortages speak once; brief load changes and disconnected devices do not', () => {
  const s = state(['power-shortage']); shortage(s, .5);
  assert.deepEqual(step(s, 8), []); shortage(s, 1); step(s, 1);
  shortage(s, .5); assert.deepEqual(step(s, 11), []);
  assert.equal(step(s, 3)[0]?.id, 'power-shortage');
  shortage(s, 1); step(s, 1); assert.equal(currentNarration(s), null);
  shortage(s, .2); assert.deepEqual(step(s, 90), []);
  const disconnected = state(['power-shortage']); shortage(disconnected, 0);
  disconnected.grid.last.loads[0].enabled = false; assert.deepEqual(step(disconnected, 30), []);
});

test('assigning an actuator or host cancels outdated advice, including during the first line', () => {
  for (const [id, counts, resolve] of [
    ['actuator-job', { M10: 1, M14: 1, V4: 1 }, s => s.grid.automation.farm = 1],
    ['studio-vacancy', { L2: 1, L4: 1, V2: 1 }, s => s.community.residents = [{ job: 'host', reserve: false }]],
  ]) {
    const s = state([id]); Object.assign(s.counts, counts);
    assert.equal(step(s, 17)[0]?.id, id); resolve(s); step(s, 1);
    assert.equal(currentNarration(s), null); assert.ok(s.narrative.seen.includes(id));
    const already = state([id]); Object.assign(already.counts, counts); resolve(already);
    assert.deepEqual(step(already, 40), []);
  }
  const automatic = state(['actuator-job']); Object.assign(automatic.counts, { M10: 1, M14: 1, M13: 1, V4: 1 });
  automatic.grid.last = { automation: { farm: 1 } };
  assert.deepEqual(step(automatic, 40), [], 'observer-assigned work is not idle equipment');
  automatic.grid.last.automation.farm = 0;
  assert.deepEqual(step(automatic, 40), [], 'an observer waiting for ripe crops does not need a first-assignment tutorial');
});

test('owned equipment is not confused with real work, delivery or heat recovery', () => {
  for (const [id, counts, evidence] of [
    ['drill-chain', { M9: 1 }, s => { s.grid.last = { perDevice: { M9: 1 } }; s.buffers.overworld.raw = 10; }],
    ['rail-cargo', { M16: 1 }, s => { s.grid.last = { perDevice: { M16: 1 } }; s.transport = { realms: { overworld: { delivery: 4 } } }; }],
    ['golem-delivery', { V15: 1 }, s => s.community.golems = [{ delivered: 2 }]],
    ['heat-recovery', { N4: 1 }, s => s.dimensions.recovered = 2],
  ]) {
    const s = state([id]); Object.assign(s.counts, counts); assert.deepEqual(step(s, 20), []);
    evidence(s); assert.equal(step(s, 8)[0]?.id, id);
  }
  const s = state(['farm-team']); s.counts.V4 = 1; s.grid.automation.farm = 1;
  s.community.residents = [{ job: 'farmer' }]; assert.deepEqual(step(s, 10), []);
  s.grid.last = { loads: [{ id: 'auto-farm', actual: 1 }] };
  assert.equal(step(s, 1)[0]?.id, 'farm-team');
  s.grid.last.loads[0].actual = 0; step(s, 1);
  assert.equal(currentNarration(s)?.id, 'farm-team', 'a completed harvest does not cut off a true observation');
  step(s, 20); assert.ok(s.narrative.history.some(r => r.id === 'farm-team'));
});

test('midgame help shares the two-per-minute budget and yields to purchases and placement', () => {
  const s = state(['actuator-job', 'studio-vacancy', 'golem-delivery']);
  Object.assign(s.counts, { M10: 1, M14: 1, V4: 1, L2: 1, L4: 1, V2: 1, V15: 1 });
  s.community.golems = [{ delivered: 4 }]; const money = s.money;
  assert.deepEqual(step(s, 20, { available: false }), []);
  const starts = step(s, 100); assert.equal(starts.length, 3);
  for (const r of starts) assert.ok(starts.filter(x => x.at > r.at - 60 && x.at <= r.at).length <= 2);
  assert.equal(s.money, money); assert.equal(s.total, 0);
});

test('midgame does not dump old unlocks after migration; unfinished jobs still get help', () => {
  const s = state(MIDGAME_NARRATION.map(r => r.id)); s.narrative.cadenceVersion = 4;
  Object.assign(s.counts, { M9: 1, M16: 1, M10: 1, M14: 1, V4: 1 });
  const loaded = restore(s); assert.equal(loaded.narrative.cadenceVersion, 6);
  for (const id of ['drill-chain', 'rail-cargo']) assert.ok(loaded.narrative.seen.includes(id));
  assert.ok(!loaded.narrative.seen.includes('actuator-job'));
  assert.equal(step(loaded, 14)[0]?.id, 'actuator-job');
  const resumed = restore(loaded); assert.equal(resumed.narrative.current.id, 'actuator-job');
  assert.equal(resumed.narrative.current.index, loaded.narrative.current.index);
  step(resumed, 30); const again = restore(resumed);
  assert.ok(again.narrative.seen.includes('actuator-job')); assert.deepEqual(step(again, 60), []);
});

test('realm commentary waits for the right view and project help stops when complete', () => {
  const s = state(['nether-work']); Object.assign(s.counts, { N1: 1, N2: 1 }); s.dimensions.heatMade = 10;
  assert.deepEqual(step(s, 40, { context: { realm: () => 'overworld' } }), []);
  assert.equal(step(s, 8, { context: { realm: () => 'nether' } })[0]?.id, 'nether-work');
  step(s, 1, { context: { realm: () => 'overworld' } }); assert.equal(currentNarration(s), null);
  const p = state(['project-delivery']); p.counts.Z2 = 1; p.project = 1;
  assert.equal(step(p, 20)[0]?.id, 'project-delivery'); p.completed = true;
  step(p, 1); assert.equal(currentNarration(p), null);
});

test('quiet comments wait three minutes, require the scene, and respect mute', () => {
  const s = state(['idle-factory']); s.counts.M9 = 1;
  assert.deepEqual(step(s, 181, { context: { runningMachine: () => false } }), []);
  assert.equal(step(s, 1, { context: { runningMachine: () => true } })[0]?.id, 'idle-factory');
  const muted = state(MIDGAME_NARRATION.map(r => r.id)); muted.guidance.notices = false;
  Object.assign(muted.counts, { M10: 1, M14: 1, V4: 1 }); assert.deepEqual(step(muted, 60), []);
});

test('postal income and three reward letters survive; tutorial cancellation cannot reissue rewards', () => {
  const s = fresh(); s.money = 1000;
  for (const id of ['T1', 'V1', 'V18']) assert.ok(buy(s, id).ok);
  advance(s, 2); const before = s.money; advance(s, 10); assert.equal(s.money - before, 10);
  assert.equal(MAIL_CATALOG.length, 3); assert.ok(MAIL_CATALOG.every(m => m.type === 'activity'));
  const id = MAIL_CATALOG[0].id; readMail(s, id); s.rate = 7;
  const claimed = claimMail(s, id); assert.ok(claimed.ok); assert.equal(claimed.value, 35);
  s.narrative.cadenceVersion = 4; const loaded = restore(s);
  assert.equal(loaded.money, s.money); assert.equal(loaded.mail.postalLevel, s.mail.postalLevel);
  assert.equal(claimMail(loaded, id).ok, false);
  assert.deepEqual(loaded.mail.letters, s.mail.letters);
});
