import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore } from '../src/game.js';
import { ensureCommunity, assignJob, residentBase } from '../src/residents.js';
import { residentJobChoices, workplaceAssignment } from '../src/resident-jobs-ui.js';

function village() {
  const s = fresh();
  Object.assign(s.counts, { V2: 3, V4: 1, V3: 1, L1: 1 });
  ensureCommunity(s);
  return s;
}
test('workplace and free/full slots match real assignment, including the current worker', () => {
  const s = village(), [a, b] = s.community.residents, base = residentBase(s, a);
  assert.ok(assignJob(s, a.id, 'farmer').ok);
  assert.equal(residentBase(s, a), base);
  assert.equal(residentJobChoices(s, a).find(j => j.id === 'farmer').disabled, false);
  assert.equal(residentJobChoices(s, b).find(j => j.id === 'farmer').disabled, true);
  assert.equal(assignJob(s, b.id, 'farmer').ok, false);
  s.counts.V4 = 3; s.life.sites.push({id:"civic:1",type:"V4",x:5,z:0,rotation:0});
  assert.equal(residentJobChoices(s, b).find(j => j.id === 'farmer').disabled, false);
  assert.ok(assignJob(s, b.id, 'farmer').ok);
  assert.equal(residentJobChoices(s, b).find(j => j.id === 'farmer').place, '农田');
});
test('delivery temporarily blocks other choices, not the current job, and releases after unloading', () => {
  const s = village(), a = s.community.residents[0];
  assignJob(s, a.id, 'hauler'); a.cargo = { id: 'test-cargo', qty: 1 };
  for (const choice of residentJobChoices(s, a)) assert.equal(choice.disabled, choice.id !== 'hauler');
  assert.equal(assignJob(s, a.id, 'idle').ok, false);
  a.cargo = null;
  assert.equal(residentJobChoices(s, a).find(j => j.id === 'idle').disabled, false);
  assert.ok(assignJob(s, a.id, 'idle').ok);
});
test('job destinations follow actual facilities and survive restoring a save', () => {
  const s = village(), a = s.community.residents[0];
  assert.equal(residentJobChoices(s, a).find(j => j.id === 'hauler').place, '集市与生产点');
  assert.equal(residentJobChoices(s, a).some(j => j.id === 'host'), false);
  Object.assign(s.counts, { M4: 1, L2: 1, L4: 1 });
  assignJob(s, a.id, 'host');
  const saved = restore(JSON.parse(JSON.stringify(s))), choices = residentJobChoices(saved, saved.community.residents[0]);
  assert.equal(choices.find(j => j.id === 'host').selected, true);
  assert.equal(choices.find(j => j.id === 'musician').place, '直播间 · 唱片机');
  assert.equal(choices.find(j => j.id === 'hauler').place, '储物箱与生产点');
});

test('workplace candidates exclude current staff and couriers, then return after delivery', () => {
  const s = village(), [a, b, c] = s.community.residents;
  s.counts.V4 = 3; s.life.sites.push({id:"civic:1",type:"V4",x:5,z:0,rotation:0});
  assignJob(s, a.id, 'farmer');
  b.cargo = { id: 'in-flight', qty: 8 };
  c.cargo = { id: 'another-delivery', qty: 4 };
  let view = workplaceAssignment(s, 'farmer');
  assert.equal(view.full, false);
  assert.deepEqual(view.candidates, []);
  assert.match(view.emptyReason, /交货/);
  assert.equal(assignJob(s, b.id, 'farmer').ok, false);
  b.cargo = null;
  view = workplaceAssignment(s, 'farmer');
  assert.deepEqual(view.candidates.map(r => r.id), [b.id]);
  assert.equal(assignJob(s, b.id, 'farmer').ok, true);
  assert.equal(workplaceAssignment(s, 'farmer').full, true);
  assert.deepEqual(workplaceAssignment(s, 'farmer').candidates, []);
});

test('old-save reservists do not appear in the workplace picker', () => {
  const s = village();
  s.counts.V2 = 45;
  ensureCommunity(s);
  const view = workplaceAssignment(s, 'farmer');
  assert.equal(view.candidates.length, 24);
  assert.ok(view.candidates.every(r => !r.reserve));
  assert.equal(s.community.residents.length, 45);
});

test('idle villagers come before transfers; clicking a candidate uses the real assignment and preserves B', () => {
  const s = village(), [a, b, c] = s.community.residents;
  assignJob(s, a.id, 'hauler');
  a.skills.farming = 5;
  c.skills.farming = 3;
  const candidates = workplaceAssignment(s, 'farmer').candidates;
  assert.deepEqual(candidates.map(r => r.id), [c.id, b.id, a.id]);
  const base = residentBase(s, a), money = s.money;
  assert.equal(assignJob(s, a.id, 'farmer').ok, true);
  assert.equal(residentBase(s, a), base);
  assert.equal(s.money, money);
  assert.equal(s.community.residents.filter(r => r.job === 'hauler').length, 0);
  assert.equal(s.community.residents.filter(r => r.job === 'farmer').length, 1);
  assert.deepEqual(workplaceAssignment(s, 'host').candidates, []);
});
