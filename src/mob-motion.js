// Read presentation state from the actor, including models nested below its wrapper.
// This never schedules jobs, moves actors, or changes production state.
const movingActivities = new Set(["walk", "travel", "moving", "carrying"]);
const workingActivities = new Set(["work", "working", "handover", "speaking"]);
export function readMobActivity(root, walking = () => false) {
  let moving = false,
    kind;
  for (let node = root; node; node = node.parent) {
    const data = node.userData || {};
    moving ||= data.walking === true;
    const value = data.activity;
    kind ||= typeof value === "string" ? value : value?.kind || value?.type;
  }
  if (moving || walking() || movingActivities.has(kind)) return "walk";
  return workingActivities.has(kind) ? "work" : "idle";
}

export function mobEnvelope(root, seed = 0, walking) {
  const state = {
    walk: 0,
    work: 0,
    phase: seed * 1.73,
    elapsed: 0,
    activity: "idle",
  };
  let previous;
  root.userData.mobMotion = state;
  return (t) => {
    const dt =
      previous === undefined ? 0 : Math.max(0, Math.min(0.1, t - previous));
    previous = t;
    state.activity = readMobActivity(root, walking);
    const ease = 1 - Math.exp(-dt * 8);
    state.walk += ((state.activity === "walk" ? 1 : 0) - state.walk) * ease;
    state.work += ((state.activity === "work" ? 1 : 0) - state.work) * ease;
    state.phase += dt * (1.2 + state.walk * 4.4 + state.work * 1.4);
    state.elapsed += dt;
    return state;
  };
}

// A leg's hip rotates, while the lowest front/back foot corner stays on or above
// its resting ground plane. Parameters are local bounds computed once by builders.
export function groundLeg(
  leg,
  axis,
  angle,
  hip,
  bottom,
  transverseMin,
  transverseMax,
  lift = 0,
) {
  leg.rotation[axis] = angle;
  const s = Math.sin(angle),
    c = Math.cos(angle);
  const edge =
    axis === "x"
      ? Math.min(-transverseMin * s, -transverseMax * s)
      : Math.min(transverseMin * s, transverseMax * s);
  const ground = hip + bottom;
  leg.position.y = hip + Math.max(0, ground - (hip + bottom * c + edge)) + lift;
}
