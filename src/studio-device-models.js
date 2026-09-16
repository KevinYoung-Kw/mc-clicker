// Shared, human-scale voxel equipment: room, placement preview and shop icon use
// this same geometry. Floor pieces start at the finished room floor (0.2).
import { cube, group, blockBox, blockMat } from "./models.js";
import { STUDIO_ANCHORS as A } from "./studio-layout.js";
const wood = (g, c, ...v) => blockBox(g, "wood", c, ...v);
const iron = (g, c, ...v) => blockBox(g, "iron", c, ...v);
const oak = "#966f46",
  darkOak = "#66513c",
  darkIron = "#35484b";

export const STUDIO_MODEL_IDS = Object.freeze([
  "L1",
  ...Array.from({ length: 12 }, (_, i) => `L${i + 3}`),
]);

function bolt(g, x, y, z, size = 0.025) {
  cube(g, "#c4bba0", x, y, z, size, size, 0.015);
}
function mount(g, y, w = 0.2) {
  const back = iron(g, "#67766d", 0, y, -0.06, w, 0.13, 0.04);
  back.userData.studioMount = "wall";
  iron(g, darkIron, 0, y, -0.025, w * 0.44, 0.06, 0.05);
}
export function studioScreen(g, x, y, z, w, h, color) {
  iron(g, darkIron, x, y, z, w, h, 0.075);
  cube(g, "#172e31", x, y, z + 0.042, w - 0.035, h - 0.035, 0.015);
  return cube(g, color, x, y + 0.008, z + 0.055, w - 0.075, h - 0.075, 0.012);
}
function pixels(g, x, y, z, pattern, color, unit = 0.025) {
  pattern.forEach((row, r) =>
    [...row].forEach((on, c) => {
      if (on === "1")
        cube(
          g,
          color,
          x + c * unit,
          y - r * unit,
          z,
          unit * 0.88,
          unit * 0.88,
          0.012,
        );
    }),
  );
}
function camera(g) {
  // Three stepped metal legs meet a real head plate; lens points at the host.
  for (const [x, z] of [
    [-0.17, 0.14],
    [0.17, 0.14],
    [0, -0.17],
  ]) {
    iron(g, "#455652", x, 0.23, z, 0.065, 0.06, 0.07);
    for (let j = 0; j < 3; j++) {
      const f = 1 - j * 0.31;
      iron(g, "#64756c", x * f, 0.32 + j * 0.12, z * f, 0.07, 0.18, 0.07);
    }
  }
  iron(g, darkIron, 0, 0.76, 0, 0.075, 0.51, 0.075);
  iron(g, "#879587", 0, 0.905, 0, 0.23, 0.065, 0.19);
  iron(g, darkIron, 0, 1.02, 0, 0.32, 0.21, 0.24);
  iron(g, "#556a60", 0, 1.02, -0.147, 0.21, 0.175, 0.055);
  cube(g, "#172f36", 0, 1.02, -0.188, 0.155, 0.133, 0.065);
  cube(g, "#6caba7", 0, 1.02, -0.223, 0.093, 0.084, 0.011);
  cube(g, "#b4ddd0", -0.026, 1.045, -0.23, 0.022, 0.022, 0.008);
  iron(g, darkIron, 0, 1.155, 0.015, 0.2, 0.035, 0.07);
  for (const x of [-0.083, 0.083])
    iron(g, darkIron, x, 1.126, 0.015, 0.035, 0.04, 0.055);
  cube(g, "#acbd9c", 0, 1.025, 0.127, 0.195, 0.105, 0.016);
  for (let j = 0; j < 3; j++)
    iron(g, "#273f3e", 0.166, 0.965 + j * 0.035, 0.04, 0.014, 0.012, 0.1);
  cube(g, "#de815d", 0.122, 1.089, -0.13, 0.026, 0.023, 0.014);
}

export function studioDeviceModel(parent, id, state = null, animations = []) {
  const g = group(parent);
  g.userData.studioModel = id;
  if (id === "L1") {
    wood(g, darkOak, 0, 0.23, 0, 0.43, 0.06, 0.43);
    wood(g, oak, 0, 0.435, 0, 0.42, 0.35, 0.42);
    wood(g, "#b58a55", 0, 0.62, 0, 0.46, 0.04, 0.46);
    for (const x of [-0.188, 0.188])
      for (const z of [-0.188, 0.188])
        wood(g, darkOak, x, 0.435, z, 0.045, 0.35, 0.045);
    for (const side of [-1, 1])
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 4; y++)
          cube(
            g,
            (x + y) % 2 ? "#745035" : "#4d3c2d",
            -0.135 + x * 0.0675,
            0.335 + y * 0.0675,
            side * 0.215,
            0.041,
            0.041,
            0.016,
          );
    cube(g, "#382f27", 0, 0.645, 0, 0.15, 0.014, 0.15);
    for (const sign of [-1, 1]) {
      cube(g, "#382f27", sign * 0.1125, 0.645, 0, 0.075, 0.014, 0.15);
      cube(g, "#382f27", 0, 0.645, sign * 0.1125, 0.15, 0.014, 0.075);
    }
    cube(g, "#667e53", 0, 0.655, 0, 0.09, 0.01, 0.09);
    cube(g, "#243b36", 0, 0.662, 0, 0.025, 0.004, 0.025);
    iron(g, "#b6aa7f", 0.13, 0.66, -0.105, 0.065, 0.025, 0.055);
  } else if (id === "L3") camera(g);
  else if (id === "L4") {
    // Buying a workstation never creates a person. Village staffing owns the
    // resident, its appearance and its actual presence in the room.
    wood(g, darkOak, 0, 0.23, 0, 0.72, 0.06, 0.9);
    for (const x of [-0.26, 0.26])
      iron(g, "#bca570", x, 0.263, 0.36, 0.08, 0.006, 0.045);
    iron(g, darkIron, 0.27, 0.305, -0.2, 0.13, 0.09, 0.21);
    iron(g, darkIron, 0.27, 0.64, -0.2, 0.038, 0.62, 0.038);
    iron(g, "#70867a", 0.25, 0.975, -0.2, 0.16, 0.065, 0.13);
    cube(g, "#2c4142", 0.23, 1.025, -0.2, 0.09, 0.065, 0.11);
    cube(g, "#b4bb97", 0.222, 1.061, -0.2, 0.064, 0.008, 0.085);
    const cue = cube(g, "#c58f56", 0.27, 0.69, -0.175, 0.025, 0.035, 0.016);
    cue.userData.studioStaffCue = true;
  } else if (id === "L5") {
    mount(g, 1.24, 0.5);
    studioScreen(g, 0, 1.26, 0, 1.02, 0.71, "#52746b");
    for (let j = 0; j < 4; j++) {
      cube(
        g,
        ["#d5b77a", "#98bfa2", "#b7a1c3", "#b0ccbd"][j],
        -0.36,
        1.49 - j * 0.14,
        0.068,
        0.065,
        0.065,
        0.012,
      );
      cube(
        g,
        "#d3ddbd",
        -0.06,
        1.505 - j * 0.14,
        0.069,
        0.38 - (j % 2) * 0.1,
        0.024,
        0.012,
      );
      cube(g, "#90b09a", 0.025, 1.462 - j * 0.14, 0.069, 0.43, 0.018, 0.012);
    }
    bolt(g, -0.484, 0.934, 0.047);
    bolt(g, 0.484, 0.934, 0.047);
  } else if (id === "L6") {
    const level = Math.min(5, state?.counts?.L6 || 1);
    wood(g, darkOak, 0, 0.255, 0, 0.8, 0.11, 0.68);
    wood(g, oak, 0, 0.465, 0, 0.77, 0.31, 0.62);
    wood(g, "#b58a55", 0, 0.655, 0, 0.84, 0.07, 0.71);
    for (const x of [-0.37, 0.37])
      iron(g, "#60766a", x, 0.47, 0, 0.045, 0.3, 0.645);
    cube(g, "#2b443e", 0, 0.46, 0.322, 0.61, 0.2, 0.022);
    for (let j = 0; j < level; j++)
      bolt(g, -0.25 + j * 0.125, 0.46, 0.341, 0.052);
    const parcels = [];
    for (let j = 0; j < 5; j++) {
      const p = group(
        g,
        -0.25 + (j % 3) * 0.25,
        0.79 + Math.floor(j / 3) * 0.21,
        -0.07,
      );
      p.userData.dynamic = true;
      wood(p, ["#b58a55", "#8eab88", "#ad92b7"][j % 3], 0, 0, 0, 0.2, 0.2, 0.2);
      cube(p, "#e2cda3", 0, 0.107, 0, 0.04, 0.014, 0.2);
      cube(p, "#e2cda3", 0, 0, 0.107, 0.04, 0.2, 0.014);
      cube(p, "#587665", 0.056, 0.023, 0.109, 0.035, 0.035, 0.009);
      parcels.push(p);
    }
    animations.push(() =>
      parcels.forEach((p, i) => {
        p.visible = (state?.live?.gifts?.length || 0) > i;
      }),
    );
    if (level >= 3) {
      iron(g, "#527975", 0.34, 0.915, -0.25, 0.08, 0.6, 0.085);
      iron(g, "#b07b52", 0.15, 1.23, -0.25, 0.46, 0.06, 0.085);
      iron(g, darkIron, -0.05, 1.135, -0.25, 0.045, 0.15, 0.045);
      iron(g, darkIron, -0.02, 1.06, -0.25, 0.105, 0.04, 0.045);
    }
  } else if (id === "L7") {
    const rail = iron(g, "#9caa96", 0, 2.25, 0, 0.7, 0.06, 0.12);
    rail.userData.studioMount = "ceiling";
    for (const x of [-0.12, 0.12])
      iron(g, darkIron, x, 2.12, 0, 0.045, 0.24, 0.08);
    iron(g, darkIron, 0, 1.98, 0, 0.34, 0.21, 0.29);
    iron(g, "#967ea2", 0, 1.98, -0.162, 0.2, 0.17, 0.045);
    cube(g, "#4d4363", 0, 1.98, -0.19, 0.135, 0.105, 0.018);
    cube(g, "#b7acd6", -0.03, 2.005, -0.202, 0.03, 0.03, 0.009);
    for (let j = 0; j < 3; j++)
      iron(g, "#1e383c", 0.176, 1.93 + j * 0.04, 0.02, 0.013, 0.015, 0.16);
    const tiles = [];
    for (let j = 0; j < 3; j++) {
      const p = group(g, -0.22 + j * 0.22, 1.68 - j * 0.12, -0.22);
      p.userData.dynamic = true;
      cube(p, ["#b6c98e", "#c7acd6", "#e1ba7d"][j], 0, 0, 0, 0.13, 0.13, 0.02);
      pixels(p, -0.032, 0.025, 0.018, ["101", "000", "111"], "#3e5850", 0.026);
      tiles.push(p);
    }
    animations.push((t) =>
      tiles.forEach((p, i) => {
        p.visible = (state?.live?.rainCooldown || 0) > 30;
        p.position.y =
          1.68 -
          i * 0.12 +
          (state?.reducedMotion ? 0 : Math.sin(t * 2 + i) * 0.035);
      }),
    );
  } else if (id === "L8") {
    mount(g, 1.81, 0.4);
    wood(g, darkOak, 0, 1.82, 0, 0.77, 0.43, 0.06);
    wood(g, "#b59b6d", 0, 1.82, 0.035, 0.7, 0.35, 0.014);
    for (let j = 0; j < 3; j++) {
      const x = -0.23 + j * 0.23;
      cube(g, "#e6d8b0", x, 1.812, 0.05, 0.17, 0.26, 0.018);
      pixels(
        g,
        x - 0.042,
        1.884,
        0.064,
        [
          ["010", "111", "010"],
          ["111", "101", "101"],
          ["101", "101", "111"],
        ][j],
        ["#6a8d61", "#b46d48", "#8b73a0"][j],
        0.04,
      );
      cube(g, "#6f8173", x, 1.725, 0.064, 0.105, 0.013, 0.01);
      bolt(g, x, 1.929, 0.066);
    }
  } else if (id === "L9") {
    mount(g, 1.77, 0.5);
    wood(g, darkOak, 0, 1.77, 0, 0.94, 0.29, 0.06);
    cube(g, "#345848", 0, 1.77, 0.037, 0.86, 0.21, 0.018);
    for (let j = 0; j < 5; j++) {
      const x = -0.32 + j * 0.16;
      cube(
        g,
        ["#c6a458", "#a4c0a0", "#b49bc3"][j % 3],
        x,
        1.798,
        0.055,
        0.085,
        0.085,
        0.017,
      );
      cube(g, "#d8dec0", x, 1.737, 0.058, 0.064, 0.028, 0.012);
      cube(g, "#506d53", x, 1.798, 0.069, 0.035, 0.035, 0.012);
    }
  } else if (id === "L10") {
    iron(g, "#677a6e", 0, 0.245, 0, 0.63, 0.09, 0.59);
    iron(g, darkIron, 0, 0.73, 0, 0.58, 0.88, 0.5);
    for (const x of [-0.26, 0.26])
      iron(g, "#8e9e8b", x, 0.73, 0.26, 0.045, 0.86, 0.025);
    for (let j = 0; j < 4; j++) {
      iron(g, "#566e64", 0, 0.385 + j * 0.21, 0.26, 0.45, 0.17, 0.035);
      for (let k = 0; k < 4; k++)
        cube(
          g,
          "#223c37",
          -0.15 + k * 0.06,
          0.385 + j * 0.21,
          0.285,
          0.025,
          0.085,
          0.014,
        );
      bolt(g, 0.18, 0.4 + j * 0.21, 0.288, 0.022);
    }
    const on = cube(g, "#94c4a2", 0.18, 1.0, 0.29, 0.043, 0.043, 0.02);
    on.userData.dynamic = true;
    animations.push(() => {
      on.visible = !!state?.live?.director;
    });
    iron(g, "#273d3d", 0, 1.215, -0.01, 0.66, 0.09, 0.59);
    for (let j = 0; j < 4; j++)
      iron(g, "#869887", -0.195 + j * 0.13, 1.268, -0.05, 0.07, 0.015, 0.36);
  } else if (id === "L11") {
    g.position.z = -0.005;
    mount(g, 1.39, 0.43);
    iron(g, "#536961", 0, 1.4, 0.015, 0.7, 0.35, 0.16);
    for (let j = 0; j < 3; j++) {
      const x = -0.22 + j * 0.22;
      cube(g, "#203637", x, 1.4, 0.103, 0.19, 0.275, 0.018);
      cube(
        g,
        ["#709968", "#ae654e", "#8773a7"][j],
        x,
        1.4,
        0.115,
        0.148,
        0.23,
        0.014,
      );
      pixels(
        g,
        x - 0.039,
        1.465,
        0.127,
        [
          ["010", "111", "010", "010"],
          ["111", "101", "101", "111"],
          ["010", "101", "101", "010"],
        ][j],
        "#d6dcbc",
        0.039,
      );
    }
    iron(g, "#b7aaa0", 0.26, 1.623, -0.005, 0.03, 0.1, 0.035);
  } else if (id === "L12") {
    const panels = [];
    for (const x of [-0.19, 0.19]) {
      iron(g, darkIron, x, 0.24, 0, 0.17, 0.08, 0.56);
      iron(g, "#87978a", x, 1.17, 0, 0.055, 1.94, 0.055);
      iron(g, darkIron, x, 2.13, 0, 0.075, 0.07, 0.65);
      for (const z of [-0.17, 0.17]) {
        iron(g, "#53655a", x, 2.055, z, 0.3, 0.17, 0.3);
        const panel = cube(g, "#eedcb0", x, 1.963, z, 0.255, 0.018, 0.25);
        panel.material = blockMat("iron", "#eedcb0", 0.45);
        panel.userData.dynamic = true;
        panel.userData.studioLamp = true;
        panels.push(panel);
        for (const dx of [-0.15, 0.15])
          iron(g, darkIron, x + dx, 2.03, z, 0.016, 0.15, 0.31);
      }
    }
    iron(g, darkIron, 0, 2.15, 0, 0.38, 0.06, 0.065);
    const update = () => {
      const power = Math.min(
        1,
        Math.max(0, state?.grid?.last?.perDevice?.L12 || 0),
      );
      for (const p of panels) {
        p.visible = power > 0.001;
        p.scale.x = 0.255 * power;
      }
    };
    update();
    animations.push(update);
  } else if (id === "L13") {
    wood(g, darkOak, 0, 0.24, 0, 0.44, 0.08, 0.36);
    wood(g, oak, 0, 0.61, 0, 0.085, 0.7, 0.09);
    wood(g, darkOak, 0, 1.045, 0, 0.48, 0.69, 0.08);
    cube(g, "#c6cba7", 0, 1.045, 0.047, 0.41, 0.6, 0.018);
    for (let j = 0; j < 3; j++) {
      cube(g, "#f1e5bd", -0.125, 1.24 - j * 0.145, 0.064, 0.055, 0.055, 0.012);
      cube(g, "#54775a", 0.05, 1.24 - j * 0.145, 0.064, 0.17, 0.023, 0.012);
    }
    cube(g, "#6a7251", 0, 0.81, 0.064, 0.31, 0.05, 0.012);
    cube(g, "#d9b361", -0.055, 0.81, 0.074, 0.19, 0.032, 0.01);
  } else if (id === "L14") {
    for (const x of [-0.63, 0.63]) {
      wood(g, darkOak, x, 0.25, 0.26, 0.13, 0.1, 0.19);
      wood(g, oak, x, 1.19, 0.26, 0.07, 1.88, 0.07);
    }
    wood(g, darkOak, 0, 2.135, 0.26, 1.33, 0.08, 0.085);
    for (let j = 0; j < 5; j++) {
      blockBox(
        g,
        "cloth",
        ["#8fab87", "#bb9770", "#a994ba"][j % 3],
        -0.45 + j * 0.225,
        2.015,
        0.275,
        0.135,
        0.18,
        0.035,
      );
      cube(g, "#e3cfa0", -0.45 + j * 0.225, 1.981, 0.299, 0.055, 0.055, 0.012);
    }
    iron(g, darkIron, 0.28, 0.38, -0.08, 0.35, 0.36, 0.36);
    wood(g, oak, 0.28, 0.59, -0.08, 0.39, 0.06, 0.39);
    for (let j = 0; j < 3; j++) {
      cube(
        g,
        ["#92ae79", "#c48a6c", "#a292b7"][j],
        0.17 + j * 0.105,
        0.637,
        -0.02,
        0.06,
        0.034,
        0.06,
      );
      cube(g, "#223e3b", 0.17 + j * 0.105, 0.39, 0.107, 0.045, 0.15, 0.014);
    }
    for (const x of [-0.51, -0.31, -0.11]) {
      wood(g, "#b19461", x, 0.225, -0.08, 0.16, 0.05, 0.34);
      cube(g, "#d7c58f", x, 0.258, -0.08, 0.055, 0.016, 0.21);
    }
  }
  return g;
}
