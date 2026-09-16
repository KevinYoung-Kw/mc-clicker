// Only animate while gains exist. All live numbers share one layout read/frame.
export function createGainLayer(host) {
  const entries = [];
  let frame;
  function position(entry, rect, point) {
    entry.el.hidden = !point;
    if (point) {
      entry.el.style.left = `${point.x - rect.left}px`;
      entry.el.style.top = `${point.y - rect.top}px`;
    }
  }
  function update(now) {
    frame = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (now - entry.started >= 1000) {
        entry.el.remove();
        entries.splice(i, 1);
      }
    }
    // Resolve camera/viewport reads before any CSS writes to avoid layout
    // thrashing when a long press has several overlapping numbers alive.
    const rect = host.getBoundingClientRect();
    const points = entries.map((entry) => entry.anchor());
    entries.forEach((entry, i) => position(entry, rect, points[i]));
    if (entries.length) frame = requestAnimationFrame(update);
  }
  return {
    add(el, anchor) {
      const entry = { el, anchor, started: performance.now() };
      entries.push(entry);
      host.append(el);
      position(entry, host.getBoundingClientRect(), anchor());
      while (entries.length > 10) entries.shift().el.remove();
      if (!frame) frame = requestAnimationFrame(update);
    },
  };
}
