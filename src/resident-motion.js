// Deterministic visual poses only. Never advances jobs, earnings, paths or clocks.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (v) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};
const window = (phase, start, peak, end) =>
  smooth((phase - start) / (peak - start)) *
  (1 - smooth((phase - peak) / (end - peak)));
const fract = (v) => v - Math.floor(v);
export const MOTION_JOBS = Object.freeze([
  "idle",
  "researcher",
  "farmer",
  "rancher",
  "hauler",
  "merchant",
  "miner",
  "crafter",
  "musician",
  "engineer",
  "stagehand",
  "host",
]);
export function identitySeed(id) {
  let hash = 2166136261;
  for (const c of String(id ?? "resident")) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
export function residentActivity(r = {}, options = {}) {
  const raw =
    typeof r.activity === "string"
      ? r.activity
      : r.activity?.kind || r.activity?.type;
  const activity =
    { walk: "travel", walking: "travel", work: "working", active: "working" }[
      raw
    ] || raw;
  if (
    ["idle", "rest", "travel", "working", "waiting", "handover", "carrying"].includes(
      activity,
    )
  )
    return activity;
  if (r.path?.length) return "travel";
  if (r.cargo) return "carrying";
  if (r.handover > 0) return "handover";
  if (options.indoor && options.speaking) return "working";
  return r.job && r.job !== "idle" ? "working" : "idle";
}
const blank = () => ({
  bodyPitch: 0,
  bodyYaw: 0,
  bodyRoll: 0,
  breath: 0,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  armLX: 0,
  armLY: 0,
  armLZ: 0,
  armRX: 0,
  armRY: 0,
  armRZ: 0,
  elbowL: 0,
  elbowR: 0,
  legL: 0,
  legR: 0,
  stepL: 0,
  stepR: 0,
  cargoLift: 0,
  cargoPitch: 0,
  snip: 0,
  antenna: 0,
});
const POSE_KEYS = Object.freeze(Object.keys(blank()));
export function sampleResidentPose(r = {}, time = 0, options = {}) {
  const seed = identitySeed(r.id),
    t = (Number.isFinite(time) ? time : 0) % 1000000,
    clock = t * (0.94 + seed * 0.12) + seed * 29,
    activity = residentActivity(r, options),
    job = options.job || r.job || "idle",
    p = blank(),
    gait = t * (6.4 + seed * 0.9) + seed * TAU;
  p.breath = Math.sin(clock * 1.7) * 0.006;
  p.bodyRoll = Math.sin(clock * 0.7) * 0.012;
  p.headYaw = Math.sin(clock * 0.47) * 0.17 + Math.sin(clock * 0.17) * 0.06;
  p.headPitch = 0.02 + Math.sin(clock * 0.9) * 0.028;
  p.armLX = -0.035 + Math.sin(clock * 1.2) * 0.018;
  p.armRX = -0.035 - Math.sin(clock * 1.2) * 0.018;
  let phase = fract(clock / 4),
    action = "look-around";
  if (activity === "travel") {
    p.legL = Math.sin(gait) * 0.29;
    p.legR = -p.legL;
    p.stepL = Math.max(0, Math.sin(gait)) * 0.04;
    p.stepR = Math.max(0, -Math.sin(gait)) * 0.04;
    p.armLX = -Math.sin(gait) * 0.24;
    p.armRX = Math.sin(gait) * 0.24;
    p.headYaw *= 0.2;
    p.bodyRoll = Math.sin(gait / 2) * 0.018;
    p.bodyPitch = 0.025;
    p.breath *= 0.3;
    action = "walk";
  } else if (activity === "waiting") {
    p.headPitch = 0.08 + Math.sin(clock * 0.5) * 0.05;
    p.headYaw *= 1.35;
    p.armLX = -0.15;
    p.elbowL = -0.18;
    action = "watch-workplace";
  } else if (activity === "handover") {
    const reach = window(phase, 0.04, 0.36, 0.9);
    p.armLX = p.armRX = -0.55 - reach * 0.55;
    p.elbowL = p.elbowR = -0.13;
    p.headPitch = 0.08 + reach * 0.1;
    p.headYaw *= 0.2;
    p.cargoLift = reach * 0.045;
    p.bodyPitch = reach * 0.045;
    action = "handover";
  } else if (activity === "rest") {
    p.headPitch=.13;p.headYaw=Math.sin(clock*.3)*.08;
    p.armLX=p.armRX=.08;p.bodyPitch=.025;action="take-a-break";
  } else if (activity === "working") {
    p.headYaw *= 0.25;
    if(job === "researcher"){
      p.armLX=-.8;p.armRX=-.65;p.elbowL=-.3;p.headPitch=.18;p.headYaw=Math.sin(clock*.6)*.12;action="read-research";
    } else if (job === "farmer") {
      phase = fract(clock / 6.5);
      const harvest = window(phase, 0.03, 0.27, 0.6),
        hat = window(phase, 0.74, 0.83, 0.94);
      p.bodyPitch = harvest * 0.25;
      p.headPitch = harvest * 0.13 + hat * 0.35;
      p.armRX = -0.18 - harvest * (0.65 + Math.sin(clock * 5) * 0.14);
      p.elbowR = -harvest * 0.25;
      p.armLX = -harvest * 0.38 - hat * 2.28;
      p.elbowL = -hat * 0.15;
      p.headYaw = Math.sin(clock * 0.7) * 0.19 * (1 - harvest);
      action =
        hat > 0.2 ? "adjust-hat" : harvest > 0.25 ? "harvest" : "inspect-crops";
    } else if (job === "miner") {
      phase = fract(clock / 3.15);
      const wind = smooth((phase - 0.06) / 0.28),
        hit = smooth((phase - 0.34) / 0.085),
        recovery = smooth((phase - 0.5) / 0.3);
      p.armRX = -0.35 - 1.6 * wind * (1 - hit) + 0.25 * hit * (1 - recovery);
      p.elbowR = -0.12 - 0.3 * wind * (1 - hit);
      p.armLX = -0.16 - 0.24 * wind * (1 - hit);
      p.bodyPitch = 0.03 + 0.16 * hit * (1 - recovery);
      p.headPitch = 0.14 - 0.08 * wind * (1 - hit);
      action =
        phase < 0.34 ? "windup" : phase < 0.5 ? "pick-strike" : "recover";
    } else if (job === "rancher") {
      phase = fract(clock / 4.8);
      const shear = window(phase, 0.05, 0.3, 0.72);
      p.bodyPitch = shear * 0.16;
      p.headPitch = 0.12 + shear * 0.08;
      p.armRX = -0.38 - shear * 0.45;
      p.armLX = -shear * 0.52;
      p.elbowR = -0.2 - shear * 0.12;
      p.snip = shear * (0.5 + Math.sin(clock * 10) * 0.5);
      p.headYaw = Math.sin(clock) * 0.18 * (1 - shear);
      action = shear > 0.3 ? "shear" : "check-flock";
    } else if (job === "crafter") {
      phase = fract(clock / 4.2);
      const working = 1 - smooth((phase - 0.6) / 0.14),
        strike = Math.max(0, Math.sin(clock * 7.6));
      p.bodyPitch = working * 0.08;
      p.headPitch = 0.15 - (1 - working) * 0.08;
      p.armRX = -0.38 - working * strike * 0.83;
      p.elbowR = -0.17;
      p.armLX = -0.45 - (1 - working) * 0.42;
      p.elbowL = -0.2 - (1 - working) * 0.3;
      p.headYaw = (1 - working) * -0.18;
      action = working > 0.3 ? "hammer" : "inspect-craft";
    } else if (job === "merchant") {
      const count=window(phase,.1,.4,.7);
      p.headPitch=.12; p.headYaw=(1-count)*.2;
      p.armLX=-.7; p.armRX=-.4-count*.65; p.elbowR=-.25;
      action=count>.3?"count-sale":"greet-customer";
    } else if (job === "hauler") {
      p.bodyPitch = window(phase, 0.02, 0.25, 0.66) * 0.18;
      p.armLX = p.armRX = -0.45 - p.bodyPitch;
      p.headPitch = 0.18;
      action = "sort-cargo";
    } else if (job === "musician") {
      phase = fract(clock / 5.8);
      const tune = window(phase, 0.62, 0.76, 0.96),
        tap = (Math.sin(clock * 6.3) + 1) / 2;
      p.headPitch = Math.sin(clock * 6.3) * 0.075;
      p.bodyRoll = Math.sin(clock * 3.15) * 0.027;
      p.armLX = -0.22 - tap * 0.18;
      p.armRX = -0.35 - tune * 0.57;
      p.elbowR = -0.2 - tune * 0.27;
      p.headYaw = tune * 0.17;
      action = tune > 0.25 ? "cue-record" : "keep-beat";
    } else if (job === "engineer") {
      phase = fract(clock / 3.8);
      const adjust = window(phase, 0.05, 0.4, 0.8);
      p.headPitch = 0.16;
      p.bodyPitch = 0.07;
      p.armRX = -0.62 - adjust * 0.23;
      p.armLX = -0.48 - (1 - adjust) * 0.21;
      p.elbowR = -0.24 + Math.sin(clock * 5.5) * 0.055;
      p.elbowL = -0.2;
      p.headYaw = (adjust - 0.5) * 0.23;
      action = "tune-sequencer";
    } else if (job === "stagehand") {
      phase = fract(clock / 5.1);
      const welcome = window(phase, 0.06, 0.32, 0.73);
      p.armRX = -0.25 - welcome * 1.38;
      p.armRZ = -welcome * 0.06;
      p.elbowR = -welcome * (0.35 + Math.sin(clock * 6) * 0.13);
      p.armLX = -0.4;
      p.headYaw = Math.sin(clock * 0.7) * 0.19;
      action = welcome > 0.3 ? "signal-program" : "check-stage";
    } else if (job === "host") {
      phase = fract(clock / 5.2);
      const speaking = !!options.speaking,
        welcome = window(phase, 0.02, 0.18, 0.45);
      p.armRX = -1.0;
      p.armRY = -0.25;
      p.elbowR = -0.82;
      p.armLX = speaking ? -0.42 - welcome * 0.88 : -0.28 - welcome * 0.75;
      p.elbowL = speaking
        ? -0.25 - (0.5 + Math.sin(clock * 4.6) * 0.5) * 0.25
        : -0.18;
      p.headYaw = Math.sin(clock * 0.58) * 0.17;
      p.headPitch = speaking ? Math.sin(clock * 4.6) * 0.045 : 0.035;
      p.bodyRoll = Math.sin(clock * 0.85) * 0.012;
      action = speaking ? "speak" : welcome > 0.3 ? "welcome" : "listen";
    }
  } else if (activity === "idle") {
    phase = fract(clock / 15.3);
    const wave = window(phase, 0.79, 0.855, 0.945);
    p.armRX -= wave * 1.35;
    p.elbowR = -wave * (0.38 + Math.sin(clock * 6) * 0.13);
    p.headRoll = wave * -0.06;
    action = wave > 0.25 ? "greet-neighbor" : "look-around";
  }
  if (
    job === "host" &&
    !["rest", "travel", "handover", "carrying"].includes(activity)
  ) {
    p.armRX = -1;
    p.armRY = -0.25;
    p.elbowR = -0.82;
    if (activity !== "working") action = "listen";
  }
  if (activity === "carrying" || r.cargo) {
    p.armLX = p.armRX = -1.03;
    p.elbowL = p.elbowR = -0.13;
    p.armLY = 0.08;
    p.armRY = -0.08;
    p.headPitch = 0.06;
    p.cargoLift += activity === "travel" ? Math.sin(gait * 2) * 0.008 : 0;
    if (activity !== "handover")
      action = activity === "travel" ? "carry-walk" : "hold-cargo";
  }
  p.antenna = Math.sin(clock * 1.2) * 0.03 + p.headYaw * 0.16;
  if (options.indoor) {
    p.bodyRoll = clamp(p.bodyRoll, -0.018, 0.018);
    p.armLZ = clamp(p.armLZ, -0.07, 0.07);
    p.armRZ = clamp(p.armRZ, -0.07, 0.07);
  }
  return { ...p, activity, action, phase, seed };
}

export function createResidentMotion(r, options = {}) {
  let last = null,
    pose = null;
  return (time, context = {}) => {
    const now = Number.isFinite(time) ? time : (last ?? 0),
      target = sampleResidentPose(r, now, { ...options, ...context });
    if (!pose) pose = { ...target };
    else {
      const dt = clamp(now - (last ?? now), 0, 0.25),
        // A frozen render clock is reduced-motion mode: new activities still
        // get a readable static pose without requiring animation time to pass.
        changedAtRest =
          dt === 0 &&
          (target.activity !== pose.activity || target.action !== pose.action),
        blend = changedAtRest ? 1 : 1 - Math.exp(-12 * dt);
      for (const key of POSE_KEYS)
        pose[key] += (target[key] - pose[key]) * blend;
      pose.activity = target.activity;
      pose.action = target.action;
      pose.seed = target.seed;
      pose.phase = target.phase;
    }
    last = now;
    return { ...pose };
  };
}
