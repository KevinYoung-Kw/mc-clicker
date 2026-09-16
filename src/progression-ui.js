import { shareUnlocked } from "./sharing.js";
export const CUSTOMIZABLE = ["X3", "X4", "X5", "X6", "X8"];
export function hasCosmetics(s) {
  return CUSTOMIZABLE.some((id) => s.counts[id] > 0);
}
export function features(s) {
  const c = s.counts;
  const introduced=s.narrative?.companionsShown??true;
  return {
    world: true,
    build: true,
    expand: !!c.T1,
    village: !!c.V2,
    life: !!c.V2,
    network: !!(c.M1 || c.M4 || c.M5),
    live: !!c.L2,
    atlas: !!c.X1,
    sound: !!c.L1,
    settings: introduced,
    info: introduced&&!!s.guidance?.info,
    share: introduced&&shareUnlocked(s),
    realms: !!c.N1,
    home: !!c.V1,
    cosmetics: hasCosmetics(s),
  };
}
