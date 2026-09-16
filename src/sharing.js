// Sharing is a free default capability. Keep the legacy save fields and API
// so imported worlds and older integrations do not lose their receipts.
export const SHARE_PRICE = 0;

export function freshSharing() {
  return { unlocked: true, unlockedAt: 0 };
}

export function restoreSharing(raw) {
  if (raw?.unlocked !== true) return freshSharing();
  return {
    unlocked: true,
    unlockedAt:
      Number.isFinite(raw.unlockedAt) && raw.unlockedAt >= 0
        ? raw.unlockedAt
        : 0,
  };
}

export const shareUnlocked = () => true;
export const shareAvailable = () => true;
export const shareRequirements = () => [];

export function unlockSharing(s) {
  s.sharing = restoreSharing(s.sharing);
  return { ok: true, cost: 0 };
}
