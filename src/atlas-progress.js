import { CATALOG } from './catalog.js';
import { WEB_ITEMS } from './web-catalog.js';
import { COLLECTION } from './collection.js';
import { ENV_MODULES } from './environment.js';
import { ownershipState } from './facility-storage.js';

// These legacy catalogue entries are category entrances, no longer purchases.
// Derive completion without changing counts (which also drive game rules).
const webGroups = { X3: 'title', X4: 'icon', X5: 'cursor' };
export function atlasProgress(state, id) {
  const s = ownershipState(state);
  let items, owned;
  if (webGroups[id]) {
    items = WEB_ITEMS.filter(i => i.category === webGroups[id]);
    owned = s.webAppearance?.owned;
  } else if (id === 'X6') {
    items = COLLECTION.filter(i => i.slot === 'flag');
    owned = s.scenery?.owned;
  } else if (id === 'X8') {
    items = ENV_MODULES;
    owned = s.environment?.modules;
  }
  if (!items) return { group: false, complete: (s.counts[id] || 0) > 0 };
  const collected = items.filter(i => owned?.[i.id] === true).length;
  return {
    group: true, collected, total: items.length,
    // A previously purchased whole pack remains credited after upgrades.
    complete: (s.counts[id] || 0) > 0 || collected === items.length,
  };
}
export const atlasCount = s => CATALOG.filter(i => atlasProgress(s, i.id).complete).length;
