import { blockBox as b, cube, group, P } from "./models.js";

// Open stalls use the same timber construction as the village, with contents
// that communicate trading vs. dressing the world before their labels open.
export function specialtyStall(parent, id) {
  const g = group(parent),
    nether = id === "N2";
  const w = nether ? 1.62 : 1.3,
    d = nether ? 1.25 : 1.05;
  const timber = nether ? "#72454b" : P.wood;
  g.userData.facilityStyle = nether
    ? "piglin-trading-camp"
    : "decoration-stall";
  b(
    g,
    nether ? "blackstone" : "cobblestone",
    nether ? "#64616a" : "#858c80",
    0,
    0.09,
    0,
    w,
    0.18,
    d,
  );
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
    for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
      b(g, "log", timber, x, 0.81, z, 0.12, 1.26, 0.12);
  b(g, "wood", timber, 0, 0.45, d / 2 - 0.2, w - 0.12, 0.54, 0.32);
  b(
    g,
    "wood",
    nether ? "#a77f54" : "#c3a16e",
    0,
    0.74,
    d / 2 - 0.19,
    w,
    0.1,
    0.43,
  );
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / 6;
    b(
      g,
      "cloth",
      nether ? (i % 2 ? "#8c484b" : "#a86b5c") : i % 2 ? "#d7cda8" : "#769a82",
      x,
      1.42,
      -0.02,
      w / 6,
      0.14,
      d + 0.14,
    );
  }
  b(g, "wood", timber, 0, 1.32, d / 2 + 0.04, w + 0.06, 0.08, 0.08);
  if (nether) {
    // Gold is visible on the transaction counter, blackstone encloses a safe
    // crate behind it; the piglin remains a member of the trading facility.
    b(g, "blackstone", "#514c56", -0.5, 0.39, -0.28, 0.39, 0.42, 0.36);
    b(g, "iron", "#cbb164", -0.5, 0.62, -0.28, 0.42, 0.06, 0.38);
    for (let i = 0; i < 3; i++) {
      b(g, "iron", "#e0bf67", -0.45 + i * 0.24, 0.855, 0.4, 0.19, 0.12, 0.14);
      cube(g, "#f5d787", -0.45 + i * 0.24, 0.92, 0.4, 0.13, 0.015, 0.09);
    }
    // Stand directly behind the counter so the awning does not hide the face.
    const pig = group(g, 0.19, 0.18, 0.1);
    for (const x of [-0.09, 0.09])
      cube(pig, "#695344", x, 0.15, 0, 0.14, 0.3, 0.16);
    cube(pig, "#8e654d", 0, 0.45, 0, 0.36, 0.39, 0.24);
    cube(pig, "#d2a189", 0, 0.79, 0, 0.4, 0.36, 0.34);
    cube(pig, "#bd8b76", 0, 0.72, 0.22, 0.22, 0.16, 0.13);
    for (const x of [-0.058, 0.058])
      cube(pig, "#695344", x, 0.74, 0.293, 0.044, 0.031, 0.02);
    cube(pig, "#f5d787", 0, 0.56, 0.132, 0.27, 0.12, 0.027);
    for (const x of [-0.22, 0.22]) {
      const ear = cube(pig, "#d2a189", x, 0.79, 0, 0.13, 0.22, 0.09);
      ear.rotation.z = Math.sign(x) * 0.28;
      cube(pig, "#e8d7b2", x * 0.47, 0.73, 0.301, 0.034, 0.09, 0.025);
      cube(pig, "#334941", x * 0.47, 0.825, 0.183, 0.042, 0.032, 0.023);
    }
    cube(pig, "#b8916d", -0.23, 0.5, 0.08, 0.12, 0.32, 0.15);
    cube(pig, "#b8916d", 0.23, 0.5, 0.08, 0.12, 0.32, 0.15);
  } else {
    b(g, "wood", timber, 0, 0.98, -0.39, 0.94, 0.07, 0.12);
    for (let i = 0; i < 3; i++) {
      const color = ["#799a70", "#bb8b69", "#a390b5"][i];
      b(g, "cloth", color, -0.33 + i * 0.33, 0.79, -0.39, 0.25, 0.3, 0.035);
      cube(g, "#e8d5a7", -0.33 + i * 0.33, 0.83, -0.364, 0.075, 0.075, 0.014);
      b(g, "wood", "#966f46", -0.31 + i * 0.3, 0.855, 0.31, 0.23, 0.12, 0.22);
      cube(g, color, -0.31 + i * 0.3, 0.925, 0.31, 0.17, 0.024, 0.16);
    }
    // Upright square paint brushes communicate decoration rather than groceries.
    for (const x of [-0.47, 0.43]) {
      b(g, "wood", timber, x, 1.03, 0.3, 0.045, 0.22, 0.045);
      b(
        g,
        "cloth",
        x < 0 ? "#8b9f7c" : "#bda1bb",
        x,
        1.16,
        0.3,
        0.09,
        0.07,
        0.065,
      );
    }
  }
  return g;
}
