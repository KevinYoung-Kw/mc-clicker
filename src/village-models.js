import { studioWeatherWindow } from './weather-window.js';
import { cube as plainCube, group, P, blockBox } from "./models.js";
import { STUDIO, STUDIO_ANCHORS as A } from "./studio-layout.js";
import { decorateStudio } from "./studio-decoration.js";
import { ensureStudio, studioSpec } from "./studio-placement.js";
import { studioDeviceModel, studioScreen } from "./studio-device-models.js";

// Structural materials are explicit: skin/screen/emission details remain flat.
function cube(g, color, ...v) {
  const kind = ["#858c80", "#b4a287", "#727f79", "#747e78"].includes(color)
    ? "cobblestone"
    : [
          "#966f46",
          "#b58a55",
          "#665c48",
          "#977054",
          "#bc966a",
          "#a48156",
          "#a27b51",
          "#bf9a67",
          "#66513c",
          "#b59661",
          "#c3b58e",
          "#d1b88d",
          "#684a39",
          "#866247",
        ].includes(color)
      ? "wood"
      : ["#374647", "#26383c", "#455b55"].includes(color)
        ? "iron"
        : null;
  return kind ? blockBox(g, kind, color, ...v) : plainCube(g, color, ...v);
}
function roof(g, w, d, y, color, thickness = .16) {
  for (let j = 0; j < 4; j++)
    cube(g, color, 0, y + j * 0.14, 0, w - j * 0.24, thickness, d + 0.12).userData.weatherSurface = true;
}
function windows(g, w, y, z) {
  for (const x of [-w * 0.29, w * 0.29]) {
    cube(g, "#4c645d", x, y, z, 0.27, 0.34, 0.035);
    const window = cube(g, "#a2ccc4", x, y + 0.025, z + 0.021, 0.2, 0.24, 0.018);
    window.userData.windowGlow=true;
    cube(g, P.wood, x, y, z + 0.032, 0.035, 0.3, 0.025);
  }
}
export function cottage(parent, variant = 0) {
  const g = group(parent),
    stone = ["#858c80", "#b4a287", "#727f79"][variant % 3],
    timber = ["#966f46", "#b58a55", "#665c48"][variant % 3];
  cube(g, stone, 0, 0.14, 0, 1.12, 0.28, 0.96);
  cube(g, variant === 1 ? "#d1b88d" : "#c3b58e", 0, 0.65, 0, 1, 0.84, 0.9);
  for (const x of [-0.46, 0.46])
    for (const z of [-0.39, 0.39])
      blockBox(g, "log", timber, x, 0.62, z, 0.15, 0.96, 0.15);
  roof(g, 1.25, 1.05, 1.14, timber, .14);
  cube(g, "#574835", 0, 0.5, 0.47, 0.26, 0.65, 0.06);
  for (const y of [0.31, 0.64])
    blockBox(g, "wood", timber, 0, y, 0.506, 0.185, 0.2, 0.018);
  cube(g, "#d1b06e", 0.07, 0.52, 0.522, 0.035, 0.035, 0.018);
  windows(g, 1, 0.83, 0.466);
  cube(g, stone, 0, 0.06, 0.6, 0.5, 0.12, 0.3);
  if (variant === 1) {
    for (let j = 0; j < 3; j++)
      cube(g, "#c7a758", -0.42 + j * 0.3, 0.1, 0.68, 0.22, 0.19, 0.22);
  } else if (variant === 2) {
    cube(g, stone, 0.34, 1.43, -0.22, 0.24, 0.8, 0.24);
    cube(g, "#484940", 0.34, 1.86, -0.22, 0.29, 0.08, 0.29);
  }
  return g;
}
export function villageBuilding(parent, id, animations) {
  const g = group(parent);
  if (id === "V11") {
    cube(g, "#858c80", 0, 0.1, 0, 1.4, 0.2, 1.15);
    cube(g, "#c3b58e", 0, 0.74, -0.15, 1.25, 1.2, 0.8);
    roof(g, 1.55, 1.3, 1.4, "#966f46");
    for (const x of [-0.65, 0.65])
      cube(g, P.wood, x, 0.7, 0.39, 0.13, 1.35, 0.13);
    for (let y = 0; y < 3; y++) {
      cube(g, P.wood, 0, 0.35 + y * 0.29, 0.31, 1.25, 0.06, 0.27);
      for (let x = 0; x < 7; x++)
        cube(
          g,
          ["#9b5548", "#7c9570", "#c2a75e", "#6b8794"][x % 4],
          -0.52 + x * 0.17,
          0.47 + y * 0.29,
          0.38,
          0.115,
          0.21,
          0.18,
        );
    }
    cube(g, P.wood, 0, 0.43, 0.67, 0.7, 0.1, 0.3);
    for (const x of [-0.27, 0.27])
      cube(g, P.wood, x, 0.22, 0.67, 0.075, 0.44, 0.075);
    cube(g, "#665c48", 0.35, 1.83, -0.08, 0.17, 0.055, 0.35);
    cube(g, "#dfd1ac", 0.35, 1.87, -0.08, 0.135, 0.025, 0.29);
  } else if (id === "V14") {
    cube(g, "#858c80", 0, 0.2, 0, 1.1, 0.4, 1.1);
    for (const x of [-0.38, 0.38])
      for (const z of [-0.38, 0.38])
        cube(g, P.wood, x, 0.95, z, 0.18, 1.5, 0.18);
    roof(g, 1.25, 1.1, 1.78, "#665c48");
    cube(g, "#665c48", 0, 1.61, 0, 0.87, 0.14, 0.14);
    cube(g, "#8b7d59", 0, 1.49, 0, 0.085, 0.18, 0.085);
    const bell = group(g, 0, 1.22, 0);
    cube(bell, "#cfaa4f", 0, 0, 0, 0.45, 0.42, 0.43);
    cube(bell, "#debd64", 0, -0.23, 0, 0.57, 0.08, 0.52);
    cube(bell, "#775f34", 0, -0.275, 0, 0.43, 0.014, 0.38);
    cube(bell, "#c6a34c", 0, -0.32, 0, 0.075, 0.12, 0.075);
    animations.push((t) => (bell.rotation.z = Math.sin(t * 0.8) * 0.06));
  } else {
    const colors =
      id === "V3" ? ["#9c5c43", "#dfcaa0"] : ["#5e8792", "#d1ccb0"];
    cube(g, "#858c80", 0, 0.08, 0, 1.5, 0.16, 1.2);
    for (const x of [-0.64, 0.64])
      for (const z of [-0.42, 0.42])
        cube(g, P.wood, x, 0.7, z, 0.12, 1.3, 0.12);
    for (let j = 0; j < 6; j++)
      blockBox(
        g,
        "cloth",
        colors[j % 2],
        -0.65 + j * 0.26,
        1.36,
        0,
        0.26,
        0.14,
        1.3,
      );
    for (let j = 0; j < 6; j++)
      blockBox(
        g,
        "cloth",
        colors[j % 2],
        -0.65 + j * 0.26,
        1.25,
        0.595,
        0.26,
        0.12,
        0.1,
      );
    cube(g, P.wood, 0, 0.47, 0.42, 1.4, 0.18, 0.42);
    for (const x of [-0.6, 0.6]) cube(g, P.wood, x, 0.28, 0.42, 0.13, 0.4, 0.3);
    for (let i = 0; i < 3; i++) {
      cube(g, "#665c48", -0.4 + i * 0.4, 0.24, -0.3, 0.29, 0.17, 0.35);
      cube(
        g,
        id === "V3" ? "#a8b56c" : "#819aae",
        -0.4 + i * 0.4,
        0.34,
        -0.3,
        0.22,
        0.06,
        0.27,
      );
    }
    for (let j = 0; j < 5; j++)
      cube(
        g,
        ["#899d52", "#c89045", "#a75e43"][j % 3],
        -0.5 + j * 0.25,
        0.64,
        0.42,
        0.19,
        0.18,
        0.23,
      );
  }
  return g;
}
export function broadcastHouse(
  parent,
  animations,
  interior = false,
  state = null,
) {
  if (!interior) return studioEntrance(parent, state);
  if (state) ensureStudio(state);
  const g = group(parent),
    w = STUDIO.width - 0.12,
    d = STUDIO.depth - 0.12;
  g.userData.studio = true;
  cube(g, "#747e78", 0, 0.08, 0, w, 0.16, d);
  cube(g, "#665c48", 0, 0.17, 0, w - 0.1, 0.04, d - 0.1);
  for (let x = 0; x < 15; x++)
    for (let z = 0; z < 12; z++)
      cube(
        g,
        ["#966f46", "#a48156", "#b58a55"][(x + z * 2) % 3],
        -2.7 + x * 0.386,
        0.193,
        -2.18 + z * 0.395,
        0.375,
        0.014,
        0.382,
      );
  const backWall = group(g),
    leftWall = group(g);
  backWall.userData.studioWallFace = "back";
  leftWall.userData.studioWallFace = "left";
  backWall.userData.dynamic = leftWall.userData.dynamic = true;
  cube(backWall, "#35484b", 0, 1.23, -2.38, w, 2.06, 0.12);
  cube(leftWall, "#56625b", -2.88, 1.13, -0.01, 0.12, 1.86, d - 0.12);
  cube(backWall, "#665c48", 0, 0.34, -2.304, 5.76, 0.16, 0.035);
  cube(leftWall, "#665c48", -2.802, 0.34, -0.01, 0.035, 0.16, 4.74);
  for (const x of [-2.86, 2.86]) {
    cube(g, "#665c48", x, 1.14, 2.31, 0.12, 1.88, 0.12);
    cube(g, "#747e78", x, 0.29, 2.31, 0.18, 0.18, 0.18);
  }
  // The front and right remain open. Back walls fade from obstructed angles.
  for (let j = 0; j < 18; j++)
    cube(
      backWall,
      j % 2 ? "#3d5050" : "#435859",
      -2.7 + j * 0.318,
      1.25,
      -2.306,
      0.19,
      1.58,
      0.026,
    );
  studioWeatherWindow(backWall);
  const desk = group(g, A.desk.x, 0, A.desk.z);
  desk.userData.studioFurniture = "desk";
  cube(desk, "#bc966a", 0, 0.82, 0, A.desk.w, 0.1, A.desk.d);
  for (const x of [-0.63, 0.63])
    for (const z of [-0.23, 0.23])
      cube(desk, "#374647", x, 0.505, z, 0.065, 0.61, 0.065);
  cube(desk, "#374647", 0, 0.38, -0.23, 1.28, 0.055, 0.065);
  const equipment = group(
    desk,
    0,
    state?.scenery?.equipped?.studioDesk ? 0.028 : 0,
    0,
  );
  equipment.userData.studioDesktopEquipment = true;
  cube(equipment, "#26383c", 0, 0.9, -0.11, 0.28, 0.06, 0.22);
  cube(equipment, "#26383c", 0, 1.055, -0.13, 0.055, 0.26, 0.055);
  studioScreen(equipment, 0, 1.23, -0.14, 0.85, 0.47, "#75bba0");
  cube(equipment, "#d0ecd0", -0.19, 1.29, -0.073, 0.22, 0.035, 0.015);
  cube(equipment, "#486963", 0.19, 1.205, -0.073, 0.25, 0.17, 0.015);
  cube(equipment, "#283b3d", 0, 0.8975, 0.165, 0.55, 0.055, 0.2);
  for (let j = 0; j < 7; j++)
    cube(
      equipment,
      "#aebba6",
      -0.23 + j * 0.075,
      0.931,
      0.155,
      0.045,
      0.012,
      0.085,
    );
  cube(equipment, "#344b4a", 0.57, 0.8925, 0.14, 0.08, 0.045, 0.12);
  // A starter webcam keeps first broadcast possible; tripods are purchased later.
  cube(equipment, "#26383c", 0, 1.497, -0.14, 0.1, 0.065, 0.065);
  const led = cube(
    equipment,
    "#c86149",
    0.03,
    1.5,
    -0.101,
    0.025,
    0.025,
    0.012,
  );
  led.userData.dynamic = true;
  animations.push((t) => {
    const f = state?.reducedMotion ? 1 : 0.9 + Math.sin(t * 2) * 0.1;
    led.scale.set(0.025 * f, 0.025 * f, 0.012 * f);
  });
  studioContents(g, state, animations);
  return g;
}

function studioEntrance(parent, state) {
  const g = group(parent),
    level = Math.max(1, Math.min(3, state?.counts?.L2 || 1));
  g.userData.studio = true;
  g.userData.studioEntrance = level;
  cube(g, "#747e78", 0, 0.08, 0, 1.86, 0.16, 1.86);
  const height = level === 1 ? 1.12 : 1.34;
  cube(g, "#a27b51", 0, 0.16 + height / 2, -0.1, 1.54, height, 1.42);
  for (const x of [-0.74, 0.74])
    for (const z of [-0.78, 0.59])
      cube(g, "#66513c", x, 0.17 + height / 2, z, 0.11, height, 0.11);
  for (let i = 0; i < 6; i++)
    cube(g, "#bf9a67", 0, 0.24 + i * 0.18, 0.622, 1.36, 0.035, 0.025);
  cube(g, "#455b55", -0.18, 0.7, 0.645, 0.48, 1.04, 0.045);
  cube(g, "#799183", -0.18, 0.89, 0.674, 0.34, 0.37, 0.025);
  cube(g, "#d6ba7d", -0.01, 0.59, 0.694, 0.05, 0.05, 0.025);
  cube(g, "#b1a084", -0.18, 0.21, 0.77, 0.64, 0.1, 0.26);
  for (let i = 0; i < 4; i++)
    cube(
      g,
      level > 1 ? "#52776a" : "#85633f",
      0,
      height + 0.24 + i * 0.105,
      -0.1,
      1.82 - i * 0.24,
      0.12,
      1.8,
    );
  const sign = group(g, 0.44, 1.02, 0.665);
  cube(sign, "#374a45", 0, 0, 0, 0.41, 0.3, 0.065);
  for (let i = 0; i < 3; i++)
    cube(
      sign,
      ["#ce8162", "#e0c483", "#a8c89a"][i],
      -0.11 + i * 0.11,
      0.035,
      0.039,
      0.055,
      0.115,
      0.02,
    );
  if (level >= 2) {
    for (const z of [-0.42, 0.18]) {
      cube(g, "#4b625d", 0.791, 0.99, z, 0.035, 0.48, 0.4);
      cube(g, "#a2c8b6", 0.815, 1.005, z, 0.025, 0.35, 0.29);
      cube(g, "#d9c99e", 0.833, 1.005, z, 0.02, 0.35, 0.025);
    }
    cube(g, "#b59661", -0.18, 1.43, 0.663, 0.7, 0.19, 0.06);
    cube(g, "#d46d4d", -0.43, 1.43, 0.701, 0.055, 0.07, 0.02);
  }
  if (level >= 3) {
    cube(g, "#667d74", 0.48, 1.89, -0.47, 0.065, 0.75, 0.065);
    for (let j = 0; j < 3; j++)
      cube(
        g,
        "#b7baa3",
        0.48,
        2.08 + j * 0.09,
        -0.47,
        0.49 - j * 0.13,
        0.035,
        0.045,
      );
    cube(g, "#d9a36b", -0.68, 0.46, 0.8, 0.24, 0.54, 0.15);
    cube(g, "#abc7a4", -0.68, 0.7, 0.802, 0.3, 0.07, 0.22);
    for (let j = 0; j < 3; j++)
      cube(g, "#476d5a", -0.68, 0.38 + j * 0.075, 0.886, 0.16, 0.025, 0.018);
  }
  return g;
}

function studioDevice(
  parent,
  id,
  anchor = { x: 0, z: 0 },
  state = null,
  key = id,
) {
  const p =
    state?.studio?.placements?.[key] || studioSpec(key)?.default || anchor;
  const g = group(parent, p.x, 0, p.z);
  g.rotation.y = ((p.rotation || 0) * Math.PI) / 2;
  g.userData.studioEquipment = id;
  g.userData.studioEntity = key;
  g.userData.studioKey = key;
  // A crowded legacy layout may have a pending item. Never render it at a
  // default coordinate that is already occupied by another purchased object.
  if (state?.studio && !state.studio.placements[key]) g.removeFromParent();
  g.userData.item = id;
  return g;
}

export function studioContents(parent, state, animations) {
  const root = group(parent),
    count = (id) => state?.counts?.[id] || 0;
  root.userData.studioContents = true;
  if (count("L1") && count("L2"))
    studioDeviceModel(
      studioDevice(root, "L1", undefined, state),
      "L1",
      state,
      animations,
    );
  if (count("L3")) {
    const cameras = group(root);
    cameras.userData.studioEquipment = "L3";
    cameras.userData.item = "L3";
    for (let i = 0; i < Math.min(3, count("L3")); i++) {
      const camera = studioDevice(
        cameras,
        "L3",
        A.cameras[i],
        state,
        `L3:${i}`,
      );
      delete camera.userData.studioEquipment;
      camera.userData.studioCamera = i;
      studioDeviceModel(camera, "L3", state, animations);
    }
  }
  for (let i = 4; i <= 14; i++) {
    const id = `L${i}`;
    if (!count(id)) continue;
    const device = studioDevice(root, id, undefined, state);
    studioDeviceModel(device, id, state, animations);
  }
  decorateStudio(root, state);
  return root;
}
