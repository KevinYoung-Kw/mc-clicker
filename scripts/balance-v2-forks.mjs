// Same-state duration probes. Productive setup uses the frozen real engine;
// only a research wrapper and an extra returned state are added to the harness.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { freshResearch, startResearch, advanceResearch, researchStatus, researchRequirements } from '../docs/v2.0.0/simulation/research-model.mjs';
const out = new URL('../docs/v2.0.0/simulation/', import.meta.url);
let source = readFileSync(new URL('baseline-engine.mjs', out), 'utf8');
const marker = 'return { profile: profile.id, seed, seconds, milestones, purchases, samples, summary: {';
if (!source.includes(marker)) throw new Error('Frozen harness signature changed');
source = source.replace(marker, 'return { state: s, profile: profile.id, seed, seconds, milestones, purchases, samples, summary: {');
source = source.replaceAll('import.meta.url', JSON.stringify(new URL('baseline-engine.mjs', out).href));
const { game, catalog, earlyProfiles, simulateEarly } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const original = simulateEarly(earlyProfiles.find(p => p.id === 'village'), { seconds: 1100, seed: 17 }).state;
original.research = freshResearch(); advanceResearch(original, 1);
let preparationWait = 0;
while (original.money < 18400 && preparationWait < 600) { game.advance(original, 1); preparationWait++; }
if (researchStatus(original, 'industrial').kind !== 'ready') throw new Error('Checkpoint lacks actual village prerequisites');
const target = catalog.ITEMS.M9;
if (game.n(original, 'M9') || game.requirements(original, target).length) throw new Error('Checkpoint target is not otherwise ready');
const canBuy = game.buy(structuredClone(original), 'M9');
if (!canBuy.ok) throw new Error('Checkpoint target cannot be placed: ' + canBuy.reason);
const checkpoint = JSON.parse(JSON.stringify(original));
writeFileSync(new URL('research-fork-checkpoint.json', out), JSON.stringify(checkpoint) + '\n');
const rows = [];
for (const duration of [0, 20, 40, 60]) {
  const s = structuredClone(checkpoint), events = [], opportunities = [], window = 180;
  const startingMoney = s.money, startingTotal = s.total, startingProduction = s.productionIncome;
  const started = startResearch(s, 'industrial'); if (!started.ok) throw new Error(started.reason);
  s.research.projects.industrial.duration = duration;
  if (!duration) advanceResearch(s, Number.EPSILON);
  let pureWait = 0, purchasedAt = null, previousOptions = new Set(), targetCost = 0;
  for (let t = 0; t < window; t++) {
    const allowed = catalog.CATALOG.filter(i => !['X','L','N','E','Z'].includes(i.family) && i.id !== 'V1' && game.n(s,i.id)<i.max && !game.requirements(s,i).length && !researchRequirements(s,i).length && s.money>=game.price(s,i));
    const optionIds = new Set(allowed.map(i => i.id));
    for (const id of optionIds) if (!previousOptions.has(id)) opportunities.push({ at: t, id });
    previousOptions = optionIds;
    if (purchasedAt === null && !researchRequirements(s,target).length) {
      targetCost = game.price(s,target); const bought = game.buy(s,target.id); if (!bought.ok) throw new Error(bought.reason);
      purchasedAt = t; events.push({ at: t, kind: 'purchase', id: target.id, cost: targetCost });
    }
    if (purchasedAt === null && s.money >= game.price(s,target) && !game.requirements(s,target).length && researchRequirements(s,target).length) pureWait++;
    game.advance(s, 1); const step = advanceResearch(s, 1);
    if (step.completed) events.push({ at: t + 1, kind: 'research-complete', id: step.completed });
  }
  rows.push({ duration, pureWaitSeconds: pureWait, targetBoughtAt: purchasedAt, otherAffordableUnlockEpisodes: opportunities.filter(x=>x.id!=='M9').length,
    operatingCashDelta: s.money - startingMoney, actualGrossIncome: s.total - startingTotal,
    productionLedgerDeltaIncludingBase: s.productionIncome-startingProduction,
    paidResearch: started.cost, paidTarget: targetCost, events, opportunities });
}
const report = { method: 'Frozen current engine, real village-policy setup through 1100s, then natural earning without purchases until both research and target can be afforded. Same state forked four ways. Only one drill purchase and automatic research differ; no researcher, life, welfare or cart is simulated. Affordable unlock episodes are shopping availability, not proven valuable decisions or fun.',
  checkpoint: { at: checkpoint.play, naturalSavingAfterPolicySeconds: preparationWait, money: checkpoint.money, sha256: createHash('sha256').update(JSON.stringify(checkpoint)).digest('hex') },
  researchSourceHash: createHash('sha256').update(readFileSync(new URL('../docs/v2.0.0/simulation/research-model.mjs',import.meta.url))).digest('hex'), windowSeconds:180, rows };
writeFileSync(new URL('research-duration-forks.json', out), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report, rows: rows.map(({events,opportunities,...row})=>row)},null,2));
