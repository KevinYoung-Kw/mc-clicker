// One simulation value drives both earnings and the collection meter.
export const COMBO_MAX = 15;
export const COMBO_STEP = 0.04;
export const COMBO_DECAY = 7.5;
export const canHoldMine = s => ['T3','T4','T5','T6'].some(id => s.counts[id] > 0);
export const comboGrace = s => s.counts.T4 ? 1 : .65;
export const miningCombo = s => {
  const value = Math.max(0, Math.min(COMBO_MAX, Number(s.combo) || 0));
  return { value, progress:value / COMBO_MAX, multiplier:1 + value * COMBO_STEP };
};
export function addMiningCombo(s) {
  s.combo = Math.min(COMBO_MAX, miningCombo(s).value + (s.play - s.lastClick <= comboGrace(s) || s.combo > 0 ? 1 : 0));
  s.lastClick = s.play;
}
export function decayMiningCombo(s, dt) {
  // Integrate only the part of this tick after the grace period; independent of frame size.
  const decayTime = Math.min(dt, Math.max(0, s.play - s.lastClick - comboGrace(s)));
  s.combo = Math.max(0, miningCombo(s).value - decayTime * COMBO_DECAY);
}
