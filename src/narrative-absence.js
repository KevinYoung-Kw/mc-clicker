// Session-only observation. Wall time explains an absence; it never advances
// the economy, narrator reading time or any saved game clock.
export class NarrativeAbsence {
  active = null;
  leftAt = null;
  stateAtLeave = null;
  eligible = false;
  update(active, now, s) {
    if (this.active === active) return false;
    const previous = this.active;
    this.active = active;
    if (!active) {
      this.leftAt = previous === true ? now : null;
      this.stateAtLeave = s;
      this.eligible = !!(s.guidance.info && s.guidance.notices && s.rate > 0);
      return false;
    }
    const seconds = this.leftAt === null ? 0 : (now - this.leftAt) / 1000;
    this.leftAt = null;
    if (!this.eligible || this.stateAtLeave !== s || !Number.isFinite(seconds) || seconds < 12 ||
        !s.guidance.info || !s.guidance.notices || s.narrative.seen.includes('foreground-return')) return false;
    s.narrative.returnAt = s.play;
    s.narrative.eligibleAt['foreground-return'] = s.play;
    return true;
  }
}
