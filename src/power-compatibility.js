// Pre-alpha.3 generation migration.
// Frozen pre-calibration generation formula; do not update with future balancing.
export const POWER_BALANCE_REVISION = 1;
const CHANGED_SOURCES = ['M6', 'M15'];
const integer = (value, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
export function legacyPurchasedGeneration(s, id) {
  const count = integer(s.counts?.[id], 12);
  const scaled = count * (count >= 10 ? 1.8 : count >= 5 ? 1.25 : 1);
  if (id === 'M15') return scaled * 180;
  if (id !== 'M6') return 0;
  const levels=s.upgrades?.levels || {};
  return scaled * 6 * 1.6 ** integer(levels['torch-bank'],3)
    * 1.2 ** integer(levels['torch-core'],1) * 1.6 ** integer(levels['torch-module'],1);
}
export function restorePowerCompensation(s, raw, currentPurchasedGeneration) {
  const credits = {};
  const revision = raw.grid?.powerBalanceRevision;
  for (const id of CHANGED_SOURCES) {
    if (!s.counts?.[id]) continue;
    let value = 0;
    if (revision === POWER_BALANCE_REVISION) value=raw.grid?.powerCompensation?.[id];
    else if (revision === undefined && Number.isInteger(raw.version) && raw.version>=2 && raw.version<=9)
      value=Math.max(0, legacyPurchasedGeneration(s,id)-currentPurchasedGeneration(s,id));
    if(Number.isFinite(value)&&value>0) credits[id]=Math.min(value,legacyPurchasedGeneration(s,id));
  }
  s.grid.powerBalanceRevision=POWER_BALANCE_REVISION;
  s.grid.powerCompensation=credits;
  return credits;
}
export function powerCompensation(s, id) {
  const value=s.grid?.powerCompensation?.[id];
  return CHANGED_SOURCES.includes(id)&&s.counts?.[id]>0&&Number.isFinite(value) ? Math.max(0,value) : 0;
}
