import * as T from "three";
// Pixel-art pickaxe extruded into voxel cells. The right tooth becomes the lowest point at the contact angle.
const cells = [
  "  HHHHH ",
  " HHLLHH ",
  " H  SW H",
  "    SW  ",
  "   SW   ",
  "  SW    ",
  " SW     ",
  "SW      ",
];
const geometry = new T.BoxGeometry(0.105, 0.105, 0.105);
const cache = new Map();
const material = (c) => {
  if (!cache.has(c))
    cache.set(c, new T.MeshStandardMaterial({ color: c, roughness: 1 }));
  return cache.get(c);
};
export const PICK_TIP = new T.Vector3(0.3675, 0.315, 0);
export function createPickaxe(color = "#b58c59") {
  const g = new T.Group(),
    colors = { H: color, L: "#e1dbc0", S: "#60442e", W: "#ac7f49" };
  const materials = Object.fromEntries(
    Object.entries(colors).map(([k, c]) => [k, material(c)]),
  );
  cells.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (!materials[c]) return;
      const m = new T.Mesh(geometry, materials[c]);
      m.position.set((x - 4) * 0.105, (5 - y) * 0.105, 0);
      m.castShadow = true;
      g.add(m);
    }),
  );
  // The outer tooth is the exact contact point, rather than the grip or model centre.
  g.userData.tip = PICK_TIP.toArray();
  return g;
}
export function pickColor(c) {
  return c.T6
    ? "#566970"
    : c.T5
      ? "#4aafab"
      : c.T4
        ? "#d8b043"
        : c.T3
          ? "#bbc8c5"
          : c.T2
            ? "#89948b"
            : "#a67d4c";
}
const smooth = (x) => x * x * (3 - 2 * x);
export const PICK_DURATION = 0.38,
  PICK_CONTACT = 0.16;
export function pickPose(age) {
  // Ease into the windup, accelerate to contact, then rebound and settle.
  if (age < 0 || age >= PICK_DURATION) return { angle: -0.7, lift: 0.45 };
  if (age < 0.08) {
    const t = smooth(age / 0.08);
    return { angle: -0.7 + 0.4 * t, lift: 0.45 + 0.25 * t };
  }
  if (age < PICK_CONTACT) {
    const t = (age - 0.08) / 0.08;
    return {
      angle: -0.3 + (-Math.PI / 2 + 0.3) * t * t,
      lift: 0.7 * (1 - t * t),
    };
  }
  const t = smooth((age - PICK_CONTACT) / (PICK_DURATION - PICK_CONTACT));
  return { angle: -Math.PI / 2 + (-0.7 + Math.PI / 2) * t, lift: 0.45 * t };
}
