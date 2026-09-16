import { cube, group, mat, blockBox } from "./models.js";
import { beaconLight } from './beacon-light.js';

// A facility is built from a readable block silhouette first. Small face details
// sit outside the block surface, so pixel patterns never fight the depth buffer.
const C = {
  stone: "#adbbab",
  cobble: "#747e78",
  iron: "#9da5a0",
  dark: "#334941",
  wood: "#977054",
  oak: "#b58a55",
  earth: "#916c4b",
  red: "#e9664f",
  gold: "#edbd64",
  water: "#548f9a",
  obsidian: "#443e51",
  purple: "#a997bc",
};
const SURFACE = {
  [C.stone]: "stone",
  [C.cobble]: "cobblestone",
  [C.iron]: "iron",
  [C.wood]: "wood",
  [C.oak]: "wood",
  [C.obsidian]: "obsidian",
  [C.purple]: "purpur",
  "#665c48": "wood",
};
function part(p, name, color, x, y, z, w, h, d, surface = SURFACE[color]) {
  const m = surface
    ? blockBox(p, surface, color, x, y, z, w, h, d)
    : cube(p, color, x, y, z, w, h, d);
  m.userData.facilityPart = name;
  return m;
}
function model(p, name) {
  const g = group(p);
  g.userData.facility = name;
  return g;
}
function frame(p, name, color, y, size, width, height) {
  for (const x of [-1, 1])
    part(p, name, color, (x * (size - width)) / 2, y, 0, width, height, size);
  for (const z of [-1, 1])
    part(
      p,
      name,
      color,
      0,
      y,
      (z * (size - width)) / 2,
      size - width * 2,
      height,
      width,
    );
}
function facePixels(p, color, y, z, rows, pitch = 0.12, size = 0.07) {
  rows.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === "1")
        part(
          p,
          "face-pixel",
          color,
          (i - (row.length - 1) / 2) * pitch,
          y - j * pitch,
          z,
          size,
          size,
          0.018,
        );
    }),
  );
}
function fire(p, animations, y = 0.27, z = 0.52) {
  for (let i = 0; i < 3; i++) {
    const h = 0.1 + (i % 2) * 0.07;
    const flame = part(
      p,
      "fire",
      i % 2 ? C.gold : "#dd8158",
      (i - 1) * 0.13,
      y + h / 2,
      z,
      0.115,
      h,
      0.022,
    );
    flame.material = mat(i % 2 ? C.gold : "#dd8158", 0.35);
    animations.push((t) => {
      const height =
        h * (0.8 + Math.floor((Math.sin(t * 4 + i) + 1) * 2) * 0.1);
      flame.scale.y = height;
      flame.position.y = y + height / 2;
    });
  }
}

export function waterWell(parent) {
  const g = model(parent, "water-well");
  part(g, "foundation", C.cobble, 0, 0.08, 0, 1.2, 0.16, 1.2);
  // Four separate walls expose the recessed water rather than a painted lid.
  frame(g, "basin-wall", C.stone, 0.34, 1.12, 0.2, 0.36);
  part(g, "water", C.water, 0, 0.36, 0, 0.715, 0.04, 0.715);
  for (const x of [-0.46, 0.46])
    for (const z of [-0.46, 0.46]) {
      part(g, "fence-post", C.wood, x, 1.02, z, 0.12, 1.12, 0.12);
      part(g, "post-cap", C.oak, x, 1.43, z, 0.18, 0.1, 0.18);
    }
  // Slab roof is borne by all four posts; no floating triangular canopy.
  part(g, "roof-slab", C.cobble, 0, 1.61, 0, 1.4, 0.12, 1.4);
  part(g, "roof-slab", C.stone, 0, 1.715, 0, 1.13, 0.09, 1.13);
  part(g, "bucket-rope", C.wood, 0, 1.0, 0, 0.035, 1.1, 0.035);
  part(g, "bucket", C.iron, 0, 0.55, 0, 0.2, 0.19, 0.2);
  for (const x of [-0.36, 0, 0.36]) {
    part(g, "cobble-pixel", C.cobble, x, 0.31, 0.569, 0.19, 0.11, 0.018);
    part(g, "cobble-pixel", C.cobble, 0.569, 0.36, x, 0.018, 0.12, 0.16);
  }
  return g;
}

export function blastFurnace(parent, animations = []) {
  const g = model(parent, "blast-furnace");
  part(g, "furnace-body", C.cobble, 0, 0.5, 0, 1, 1, 1);
  part(g, "stone-top", C.stone, 0, 0.969, 0, 0.77, 0.085, 0.77);
  for (const x of [-0.443, 0.443]) {
    part(g, "iron-band", C.iron, x, 0.5, 0.511, 0.105, 0.88, 0.024);
    part(g, "iron-band", C.iron, 0.511, 0.5, x, 0.024, 0.88, 0.105);
  }
  for (const y of [0.07, 0.54, 0.93]) {
    part(g, "iron-band", C.iron, 0, y, 0.523, 0.8, 0.085, 0.024);
    part(g, "iron-band", C.iron, 0.523, y, 0, 0.024, 0.085, 0.8);
  }
  part(g, "vent-recess", C.dark, 0, 0.745, 0.514, 0.6, 0.29, 0.027);
  for (const y of [0.65, 0.745, 0.84])
    part(g, "vent-grille", C.iron, 0, y, 0.538, 0.59, 0.025, 0.023);
  part(g, "fire-mouth", C.dark, 0, 0.285, 0.519, 0.6, 0.32, 0.034);
  fire(g, animations, 0.16, 0.545);
  part(g, "ash-lip", C.iron, 0, 0.119, 0.55, 0.64, 0.065, 0.09);
  return g;
}

export function storageBlock(parent, type) {
  const g = model(parent, type);
  if (type === "compost") {
    part(g, "bottom", C.wood, 0, 0.065, 0, 0.86, 0.13, 0.86);
    frame(g, "open-stave", C.oak, 0.47, 0.88, 0.13, 0.82);
    for (const y of [0.2, 0.65])
      frame(g, "wood-band", C.wood, y, 0.918, 0.055, 0.07);
    part(g, "compost", C.earth, 0, 0.365, 0, 0.61, 0.08, 0.61);
    for (const [x, z] of [
      [-0.15, -0.09],
      [0.13, 0.17],
      [0.12, -0.17],
    ])
      part(g, "leaf-scrap", "#71995b", x, 0.419, z, 0.15, 0.025, 0.11);
    return g;
  }
  const ender = type === "enderchest",
    shulker = type === "shulkerbox";
  const color = ender ? C.obsidian : shulker ? C.purple : C.oak;
  part(g, "chest-body", color, 0, 0.365, 0, 0.98, 0.73, 0.86);
  part(
    g,
    "lid-seam",
    ender ? C.dark : shulker ? "#786885" : C.wood,
    0,
    0.615,
    0,
    1.005,
    0.045,
    0.886,
  );
  if (shulker) {
    for (const x of [-0.43, 0.43])
      part(g, "shell-corner", "#786885", x, 0.435, 0.437, 0.1, 0.27, 0.02);
    part(g, "shell-recess", "#786885", 0, 0.385, 0.441, 0.31, 0.09, 0.025);
  } else {
    for (const x of [-0.44, 0.44])
      part(
        g,
        "chest-trim",
        ender ? C.dark : C.wood,
        x,
        0.375,
        0.437,
        0.08,
        0.7,
        0.025,
      );
    part(g, "latch", ender ? C.gold : C.iron, 0, 0.57, 0.47, 0.13, 0.23, 0.075);
    if (ender)
      for (const x of [-0.27, 0.27])
        part(g, "ender-inlay", "#6d9c86", x, 0.29, 0.451, 0.075, 0.075, 0.025);
  }
  return g;
}

export function piston(parent, animations = []) {
  const g = model(parent, "sticky-piston");
  part(g, "base", C.cobble, 0, 0.31, 0, 0.98, 0.62, 0.98);
  for (const x of [-0.427, 0.427])
    part(g, "iron-band", C.iron, x, 0.32, 0.499, 0.1, 0.58, 0.021);
  part(g, "piston-socket", C.dark, 0, 0.615, 0, 0.33, 0.035, 0.33);
  const shaft = part(g, "moving-shaft", C.wood, 0, 0.71, 0, 0.23, 0.22, 0.23);
  const head = group(g, 0, 0.87, 0);
  part(head, "piston-head", C.oak, 0, 0, 0, 0.98, 0.2, 0.98);
  part(head, "sticky-face", "#88ad61", 0, 0.111, 0, 0.81, 0.035, 0.81);
  for (const x of [-0.21, 0.21])
    part(head, "slime-pixel", "#a8c582", x, 0.133, -x, 0.17, 0.016, 0.2);
  animations.push((t) => {
    const extension = 0.13 + (Math.sin(t * 3) + 1) * 0.14;
    shaft.scale.y = extension;
    shaft.position.y = 0.59 + extension / 2;
    head.position.y = 0.69 + extension;
  });
  return g;
}

export function hopper(parent) {
  const g = model(parent, "hopper");
  part(g, "outlet-neck", C.cobble, 0, 0.13, 0, 0.26, 0.26, 0.26);
  part(g, "outlet", C.iron, 0.19, 0.1, 0, 0.3, 0.18, 0.2);
  part(g, "funnel-step", C.cobble, 0, 0.32, 0, 0.5, 0.18, 0.5);
  part(g, "funnel-step", C.iron, 0, 0.46, 0, 0.73, 0.12, 0.73);
  frame(g, "intake-rim", C.cobble, 0.62, 0.96, 0.13, 0.22);
  part(g, "open-intake", C.dark, 0, 0.535, 0, 0.7, 0.025, 0.7);
  return g;
}

export function redstonePlate(parent, type, animations = []) {
  const g = model(parent, type);
  part(g, "slab", C.stone, 0, 0.07, 0, 1.08, 0.14, 0.94);
  const torch = (x, z) => {
    part(g, "torch-stem", C.wood, x, 0.265, z, 0.055, 0.2, 0.055);
    return part(g, "torch-head", C.red, x, 0.36, z, 0.105, 0.11, 0.105);
  };
  if (type === "clock") {
    for (const z of [-0.27, 0.27])
      part(g, "redstone-wire", C.red, 0, 0.153, z, 0.7, 0.025, 0.055);
    for (const x of [-0.33, 0.33])
      part(g, "redstone-wire", C.red, x, 0.153, 0, 0.055, 0.025, 0.49);
    torch(-0.33, -0.27);
    const beat = torch(0.33, 0.27);
    animations.push((t) => {
      beat.visible = Math.floor(t * 2) % 2 === 0;
    });
    part(g, "clock-chip", C.cobble, 0, 0.21, 0, 0.27, 0.12, 0.29);
  } else {
    part(g, "redstone-wire", C.red, 0, 0.153, 0, 0.065, 0.025, 0.7);
    if (type === "repeater") {
      torch(0, 0.28);
      torch(0, -0.12);
      part(g, "delay-track", C.cobble, 0, 0.16, -0.21, 0.51, 0.035, 0.08);
      for (const x of [-0.22, 0.22])
        part(g, "delay-notch", C.red, x, 0.185, -0.21, 0.045, 0.025, 0.09);
    } else {
      torch(-0.25, 0.24);
      torch(0.25, 0.24);
      torch(0, -0.26);
      part(g, "compare-path", C.red, 0, 0.153, 0.24, 0.51, 0.025, 0.065);
    }
  }
  return g;
}

export function faceMachine(parent, type) {
  const g = model(parent, type);
  part(g, "machine-block", C.cobble, 0, 0.5, 0, 1, 1, 1);
  part(g, "face-plate", C.stone, 0, 0.5, 0.509, 0.84, 0.84, 0.023);
  if (type === "observer") {
    facePixels(
      g,
      C.dark,
      0.69,
      0.532,
      ["1100011", "1100011", "0000000", "0011100"],
      0.09,
      0.072,
    );
    part(g, "output-signal", C.red, 0, 0.51, -0.515, 0.23, 0.23, 0.033);
    // The top arrow connects the observing face to its redstone output.
    part(g, "direction-stem", C.dark, 0, 1.011, 0, 0.085, 0.022, 0.49);
    for (const x of [-0.09, 0.09])
      part(g, "direction-arrow", C.dark, x, 1.011, -0.17, 0.09, 0.022, 0.14);
  } else {
    facePixels(g, C.dark, 0.77, 0.532, ["1100011", "1100011"], 0.085, 0.071);
    part(g, "square-nozzle", C.cobble, 0, 0.42, 0.541, 0.43, 0.37, 0.065);
    part(g, "nozzle-opening", C.dark, 0, 0.42, 0.58, 0.25, 0.2, 0.025);
  }
  return g;
}

export function musicBlock(parent, type) {
  const g = model(parent, type);
  part(g, "music-body", C.wood, 0, 0.44, 0, 0.88, 0.88, 0.88);
  part(g, "music-top", C.oak, 0, 0.865, 0, 0.8, 0.045, 0.8);
  part(g, "speaker-face", C.oak, 0, 0.44, 0.449, 0.72, 0.69, 0.025);
  facePixels(
    g,
    C.wood,
    0.65,
    0.469,
    ["10101", "01010", "10101", "01010", "10101"],
    0.105,
    0.071,
  );
  if (type === "jukebox") {
    part(g, "record-slot", C.dark, 0, 0.899, 0, 0.5, 0.021, 0.095);
    part(g, "record-edge", C.dark, 0.03, 0.946, 0, 0.33, 0.075, 0.055);
    part(g, "record-label", C.red, 0.03, 0.951, 0.034, 0.095, 0.045, 0.016);
  } else {
    for (const x of [-0.2, 0.2])
      part(g, "top-grid", C.wood, x, 0.894, 0, 0.035, 0.022, 0.69);
    for (const z of [-0.2, 0.2])
      part(g, "top-grid", C.wood, 0, 0.909, z, 0.69, 0.022, 0.035);
  }
  return g;
}

export function railway(parent, animations = []) {
  const g = model(parent, "railway");
  for (let i = 0; i < 6; i++)
    part(g, "sleeper", C.wood, -1 + i * 0.4, 0.06, 0, 0.2, 0.12, 0.91);
  for (const z of [-0.28, 0.28])
    part(g, "rail", C.iron, 0, 0.145, z, 2.22, 0.06, 0.065);
  const cart = group(g, 0, 0.19, 0);
  part(cart, "cart-floor", C.dark, 0, 0.115, 0, 0.76, 0.13, 0.62);
  for (const x of [-0.23, 0.23])
    for (const z of [-0.28, 0.28])
      part(cart, "wheel", C.dark, x, 0.015, z, 0.16, 0.15, 0.12);
  for (const z of [-0.305, 0.305])
    part(cart, "cart-wall", C.iron, 0, 0.345, z, 0.82, 0.4, 0.09);
  for (const x of [-0.365, 0.365])
    part(cart, "cart-wall", C.cobble, x, 0.345, 0, 0.09, 0.4, 0.52);
  part(cart, "ore-cargo", C.stone, 0, 0.32, 0, 0.4, 0.17, 0.36);
  animations.push((t) => {
    cart.position.x = Math.sin(t * 0.8) * 0.65;
  });
  return g;
}

export function redstoneTorch(parent, lamp = false) {
  const g = model(parent, lamp ? "redstone-lamp" : "redstone-torch");
  if (lamp) {
    part(g, "lamp-block", C.wood, 0, 0.44, 0, 0.88, 0.88, 0.88);
    part(g, "lamp-face", C.gold, 0, 0.44, 0.449, 0.69, 0.69, 0.025);
    part(g, "lamp-face", C.gold, 0.449, 0.44, 0, 0.025, 0.69, 0.69);
    part(g, "lamp-top", C.gold, 0, 0.89, 0, 0.69, 0.025, 0.69);
    const on = part(g, "lamp-on", "#e6c773", 0, 0.44, 0.465, 0.58, 0.58, 0.022);
    on.material = mat("#e6c773", 0.4);
    const off = part(
      g,
      "lamp-off",
      "#886543",
      0,
      0.44,
      0.465,
      0.58,
      0.58,
      0.022,
    );
    off.visible = false;
    for (const a of [-0.2, 0.2]) {
      part(g, "lamp-grid", C.wood, a, 0.44, 0.469, 0.055, 0.75, 0.025);
      part(g, "lamp-grid", C.wood, 0, 0.44 + a, 0.483, 0.75, 0.055, 0.025);
      part(g, "lamp-grid", C.wood, 0.469, 0.44, a, 0.025, 0.75, 0.055);
      part(g, "lamp-grid", C.wood, 0.483, 0.44 + a, 0, 0.025, 0.055, 0.75);
    }
  } else {
    part(g, "torch-stem", C.wood, 0, 0.36, 0, 0.13, 0.72, 0.13);
    part(g, "torch-head", C.red, 0, 0.78, 0, 0.21, 0.22, 0.21);
    part(g, "torch-hot-pixel", C.gold, 0, 0.82, 0.111, 0.1, 0.1, 0.02);
  }
  return g;
}

export function smithingTable(parent) {
  const g = model(parent, "smithing-table");
  part(g, "wooden-body", "#665c48", 0, 0.43, 0, 1, 0.86, 1);
  part(g, "iron-top", C.dark, 0, 0.92, 0, 1.04, 0.12, 1.04);
  part(g, "work-plate", C.iron, -0.18, 0.989, 0.08, 0.5, 0.025, 0.47);
  for (const x of [-0.37, 0.37])
    part(g, "table-post", C.wood, x, 0.43, 0.511, 0.12, 0.84, 0.025);
  part(g, "hanging-hammer", C.iron, -0.16, 0.67, 0.54, 0.28, 0.11, 0.08);
  part(g, "hammer-handle", C.oak, -0.16, 0.44, 0.541, 0.065, 0.39, 0.055);
  for (const x of [0.19, 0.28])
    part(g, "tongs", C.iron, x, 0.52, 0.54, 0.04, 0.37, 0.065);
  part(g, "netherite-ingot", C.obsidian, 0.19, 1.023, -0.13, 0.26, 0.09, 0.18);
  return g;
}

export function powerMachine(parent, type, animations = []) {
  const g = model(parent, type);
  const crank = type === "crank";
  part(g, "foundation", C.cobble, 0, 0.09, 0, crank ? 1.08 : 1.7, 0.18, 0.94);
  part(
    g,
    "power-housing",
    C.iron,
    crank ? -0.1 : -0.17,
    0.52,
    -0.12,
    crank ? 0.64 : 1.16,
    0.68,
    0.61,
  );
  part(
    g,
    "output-terminal",
    C.red,
    crank ? -0.32 : -0.57,
    0.58,
    0.208,
    0.14,
    0.18,
    0.08,
  );
  if (!crank)
    for (let j = 0; j < 5; j++)
      part(
        g,
        "coil-rib",
        C.wood,
        -0.59 + j * 0.2,
        0.58,
        0.208,
        0.07,
        0.49,
        0.065,
      );
  const wheel = group(g, crank ? 0.12 : 0.66, 0.61, crank ? 0.39 : -0.1);
  if (crank) {
    part(g, "axle", C.dark, 0.12, 0.61, 0.2, 0.105, 0.105, 0.49);
    frame(wheel, "crank-frame", C.wood, 0, 0.66, 0.09, 0.1);
    // The square frame above lies flat by construction; orient the entire wheel
    // into the vertical plane, then rotate its local Y axis around the axle.
    wheel.rotation.x = Math.PI / 2;
    part(wheel, "spoke", C.iron, 0, 0, 0, 0.07, 0.08, 0.59);
    part(wheel, "spoke", C.iron, 0, 0, 0, 0.59, 0.08, 0.07);
    part(wheel, "handgrip", C.oak, 0.27, -0.14, 0.27, 0.08, 0.28, 0.08);
    animations.push((t) => {
      wheel.rotation.y = -t * 1.3;
    });
  } else {
    part(wheel, "axle", C.dark, -0.03, 0, 0, 0.49, 0.13, 0.13);
    const rotor = group(wheel, 0.08, 0, 0);
    part(rotor, "rotor", C.wood, 0, 0, 0, 0.08, 0.5, 0.11);
    part(rotor, "rotor", C.wood, 0, 0, 0, 0.08, 0.11, 0.5);
    animations.push((t) => {
      rotor.rotation.x = t * 2;
    });
  }
  return g;
}

export function magicFacility(parent, type, animations = []) {
  const g = model(parent, type);
  if (type === "beacon") {
    part(g, "iron-pyramid", C.iron, 0, 0.09, 0, 1.48, 0.18, 1.48);
    part(g, "iron-pyramid", C.iron, 0, 0.25, 0, 1.05, 0.14, 1.05);
    part(g, "obsidian-base", C.obsidian, 0, 0.385, 0, 0.74, 0.13, 0.74);
    const glass = "#b4dbbf";
    frame(g, "glass-frame", glass, 0.47, 0.71, 0.045, 0.045);
    frame(g, "glass-frame", glass, 0.97, 0.71, 0.045, 0.045);
    for (const x of [-0.334, 0.334])
      for (const z of [-0.334, 0.334])
        part(g, "glass-upright", glass, x, 0.72, z, 0.043, 0.5, 0.043);
    part(g, "beacon-core", "#76c4ba", 0, 0.71, 0, 0.41, 0.41, 0.41).material =
      mat("#76c4ba", 0.35);
    beaconLight(g, animations);
    return g;
  }
  if (type === "crystal") {
    part(
      g,
      "bedrock-base",
      C.cobble,
      0,
      0.12,
      0,
      1.05,
      0.24,
      1.05,
      "blackstone",
    );
    part(g, "obsidian-stem", C.obsidian, 0, 0.47, 0, 0.66, 0.48, 0.66);
    const crystal = group(g, 0, 1.29, 0);
    crystal.userData.facilityPart = "crystal-cage";
    const pale = "#d5c6df";
    frame(crystal, "crystal-frame", pale, -0.34, 0.73, 0.052, 0.052);
    frame(crystal, "crystal-frame", pale, 0.34, 0.73, 0.052, 0.052);
    for (const x of [-0.339, 0.339])
      for (const z of [-0.339, 0.339])
        part(crystal, "crystal-frame", pale, x, 0, z, 0.052, 0.63, 0.052);
    const core = part(
      crystal,
      "crystal-core",
      "#dc86b8",
      0,
      0,
      0,
      0.33,
      0.33,
      0.33,
    );
    core.material = mat("#dc86b8", 0.4);
    core.rotation.z = Math.PI / 4;
    part(g, "crystal-fire", "#b2a0d0", 0, 0.733, 0, 0.58, 0.06, 0.58).material =
      mat("#b2a0d0", 0.25);
    animations.push((t) => {
      crystal.rotation.y = t * 0.4;
      crystal.position.y = 1.29 + Math.sin(t) * 0.08;
    });
    return g;
  }
  if (type === "brew") {
    part(g, "brewing-base", C.cobble, 0, 0.09, 0, 0.84, 0.18, 0.75);
    for (const [x, z] of [
      [-0.42, 0.28],
      [0.42, 0.28],
      [0, -0.36],
    ])
      part(g, "stand-foot", C.cobble, x, 0.09, z, 0.3, 0.18, 0.31);
    part(g, "blaze-rod", C.gold, 0, 0.66, 0, 0.12, 1.0, 0.12);
    part(g, "bottle-rack", C.dark, 0, 0.82, 0.1, 0.88, 0.07, 0.07);
    part(g, "bottle-rack", C.dark, 0, 0.82, -0.14, 0.07, 0.07, 0.44);
    for (const [x, z] of [
      [-0.37, 0.2],
      [0.37, 0.2],
      [0, -0.32],
    ]) {
      part(g, "potion-bottle", "#a3bca6", x, 0.335, z, 0.23, 0.31, 0.23);
      part(
        g,
        "dragon-breath",
        "#c299c9",
        x,
        0.295,
        z + 0.124,
        0.17,
        0.17,
        0.022,
      );
      part(g, "bottle-neck", "#a3bca6", x, 0.565, z, 0.09, 0.15, 0.09);
      part(g, "bottle-stopper", C.wood, x, 0.665, z, 0.105, 0.06, 0.105);
    }
    return g;
  }
  // Enchanting tables keep the iconic squat obsidian body and floating book.
  part(g, "obsidian-body", C.obsidian, 0, 0.32, 0, 1, 0.64, 1);
  part(g, "red-cloth", "#aa4f4c", 0, 0.656, 0, 1.03, 0.045, 1.03, "cloth");
  for (const x of [-0.4575, 0.4575])
    for (const z of [-0.4575, 0.4575])
      part(g, "diamond-corner", "#6ebbae", x, 0.6, z, 0.14, 0.18, 0.14);
  const book = group(g, 0, 1.0, 0);
  for (const side of [-1, 1]) {
    const leaf = group(book, side * 0.18, 0, 0);
    leaf.rotation.z = side * 0.22;
    part(leaf, "book-cover", C.wood, 0, 0, 0, 0.35, 0.035, 0.47);
    part(leaf, "book-pages", "#f8edcf", 0, 0.035, 0, 0.31, 0.055, 0.42);
  }
  part(book, "book-spine", C.gold, 0, -0.025, 0, 0.05, 0.06, 0.46);
  animations.push((t) => {
    book.position.y = 1 + Math.sin(t * 0.8) * 0.035;
    book.rotation.y = Math.sin(t * 0.35) * 0.1;
  });
  return g;
}

export function craftingTable(parent) {
  const g = model(parent, "crafting-table");
  part(g, "crafting-block", C.oak, 0, 0.48, 0, 0.96, 0.96, 0.96);
  for (const x of [-0.402, 0.402])
    part(g, "leg-print", C.wood, x, 0.48, 0.49, 0.1, 0.95, 0.025);
  part(g, "worktop", C.wood, 0, 0.969, 0, 0.99, 0.04, 0.99);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      part(
        g,
        "crafting-grid-cell",
        C.oak,
        x * 0.235,
        0.996,
        z * 0.235,
        0.2,
        0.022,
        0.2,
      );
  part(g, "saw-blade", C.iron, -0.12, 0.6, 0.511, 0.08, 0.32, 0.023);
  part(g, "saw-handle", C.wood, -0.12, 0.79, 0.524, 0.19, 0.07, 0.04);
  part(g, "hammer-print", C.iron, 0.18, 0.71, 0.516, 0.25, 0.105, 0.025);
  part(g, "hammer-handle", C.wood, 0.18, 0.51, 0.526, 0.055, 0.29, 0.03);
  return g;
}

export function technicalBlock(parent, type) {
  const g = model(parent, type);
  if (type === "eye") {
    part(g, "survey-base", C.stone, 0, 0.11, 0, 1.1, 0.22, 0.82);
    part(g, "survey-pedestal", C.cobble, 0, 0.49, 0, 0.53, 0.56, 0.4);
    part(g, "eye-tablet", "#83968b", 0, 0.97, 0, 0.95, 0.67, 0.24);
    part(g, "eye-rim", "#b4ceb0", 0, 0.97, 0.135, 0.71, 0.5, 0.05);
    part(g, "eye-iris", "#6d9c86", 0, 0.97, 0.172, 0.43, 0.43, 0.04);
    part(g, "eye-pupil", C.dark, 0, 0.97, 0.199, 0.135, 0.32, 0.02);
    part(g, "eye-highlight", "#f8edcf", -0.18, 1.09, 0.209, 0.08, 0.08, 0.02);
    return g;
  }
  part(g, "command-body", "#c78760", 0, 0.5, 0, 1, 1, 1, "stone");
  for (const side of [-1, 1]) {
    part(
      g,
      "command-border",
      "#e4b283",
      side * 0.434,
      0.5,
      0.512,
      0.1,
      0.88,
      0.025,
    );
    part(
      g,
      "command-border",
      "#e4b283",
      0,
      0.5 + side * 0.434,
      0.513,
      0.77,
      0.1,
      0.025,
    );
  }
  part(g, "command-panel", "#b4a99b", 0, 0.5, 0.516, 0.55, 0.55, 0.028);
  facePixels(
    g,
    "#74615b",
    0.635,
    0.542,
    ["11010", "01001", "10110", "01010"],
    0.09,
    0.065,
  );
  part(g, "command-side", "#b4a99b", 0.514, 0.5, 0, 0.028, 0.56, 0.56);
  for (const z of [-0.16, 0, 0.16])
    part(
      g,
      "command-routing",
      "#74615b",
      0.536,
      0.5,
      z,
      0.019,
      0.11 + Math.abs(z),
      0.065,
    );
  return g;
}

export const FACILITY_TYPES = new Set([
  "well",
  "furnace",
  "compost",
  "chest",
  "shulkerbox",
  "enderchest",
  "piston",
  "hopper",
  "clock",
  "repeater",
  "comparator",
  "observer",
  "dispenser",
  "jukebox",
  "note",
  "rail",
  "torch",
  "lamp",
  "forge",
  "crank",
  "motor",
  "beacon",
  "crystal",
  "brew",
  "enchant",
  "workbench",
  "eye",
  "command",
]);
export function blockFacility(parent, type, animations = []) {
  if (type === "well") return waterWell(parent);
  if (type === "furnace") return blastFurnace(parent, animations);
  if (["compost", "chest", "shulkerbox", "enderchest"].includes(type))
    return storageBlock(parent, type);
  if (type === "piston") return piston(parent, animations);
  if (type === "hopper") return hopper(parent);
  if (["clock", "repeater", "comparator"].includes(type))
    return redstonePlate(parent, type, animations);
  if (["observer", "dispenser"].includes(type))
    return faceMachine(parent, type);
  if (["jukebox", "note"].includes(type)) return musicBlock(parent, type);
  if (type === "rail") return railway(parent, animations);
  if (["torch", "lamp"].includes(type))
    return redstoneTorch(parent, type === "lamp");
  if (type === "forge") return smithingTable(parent);
  if (["crank", "motor"].includes(type))
    return powerMachine(parent, type, animations);
  if (["beacon", "crystal", "brew", "enchant"].includes(type))
    return magicFacility(parent, type, animations);
  if (type === "workbench") return craftingTable(parent);
  if (["eye", "command"].includes(type)) return technicalBlock(parent, type);
  return null;
}
