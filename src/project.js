// The engineering site is bought once; delivery, not repeat purchases, builds it.
export const PROJECT_TARGET = 180000;
export const REALM_PROJECT_TARGET = PROJECT_TARGET / 3;
export const PROJECT_WEIGHT = { overworld: 0.2, nether: 1, end: 3 };
export function restoreProjectProgress(raw) {
  const finite = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const oldTarget = finite(raw.projectGoal) || PROJECT_TARGET;
  const scale = PROJECT_TARGET / oldTarget;
  const hasRealms = Object.keys(PROJECT_WEIGHT).some((realm) =>
    Number.isFinite(raw.projectByRealm?.[realm]),
  );
  const complete = raw.completed && raw.counts?.Z3 > 0;
  return Object.fromEntries(
    Object.keys(PROJECT_WEIGHT).map((realm) => [
      realm,
      complete
        ? REALM_PROJECT_TARGET
        : Math.min(
            REALM_PROJECT_TARGET,
            (hasRealms
              ? finite(raw.projectByRealm?.[realm])
              : finite(raw.project) / 3) * scale,
          ),
    ]),
  );
}
export function projectProgress(s) {
  const realms = Object.fromEntries(
    Object.keys(PROJECT_WEIGHT).map((realm) => [
      realm,
      Math.max(
        0,
        Math.min(REALM_PROJECT_TARGET, Number(s.projectByRealm?.[realm]) || 0),
      ),
    ]),
  );
  const total = Object.values(realms).reduce((sum, value) => sum + value, 0);
  const finished = Math.min(3, Math.floor(total / REALM_PROJECT_TARGET));
  return {
    realms,
    total,
    finished,
    complete: finished === 3,
    layer: Math.min(3, finished + 1),
    layerProgress:
      finished === 3
        ? 1
        : (total % REALM_PROJECT_TARGET) / REALM_PROJECT_TARGET,
  };
}
