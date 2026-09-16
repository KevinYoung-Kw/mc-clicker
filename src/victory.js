import { RELEASE_NAME } from "./release.js";

function withoutRecord(s) {
  const { victory, ...world } = s;
  return structuredClone(world);
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
export function captureFirstVictory(s) {
  if (!s.completed || !s.counts.Z3 || s.victory) return false;
  s.victory = freeze({
    version: 1,
    release: RELEASE_NAME,
    capturedAt: s.completedAt,
    snapshot: withoutRecord(s),
  });
  return true;
}
export function restoreVictory(s, raw, restoreWorld) {
  s.victory = null;
  const record = raw?.victory;
  if (
    !s.completed ||
    record?.version !== 1 ||
    !record.snapshot?.completed ||
    !record.snapshot?.counts?.Z3
  )
    return;
  // Strip nested records before validation, so an imported file cannot recurse.
  const { victory, ...saved } = record.snapshot;
  const validated = restoreWorld(saved);
  if (!validated.completed) return;
  // Validation must not rewrite the historical JSON with current migrations.
  const snapshot = structuredClone(saved);
  delete snapshot.victory;
  s.victory = freeze({
    version: 1,
    release:
      typeof record.release === "string"
        ? record.release.slice(0, 32)
        : RELEASE_NAME,
    capturedAt: Number.isFinite(record.capturedAt)
      ? record.capturedAt
      : snapshot.completedAt,
    snapshot,
  });
}
export function victorySource(s) {
  if (!s.completed) return null;
  return s.victory
    ? {
        snapshot: structuredClone(s.victory.snapshot),
        historical: true,
        label: "首次通关",
        release: s.victory.release,
      }
    : {
        snapshot: withoutRecord(s),
        historical: false,
        label: "当前建设 · 历史通关",
        release: RELEASE_NAME,
      };
}
