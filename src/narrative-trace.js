// Opt-in diagnostics. No trace is stored in player saves or accumulated during
// normal play; test/development tooling owns the listener and its output size.
const observers = new WeakMap();
export function observeNarrativeTrace(state, listener) {
  const entry = { listener, previous: new Map() }; observers.set(state, entry);
  return () => { if (observers.get(state) === entry) observers.delete(state); };
}
export const hasNarrativeTrace = state => observers.has(state);
export function traceNarrative(state, phase, id, reason, extra = {}) {
  const entry = observers.get(state); if (!entry) return;
  const key = `${phase}:${id}`, signature = JSON.stringify([reason, extra]);
  if (entry.previous.get(key) === signature) return;
  entry.previous.set(key, signature);
  entry.listener({ at: state.play, phase, id, reason, ...extra });
}
