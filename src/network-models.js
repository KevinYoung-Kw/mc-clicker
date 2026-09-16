import { group, blockBox, box } from "./models.js";
const C = {
  stone: "#89948a",
  wood: "#a78252",
  dark: "#49584f",
  iron: "#a9b3a8",
  copper: "#b47750",
  paper: "#e4dbb8",
  red: "#bd634b",
};
function part(p, kind, c, x, y, z, w, h, d) {
  return blockBox(p, kind, C[c] || c, x, y, z, w, h, d);
}
function terminal(p, x, y, z) {
  part(p, "iron", "dark", x, y, z, 0.14, 0.14, 0.05);
  const m = part(p, "iron", "red", x, y, z + 0.028, 0.09, 0.09, 0.01);
  m.userData.facilityPart = "network-terminal";
  return m;
}
function upgradeGroup(p, id) {
  const g = group(p);
  g.name = "dedicated-upgrades";
  g.userData.upgradeId = id;
  return g;
}
const level = (s, id) => s.upgrades?.levels[id] || 0;
export function makeNetworkFacility(parent, id, s, animations) {
  const g = group(parent);
  g.userData.facilityStyle = "network-v14";
  if (id === "M5") {
    part(g, "stone", "stone", 0, 0.06, 0, 0.88, 0.12, 0.88);
    part(g, "wood", "wood", -0.035, 0.32, 0, 0.64, 0.42, 0.62);
    for (const x of [-0.34, 0.27])
      part(g, "iron", "iron", x, 0.32, 0.3, 0.055, 0.43, 0.06);
    const desk = group(g, -0.035, 0.6, 0.02);
    desk.rotation.x = 0.24;
    part(desk, "stone", "paper", 0, 0, 0, 0.7, 0.06, 0.62);
    for (const z of [-0.16, 0.02, 0.2])
      part(desk, "iron", "red", -0.05, 0.034, z, 0.4, 0.012, 0.025);
    for (const x of [-0.24, 0.13])
      part(desk, "iron", "red", x, 0.034, 0.02, 0.025, 0.012, 0.36);
    terminal(g, -0.03, 0.26, 0.34);
    const wheel = group(g, 0.34, 0.4, 0.02);
    part(wheel, "iron", "iron", 0, 0, 0, 0.12, 0.06, 0.06);
    part(wheel, "wood", "wood", 0.055, 0, 0.105, 0.065, 0.05, 0.24);
    part(wheel, "wood", "dark", 0.08, 0, 0.2, 0.1, 0.07, 0.07);
    animations.push((t) => (wheel.rotation.x = t * 3));
    ["M10", "M11", "M12"].forEach((key, i) => {
      const x = -0.26 + i * 0.23;
      part(g, "stone", "dark", x, 0.67, -0.3, 0.19, 0.035, 0.17);
      if (s.counts[key]) {
        part(g, "stone", "stone", x, 0.76, -0.3, 0.18, 0.18, 0.16);
        box(
          g,
          key === "M10" ? "#e1d4a3" : "#ac5546",
          x,
          0.79,
          -0.211,
          0.095,
          0.045,
          0.015,
        );
      }
    });
  } else if (id === "M4") {
    part(g, "stone", "stone", 0, 0.045, 0, 0.88, 0.09, 0.88);
    const shelves = level(s, "store-shelves"),
      count = s.counts.M4 || 1;
    if (!shelves) {
      part(g, "wood", "wood", 0, 0.36, -0.025, 0.68, 0.54, 0.59);
      part(g, "log", "dark", 0, 0.54, -0.025, 0.71, 0.045, 0.62);
      part(g, "iron", "iron", 0, 0.4, 0.28, 0.09, 0.16, 0.025);
    } else {
      const shelf = upgradeGroup(g, "store-shelves");
      part(shelf, "wood", "wood", 0, 0.37, -0.27, 0.7, 0.56, 0.08);
      for (const x of [-0.32, 0.32])
        part(g, "log", "dark", x, 0.37, 0, 0.075, 0.58, 0.59);
      for (let j = 0; j < Math.min(3, shelves); j++) {
        const y = 0.13 + j * 0.18;
        part(shelf, "wood", "wood", 0, y, 0, 0.67, 0.04, 0.6);
        for (let k = 0; k < Math.min(3, 1 + Math.floor(count / 4)); k++)
          part(
            shelf,
            "wood",
            k % 2 ? "copper" : "wood",
            -0.2 + k * 0.2,
            y + 0.075,
            0.02,
            0.15,
            0.11,
            0.21,
          );
      }
      part(g, "wood", "wood", 0, 0.68, 0, 0.73, 0.06, 0.62);
    }
    part(g, "log", "wood", 0, 0.86, -0.31, 0.7, 0.29, 0.07);
    part(g, "wood", "dark", -0.08, 0.86, -0.268, 0.16, 0.13, 0.015);
    part(g, "wood", "paper", 0.13, 0.86, -0.268, 0.18, 0.035, 0.02);
    part(g, "wood", "wood", 0, 0.11, 0.36, 0.47, 0.06, 0.13);
    if (level(s, "store-compress")) {
      const u = upgradeGroup(g, "store-compress");
      for (const y of [0.2, 0.57])
        part(u, "iron", "iron", 0, y, 0.29, 0.7, 0.055, 0.025);
    }
    if (level(s, "store-sort")) {
      const u = upgradeGroup(g, "store-sort");
      ["#8b9f67", "#c6a267", "#a88da8"].forEach((c, i) =>
        box(u, c, 0.3, 0.2 + i * 0.15, 0.315, 0.1, 0.075, 0.02),
      );
    }
  } else if (id === "M7") {
    part(g, "stone", "stone", 0, 0.1, 0, 1.84, 0.2, 1.5);
    part(g, "wood", "wood", 0, 1.13, -0.18, 0.72, 1.9, 0.7);
    for (const x of [-0.39, 0.39])
      for (const z of [-0.56, 0.2])
        part(g, "log", "dark", x, 1.12, z, 0.12, 1.9, 0.12);
    for (let i = 0; i < 4; i++)
      part(
        g,
        "wood",
        "wood",
        0,
        2.13 + i * 0.1,
        -0.18,
        1 - i * 0.21,
        0.1,
        0.87,
      );
    const fan = group(g, 0, 1.62, 0.43);
    fan.userData.facilityPart = "windmill-rotor";
    part(fan, "log", "dark", 0, 0, 0, 0.2, 0.2, 0.2);
    const reinforced = level(s, "wind-blades") > 0;
    for (let i = 0; i < 4; i++) {
      const blade = group(fan);
      blade.rotation.z = (i * Math.PI) / 2;
      part(blade, "log", "wood", 0, 0.48, 0, 0.09, 0.8, 0.08);
      part(blade, "cloth", "paper", 0.09, 0.52, 0.015, 0.21, 0.58, 0.045);
      const straps = reinforced ? upgradeGroup(blade, "wind-blades") : blade;
      for (const y of [0.27, 0.75])
        part(
          straps,
          "wood",
          reinforced ? "dark" : "wood",
          0.08,
          y,
          0.05,
          0.27,
          reinforced ? 0.08 : 0.045,
          0.065,
        );
    }
    part(g, "iron", "dark", 0, 0.4, 0.3, 0.95, 0.39, 0.53);
    const coils = 1 + Math.min(2, level(s, "wind-coils"));
    for (let i = 0; i < coils; i++)
      part(
        i ? upgradeGroup(g, "wind-coils") : g,
        "iron",
        "copper",
        -0.26 + i * 0.25,
        0.43,
        0.45,
        0.16,
        0.36,
        0.23,
      );
    part(g, "iron", "iron", -0.49, 0.44, 0.29, 0.1, 0.47, 0.6);
    part(g, "iron", "iron", 0.49, 0.44, 0.29, 0.1, 0.47, 0.6);
    if (level(s, "wind-gears")) {
      const u = upgradeGroup(g, "wind-gears");
      part(u, "iron", "stone", 0.38, 0.84, 0.2, 0.27, 0.44, 0.28);
      part(u, "iron", "dark", 0.38, 0.83, 0.35, 0.19, 0.22, 0.03);
    }
    terminal(g, 0, 0.24, 0.58);
    animations.push(
      (t) =>
        (fan.rotation.z = -t * (0.6 + Math.min(3, s.counts.M7 || 1) * 0.13)),
    );
  } else if (id === "M15") {
    part(g, "stone", "stone", 0, 0.08, 0, 1.84, 0.16, 1.3);
    part(g, "iron", "dark", 0, 0.43, 0, 1.57, 0.55, 0.9);
    const modules = Math.min(3, 1 + Math.floor(((s.counts.M15 || 1) - 1) / 4));
    for (let i = 0; i < 3; i++) {
      const x = -0.53 + i * 0.53;
      part(g, "iron", "iron", x, 0.76, 0, 0.43, 0.12, 0.92);
      part(g, "iron", "iron", x, 0.41, -0.48, 0.45, 0.55, 0.08);
      if (i < modules) {
        for (const dx of [-0.13, 0, 0.13])
          part(g, "iron", "copper", x + dx, 0.45, 0.41, 0.08, 0.45, 0.23);
        const rotor = group(g, x, 0.46, 0.05);
        part(rotor, "iron", "dark", 0, 0, 0, 0.3, 0.09, 0.5);
        animations.push((t) => (rotor.rotation.x = t * 2));
      }
    }
    for (const x of [-0.82, 0.82])
      part(g, "iron", "iron", x, 0.44, 0, 0.09, 0.65, 1.06);
    terminal(g, 0, 0.25, 0.5);
  }
  return g;
}
