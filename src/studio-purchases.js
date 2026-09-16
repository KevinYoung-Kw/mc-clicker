import { buy } from "./game.js";
import { buyExtra, equipExtra, COLLECTION_BY_ID } from "./collection.js";
import {
  entityForPurchase,
  ensureStudio,
  placeStudio,
} from "./studio-placement.js";

// A placement and its payment commit together. Rejected previews never change
// the live state, even if a purchase would emit events or unlock another item.
export function confirmStudioPurchase(
  s,
  id,
  site,
  { extra = false, equip = false } = {},
) {
  const draft = structuredClone(s);
  const key = extra ? COLLECTION_BY_ID[id]?.slot : entityForPurchase(draft, id);
  if (!key) return { ok: false, reason: "这件物品没有室内位置" };
  const result = extra
    ? equip
      ? { ok: equipExtra(draft, id), cost: 0, first: false }
      : buyExtra(draft, id)
    : buy(draft, id);
  if (!result.ok) return result;
  ensureStudio(draft);
  const placed = placeStudio(draft, key, site);
  if (!placed.ok) return placed;
  Object.assign(s, draft);
  return { ...result, key };
}
