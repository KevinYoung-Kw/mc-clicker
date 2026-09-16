// Optional electricity improves the device's work, never its free base feature.
export const POWER_BENEFITS = {
  L1: { task: "music", rate: 1, speed: 0.5, label: "演出准备加快 50%" },
  M20: { task: "note", rate: 1, speed: 0.5, label: "合奏准备加快 50%" },
};

export function preparationSpeed(id, power) {
  const benefit = POWER_BENEFITS[id];
  return (
    1 +
    (benefit?.speed || 0) *
      Math.max(0, Math.min(1, power?.perDevice?.[id] || 0))
  );
}
