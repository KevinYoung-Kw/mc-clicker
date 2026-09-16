const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function measure(points) {
  const [a, b] = points;
  return {
    x: (a.x + b.x) / 2,
    distance: Math.max(24, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

// Read one complete pair per animation frame, not each finger's intermediate
// pointermove. Lock intent until lift, so a pinch cannot also pan or orbit.
export function createTouchCamera(points) {
  const origin = measure(points);
  let previous = origin,
    mode = null;
  return {
    update(points) {
      const next = measure(points);
      if (!mode) {
        const choices = [
          ["zoom", Math.abs(Math.log(next.distance / origin.distance)) / 0.07],
          ["orbit", Math.abs(next.x - origin.x) / 10],
          ["twist", Math.abs(angleDelta(next.angle, origin.angle)) / 0.13],
        ].sort((a, b) => b[1] - a[1]);
        if (choices[0][1] < 1) return { mode: null, zoom: 1, yaw: 0 };
        mode = choices[0][0];
      }
      const result = {
        mode,
        zoom: mode === "zoom" ? previous.distance / next.distance : 1,
        yaw:
          mode === "orbit"
            ? (next.x - previous.x) * -0.009
            : mode === "twist"
              ? -angleDelta(next.angle, previous.angle)
              : 0,
      };
      previous = next;
      return result;
    },
  };
}
