import { cube as flatCube, group, mat, blockBox } from "./models.js";
import { COLLECTION_BY_ID } from "./collection.js";
import { STUDIO_ANCHORS as A } from "./studio-layout.js";
import { ensureStudio, studioSpec } from "./studio-placement.js";

// Furniture, woven banners and bare metal each keep their own pixel surface.
const timber = new Set([
  "#966f46",
  "#bd9a66",
  "#665c48",
  "#a58a62",
  "#957a53",
  "#597c68",
  "#8b695c",
  "#d8c5a0",
  "#b89a65",
]);
const metal = new Set([
  "#527975",
  "#b07b52",
  "#35484b",
  "#26383c",
  "#364e52",
  "#b4b9ad",
]);
function cube(g, color, ...v) {
  const kind = timber.has(color) ? "wood" : metal.has(color) ? "iron" : null;
  return kind ? blockBox(g, kind, color, ...v) : flatCube(g, color, ...v);
}
function section(parent, id, anchor = { x: 0, z: 0 }, state = null) {
  const key = COLLECTION_BY_ID[id]?.slot,
    spec = studioSpec(key);
  const p = state?.studio?.placements?.[key] || spec?.default || anchor;
  // Full-wall material stays attached to the wall. Other furniture uses its
  // saved transform; no scaled parent changes the proportions of its details.
  const g = group(
    parent,
    key === "studioWall" ? 0 : p.x,
    0,
    key === "studioWall" ? 0 : p.z,
  );
  g.rotation.y = ((p.rotation || 0) * Math.PI) / 2;
  g.userData.studioDecoration = id;
  g.userData.studioEntity = key;
  g.userData.studioKey = key;
  if (state?.studio && !state.studio.placements[key]) g.removeFromParent();
  return g;
}
function pixelWord(g, word, x, y, z, color, step = 0.026) {
  const letters = {
    L: ["100", "100", "100", "100", "111"],
    I: ["111", "010", "010", "010", "111"],
    V: ["101", "101", "101", "101", "010"],
    E: ["111", "100", "110", "100", "111"],
  };
  [...word].forEach((letter, i) => {
    letters[letter].forEach((row, r) =>
      [...row].forEach((cell, c) => {
        if (cell === "1")
          cube(
            g,
            color,
            x + (i * 4 + c) * step,
            y - r * step,
            z,
            step * 0.82,
            step * 0.82,
            0.012,
          );
      }),
    );
  });
}

export function decorateStudio(parent, state) {
  if (state) ensureStudio(state);
  const slots = state?.scenery?.equipped || {},
    get = (slot) => COLLECTION_BY_ID[slots[slot]],
    root = group(parent);
  const desk = get("studioDesk");
  if (desk) {
    const g = section(root, desk.id, A.desk, state);
    // A cabinet, front joinery and instruments make this a piece of furniture.
    blockBox(
      g,
      desk.index ? "iron" : "wood",
      desk.color,
      0,
      0.883,
      0,
      1.48,
      0.03,
      0.61,
    );
    for (const x of [-0.725, 0.725])
      blockBox(
        g,
        desk.index ? "iron" : "log",
        desk.index ? "#a78558" : "#795b3e",
        x,
        0.873,
        0,
        0.04,
        0.055,
        0.64,
      );
    if (!desk.index) {
      for (const x of [-0.61, 0.61]) {
        cube(g, "#966f46", x, 0.55, 0.04, 0.24, 0.5, 0.51);
        for (const y of [0.43, 0.6, 0.75]) {
          cube(g, "#bd9a66", x, y, 0.305, 0.2, 0.125, 0.025);
          cube(g, "#5d6350", x, y, 0.325, 0.08, 0.02, 0.025);
        }
      }
      cube(g, "#665c48", -0.49, 0.935, 0.07, 0.19, 0.075, 0.25);
      cube(g, "#dfcda0", -0.49, 0.979, 0.05, 0.145, 0.02, 0.17);
      for (let i = 0; i < 3; i++)
        cube(
          g,
          "#7d9872",
          -0.49,
          0.991,
          -0.005 + i * 0.045,
          0.11,
          0.007,
          0.012,
        );
    } else {
      for (const x of [-0.61, 0.61]) {
        cube(g, "#527975", x, 0.56, 0.025, 0.24, 0.52, 0.5);
        cube(g, "#b07b52", x, 0.56, 0.285, 0.2, 0.43, 0.035);
        for (let j = 0; j < 5; j++)
          cube(g, "#35484b", x, 0.43 + j * 0.055, 0.31, 0.13, 0.018, 0.018);
        for (const y of [0.375, 0.76])
          cube(g, "#c8b981", x, y, 0.31, 0.025, 0.025, 0.02);
      }
      cube(g, "#35484b", 0.48, 0.919, 0.09, 0.33, 0.055, 0.29);
      for (let j = 0; j < 4; j++) {
        cube(g, "#86b4a2", 0.37 + j * 0.073, 0.954, 0.05, 0.035, 0.025, 0.035);
        cube(g, "#182f34", 0.37 + j * 0.073, 0.95, 0.14, 0.018, 0.02, 0.085);
        cube(
          g,
          "#d5b277",
          0.37 + j * 0.073,
          0.971,
          0.11 + (j % 2) * 0.045,
          0.038,
          0.018,
          0.024,
        );
      }
    }
  }
  const wall = get("studioWall");
  if (wall) {
    const g = section(root, wall.id, undefined, state);
    g.position.z += 0.032;
    g.userData.studioWallFace = "back";
    g.userData.dynamic = true;
    for (let j = 0; j < 18; j++) {
      const x = -2.7 + j * 0.318;
      blockBox(
        g,
        wall.index ? "purpur" : "wood",
        wall.color,
        x,
        1.22,
        -2.306,
        0.22,
        1.58,
        0.026,
      );
      if (wall.index) {
        for (const y of [0.58, 1.07, 1.58]) {
          cube(
            g,
            j % 2 ? "#aa94bb" : "#6c697f",
            x,
            y,
            -2.279,
            0.145,
            0.28,
            0.026,
          );
          cube(g, "#c4b9d0", x - 0.04, y + 0.07, -2.26, 0.025, 0.1, 0.012);
        }
      } else {
        cube(g, "#456653", x, 0.63 + (j % 3) * 0.31, -2.279, 0.13, 0.13, 0.025);
        cube(
          g,
          "#a3b67d",
          x + 0.07,
          0.72 + (j % 3) * 0.31,
          -2.274,
          0.055,
          0.075,
          0.032,
        );
      }
    }
    for (const x of [-0.54, 0.54]) {
      cube(
        g,
        wall.index ? "#b8a1ca" : "#203e3b",
        x,
        1.64,
        -2.262,
        0.23,
        0.23,
        0.045,
      );
      cube(
        g,
        wall.index ? "#e0d4ec" : "#bca361",
        x,
        1.64,
        -2.231,
        0.065,
        0.065,
        0.025,
      );
    }
  }
  const sign = get("studioSign");
  if (sign) {
    const g = section(root, sign.id, A.sign, state);
    cube(g, "#26383c", 0, 2.112, 0, 1.11, 0.255, 0.095);
    blockBox(
      g,
      sign.index ? "iron" : "wood",
      sign.color,
      0,
      2.112,
      0.052,
      1.03,
      0.2,
      0.025,
    );
    pixelWord(g, "LIVE", -0.198, 2.166, 0.074, "#fff0ce");
    for (const x of [-0.505, 0.505]) {
      cube(
        g,
        sign.index ? "#bfe6df" : "#d2ac6d",
        x,
        2.112,
        0.074,
        0.035,
        0.12,
        0.02,
      );
      if (sign.index) {
        const led = cube(
          g,
          "#80cbbf",
          x * 0.78,
          2.112,
          0.074,
          0.075,
          0.075,
          0.025,
        );
        led.material = mat("#80cbbf", 0.22);
      }
    }
    if (!sign.index) {
      cube(g, "#8c554b", -0.585, 2.02, -0.018, 0.025, 0.32, 0.026);
      cube(g, "#c5604f", -0.585, 1.865, 0.018, 0.09, 0.075, 0.07);
    }
  }
  const shelf = get("studioShelf");
  if (shelf) {
    const g = section(root, shelf.id, A.shelf, state);
    for (const z of [-0.51, 0.51])
      blockBox(
        g,
        shelf.index ? "iron" : "log",
        shelf.color,
        0,
        0.32,
        z,
        0.15,
        0.24,
        0.12,
      );
    for (const z of [-0.51, 0.51])
      blockBox(
        g,
        shelf.index ? "iron" : "log",
        shelf.color,
        -0.025,
        1.2,
        z,
        0.08,
        1.59,
        0.07,
      );
    for (const [index, y] of [0.53, 1.03, 1.53].entries()) {
      blockBox(
        g,
        shelf.index ? "iron" : "wood",
        shelf.color,
        0,
        y,
        0,
        0.22,
        0.055,
        1.11,
      );
      for (let j = 0; j < 3; j++) {
        const z = -0.37 + j * 0.37;
        if (!shelf.index) {
          cube(
            g,
            ["#957a53", "#597c68", "#8b695c"][(j + index) % 3],
            0.01,
            y + 0.12,
            z,
            0.15,
            0.18 + (j % 2) * 0.04,
            0.21,
          );
          for (let book = 0; book < 3; book++)
            cube(
              g,
              "#d6c6a0",
              0.094,
              y + 0.15,
              z - 0.065 + book * 0.065,
              0.018,
              0.075,
              0.018,
            );
        } else {
          cube(g, "#b4b9ad", 0, y + 0.055, z, 0.175, 0.045, 0.25);
          cube(g, "#364e52", -0.065, y + 0.17, z, 0.022, 0.2, 0.24);
          cube(
            g,
            ["#a68dba", "#75b7a3", "#cfa068"][(index + j) % 3],
            0.025,
            y + 0.155,
            z,
            0.12,
            0.16,
            0.11,
          );
          cube(g, "#d4d1c4", 0.02, y + 0.264, z, 0.07, 0.075, 0.065);
          cube(g, "#80b2a9", 0.112, y + 0.09, z, 0.022, 0.028, 0.1);
        }
      }
    }
  }
  const flag = get("flag");
  if (flag) {
    const g = section(root, flag.id, undefined, state);
    cube(g, "#b89a65", 0, 2.01, 0, 0.45, 0.045, 0.055);
    blockBox(g, "cloth", flag.color, 0, 1.8, 0.018, 0.38, 0.38, 0.035);
    const ink = ["#ecd5a2", "#765541", "#4a4263"][flag.index];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        const on =
          flag.index === 0
            ? c === 2 || (r % 2 && Math.abs(c - 2) === 1)
            : flag.index === 1
              ? Math.max(Math.abs(c - 2), Math.abs(r - 2)) === 2 &&
                (c + r) % 2 === 0
              : c === r || c + r === 4;
        if (on)
          cube(
            g,
            ink,
            (c - 2) * 0.055,
            1.8 + (2 - r) * 0.055,
            0.041,
            0.048,
            0.048,
            0.012,
          );
      }
  }
  // Owned variants remain tangible collectibles even when another style is on.
  const samples = Object.keys(state?.scenery?.owned || {}).filter(
    (id) =>
      state.scenery.owned[id] &&
      ["studio", "flag"].includes(COLLECTION_BY_ID[id]?.category),
  );
  {
    const cabinet = group(root);
    cabinet.userData.studioCollectionCabinet = true;
    for (const y of [0.52, 0.88, 1.24, 1.6])
      cube(cabinet, "#a58a62", -2.68, y, -0.31, 0.28, 0.035, 1.7);
    for (const z of [-1.18, 0.57])
      cube(cabinet, "#665c48", -2.73, 0.915, z, 0.07, 1.43, 0.06);
    for (const id of samples) {
      const item = COLLECTION_BY_ID[id],
        key = "collectible:" + id,
        spec = studioSpec(key),
        p = state.studio.placements[key] || spec.default,
        sample = group(root, p.x, spec.y, p.z);
      sample.userData.studioKey = key;
      sample.userData.studioEntity = key;
      sample.userData.studioCollectible = id;
      cube(sample, "#d8c5a0", 0, -0.135, 0, 0.22, 0.035, 0.24);
      // Each owned variant is a miniature of its real furniture, not a color token.
      if (item.slot === "studioDesk") {
        for (const x of [-0.067, 0.067])
          for (const z of [-0.055, 0.055])
            blockBox(
              sample,
              item.index ? "iron" : "wood",
              item.index ? "#527975" : "#665c48",
              x,
              -0.06,
              z,
              0.02,
              0.115,
              0.02,
            );
        blockBox(
          sample,
          item.index ? "iron" : "wood",
          item.color,
          0,
          0.008,
          0,
          0.18,
          0.02,
          0.15,
        );
        cube(sample, "#334b49", 0, 0.035, -0.025, 0.025, 0.04, 0.025);
        cube(sample, "#334b49", 0, 0.075, -0.025, 0.11, 0.075, 0.025);
        cube(sample, "#9ebca0", 0, 0.075, -0.009, 0.08, 0.05, 0.01);
        cube(sample, "#d8c5a0", -0.017, 0.026, 0.035, 0.075, 0.015, 0.036);
        if (item.index)
          for (let j = 0; j < 3; j++)
            cube(
              sample,
              "#d3ad73",
              0.07,
              -0.035 - j * 0.024,
              0.065,
              0.025,
              0.012,
              0.014,
            );
      } else if (item.slot === "studioWall") {
        for (let j = 0; j < 4; j++) {
          const x = -0.066 + j * 0.044;
          blockBox(
            sample,
            item.index ? "purpur" : "wood",
            item.color,
            x,
            -0.003,
            -0.015,
            0.04,
            0.23,
            0.05,
          );
          for (let r = 0; r < 2; r++)
            cube(
              sample,
              item.index ? "#c1a7d6" : "#a5b980",
              x,
              -0.055 + r * 0.105 + (j % 2) * 0.02,
              0.018,
              0.025,
              item.index ? 0.05 : 0.025,
              0.018,
            );
        }
      } else if (item.slot === "flag") {
        cube(sample, "#665c48", -0.07, 0.001, 0, 0.02, 0.235, 0.025);
        cube(sample, "#b89a65", 0, 0.106, 0, 0.17, 0.02, 0.025);
        blockBox(
          sample,
          "cloth",
          item.color,
          0.007,
          0.041,
          0.011,
          0.13,
          0.12,
          0.016,
        );
        const ink = ["#ecd5a2", "#765541", "#4a4263"][item.index];
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++)
            if (
              item.index === 0
                ? c === 1 || r === 1
                : item.index === 1
                  ? (c + r) % 2 === 0
                  : c === r || c + r === 2
            )
              cube(
                sample,
                ink,
                0.007 + (c - 1) * 0.032,
                0.041 + (1 - r) * 0.032,
                0.025,
                0.026,
                0.026,
                0.01,
              );
      } else if (item.slot === "studioSign") {
        for (const x of [-0.065, 0.065])
          cube(sample, "#334b49", x, -0.037, 0, 0.018, 0.16, 0.025);
        cube(sample, "#334b49", 0, 0.065, 0, 0.19, 0.09, 0.038);
        cube(sample, item.color, 0, 0.065, 0.025, 0.168, 0.067, 0.012);
        for (let j = 0; j < 4; j++)
          cube(
            sample,
            item.index ? "#b0ded4" : "#edc794",
            -0.057 + j * 0.038,
            0.065,
            0.036,
            0.02,
            0.035,
            0.008,
          );
      } else {
        for (const x of [-0.082, 0.082])
          blockBox(
            sample,
            item.index ? "purpur" : "wood",
            item.color,
            x,
            0.004,
            0,
            0.019,
            0.24,
            0.085,
          );
        for (let r = 0; r < 3; r++) {
          const y = -0.105 + r * 0.093;
          blockBox(
            sample,
            item.index ? "purpur" : "wood",
            item.color,
            0,
            y,
            0,
            0.17,
            0.018,
            0.105,
          );
          for (let j = 0; j < 3; j++) {
            cube(
              sample,
              ["#c5ac7b", "#8aae97", "#ad9bbe"][(j + r) % 3],
              -0.05 + j * 0.05,
              y + 0.039,
              0,
              0.03,
              0.058,
              0.07,
            );
            if (item.index)
              cube(
                sample,
                "#dfd2ad",
                -0.05 + j * 0.05,
                y + 0.075,
                0,
                0.019,
                0.014,
                0.036,
              );
          }
        }
      }
    }
  }
  return root;
}
