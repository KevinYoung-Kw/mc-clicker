import { firstPurchasePending } from './first-steps.js';
import { GUIDANCE_ITEMS, guidanceOwned, priorityInterface } from './guidance.js';
// A small storefront until the first resident. The full catalog is always one
// click away; this presentation never adds a dependency or changes a price.
export function openingShop(s) {
  if (s.narrative?.legacy || s.counts.V2) return null;
  if (firstPurchasePending(s)) return {captive:!['pending','returning'].includes(s.narrative?.openingChoice), features:['info']};
  const feature = !guidanceOwned(s,'info')?GUIDANCE_ITEMS.find(i=>i.id==='info'):priorityInterface(s);
  return {captive:false, features:feature?[feature.id]:[]};
}
