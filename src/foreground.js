// Only observed foreground time enters this volatile queue, drained in bounded steps.
// Lifecycle events discard it; a long unobserved gap is treated as suspended.
export class ForegroundClock {
  constructor(now = 0, active = false) {
    this.last = now;
    this.active = active;
    this.pending = 0;
  }
  setActive(active, now) {
    if (this.active !== active) this.reset(now);
    this.active = active;
  }
  step(now) {
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    if (
      !this.active ||
      !Number.isFinite(elapsed) ||
      elapsed <= 0 ||
      elapsed > 30
    ) {
      this.pending = 0;
      return 0;
    }
    this.pending += elapsed;
    const step = Math.min(2, this.pending);
    this.pending -= step;
    return step;
  }
  reset(now) {
    this.last = now;
    this.pending = 0;
  }
}
