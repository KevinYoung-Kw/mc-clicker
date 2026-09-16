// Persistence projection 1 is frozen for schema 7; schemas 8–9 preserve new root fields. Only fields ignored by restore() are
// omitted. This is a denylist: unknown fields and historical snapshots survive.
// Keep this version frozen; a future loader must keep accepting its output.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const omit = (value, fields) => { if (object(value)) for (const key of fields.split(' ')) delete value[key]; };
const each = (value, fn) => { if (Array.isArray(value)) value.forEach(fn); };
const movement = 'path destination cargo status activity studioEntry wanderAt wanderCount workSpot parkingRevision yielding yieldSpot yieldUntil blockedFor trafficWait workplaceId workTour workMoveAt workRound routeRevision yieldStep';

export function persistentSave(raw) {
  const s = structuredClone(raw);
  if (![7,8,9,10].includes(s.version)) return s; // Older schemas retain their original migrations.
  omit(s, 'commandPlan rhythm burst charge combo lastClick rate productionRate projectGoal projectFlow layoutRevision transport orderClock');
  omit(s.grid, 'last crank revision');
  omit(s.community, 'revision lastIncome navigationRevision');
  each(s.community?.residents, r => { omit(r, movement); omit(r, 'look'); });
  each(s.community?.golems, g => { omit(g, movement); omit(g, 'progress visits wait lastDelivery'); });
  each(s.community?.batches, b => omit(b, 'claimed'));
  if (object(s.community?.tasks)) for (const t of Object.values(s.community.tasks)) omit(t, 'manual');
  omit(s.dimensions, 'last');
  if (object(s.dimensions?.trips)) for (const t of Object.values(s.dimensions.trips))
    omit(t, 'from to source target period capacity flight');
  omit(s.live, 'camera rainCooldown host hostHeat respondCooldown clock giftClock');
  omit(s.upgrades, 'revision');
  omit(s.garden, 'revision');
  omit(s.housing, 'revision');
  omit(s.marketLedger, 'nextId');
  each(s.marketLedger?.receipts, r => omit(r, 'id bucket'));
  // victory.snapshot is consumed directly by the renderer, NOT by restore().
  // Retain its original data (including lighting/poses) and original release.
  return s;
}
