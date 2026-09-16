import * as T from "three";
import { box, blockBox, group, mat } from "./models.js";
import { facilityUpgrades, upgradeLevel } from "./upgrades.js";

const C = {
  iron: "#a8b3a8",
  dark: "#535d57",
  wood: "#a68454",
  copper: "#bc8255",
  red: "#ac4a3e",
  hot: "#efb35b",
  water: "#78acb0",
  purple: "#9d81b5",
  gold: "#c5ab68",
  leaf: "#779357",
};
// Parts are in the host's normalized volume. They never claim adjacent land.
// x/z: -.5..+.5, y: 0..1; dimensions use the same host-local scale.
const PARTS = {
  "drill-cooling": [
    ["tank", "water", -0.29, 0.42, -0.24, 0.22, 0.3, 0.22],
    ["radiator", "iron", 0.33, 0.5, -0.23, 0.12, 0.38, 0.25],
  ],
  "drill-buffer": [
    ["hopper", "dark", 0.23, 0.23, 0.3, 0.26, 0.22, 0.26],
    ["ore", "gold", 0.23, 0.34, 0.3, 0.18, 0.06, 0.18],
  ],
  "drill-outlet": [
    ["pusher", "iron", -0.12, 0.24, 0.32, 0.4, 0.08, 0.22],
    ["outlet", "dark", -0.29, 0.19, 0.32, 0.12, 0.14, 0.25],
  ],
  "furnace-core": [["core", "hot", 0, 0.31, 0.484, 0.5, 0.21, 0.025]],
  "furnace-lining": [
    ["brick-left", "dark", -0.35, 0.43, 0.475, 0.12, 0.7, 0.04],
    ["brick-right", "dark", 0.35, 0.43, 0.475, 0.12, 0.7, 0.04],
    ["lintel", "dark", 0, 0.82, 0.475, 0.8, 0.1, 0.04],
  ],
  "furnace-blower": [
    ["bellows", "wood", 0.32, 0.35, 0.26, 0.25, 0.34, 0.4],
    ["fan", "iron", 0.32, 0.35, 0.475, 0.16, 0.2, 0.03],
  ],
  "furnace-feed": [
    ["feed-rail", "iron", -0.3, 0.84, 0.12, 0.14, 0.24, 0.55],
    ["input-ore", "gold", -0.3, 0.86, 0.24, 0.11, 0.12, 0.11],
  ],
  "wind-gears": [
    ["gearbox", "dark", 0.19, 0.2, 0.06, 0.18, 0.2, 0.26],
    ["gear", "copper", 0.2, 0.22, 0.22, 0.14, 0.14, 0.04],
  ],
  "wind-coils": [
    ["coil-core", "iron", -0.16, 0.2, 0.16, 0.1, 0.2, 0.12],
    ["copper-coils", "copper", -0.16, 0.23, 0.24, 0.18, 0.14, 0.1],
  ],
  "torch-bank": [["base", "dark", 0, 0.08, 0, 0.95, 0.16, 0.88]],
  "torch-core": [
    ["stabilizer", "iron", 0, 0.32, 0, 0.91, 0.3, 0.89],
    ["core-window", "red", 0, 0.34, 0.46, 0.62, 0.13, 0.05],
  ],
  "torch-module": [
    ["supply-module", "red", 0, 0.55, -0.22, 0.84, 0.21, 0.42],
    ["contact", "copper", 0, 0.55, 0.02, 0.55, 0.07, 0.06],
  ],
  "store-shelves": [
    ["shelf-left", "wood", -0.44, 0.5, 0.34, 0.07, 0.88, 0.16],
    ["shelf-right", "wood", 0.44, 0.5, 0.34, 0.07, 0.88, 0.16],
    ["shelf", "wood", 0, 0.63, 0.35, 0.92, 0.055, 0.24],
  ],
  "store-compress": [
    ["strap-left", "iron", -0.34, 0.47, 0.47, 0.08, 0.89, 0.05],
    ["strap-right", "iron", 0.34, 0.47, 0.47, 0.08, 0.89, 0.05],
    ["compression-lid", "dark", 0, 0.94, 0, 0.91, 0.06, 0.83],
  ],
  "store-sort": [
    ["green-outlet", "leaf", -0.29, 0.17, 0.47, 0.2, 0.23, 0.055],
    ["ore-outlet", "gold", 0, 0.17, 0.47, 0.2, 0.23, 0.055],
    ["end-outlet", "purple", 0.29, 0.17, 0.47, 0.2, 0.23, 0.055],
  ],
  "rail-wagons": [["freight-crate", "wood", 0.26, 0.52, 0, 0.36, 0.38, 0.65]],
  "rail-dispatch": [
    ["signal-post", "dark", -0.35, 0.5, -0.3, 0.08, 0.8, 0.1],
    ["signal", "red", -0.35, 0.9, -0.3, 0.16, 0.1, 0.18],
  ],
  "rail-loader": [
    ["gantry", "iron", -0.36, 0.54, 0.26, 0.08, 0.68, 0.1],
    ["arm", "copper", -0.14, 0.85, 0.26, 0.51, 0.08, 0.12],
    ["hook", "dark", 0.09, 0.74, 0.26, 0.065, 0.23, 0.07],
  ],
  "farm-irrigation": [
    ["channel", "water", 0, 0.095, 0.35, 0.94, 0.025, 0.075],
    ["sluice", "iron", 0.37, 0.18, 0.35, 0.13, 0.14, 0.12],
  ],
  "farm-beds": [
    ["seed-tray", "wood", -0.34, 0.17, -0.32, 0.23, 0.1, 0.23],
    ["seedlings", "leaf", -0.34, 0.24, -0.32, 0.18, 0.05, 0.18],
  ],
  "farm-cart": [
    ["cart", "wood", 0.31, 0.22, 0.3, 0.26, 0.23, 0.24],
    ["wheel", "dark", 0.17, 0.12, 0.3, 0.04, 0.13, 0.22],
  ],
  "pen-feed": [
    ["trough", "wood", 0, 0.13, -0.36, 0.62, 0.2, 0.21],
    ["fodder", "leaf", 0, 0.23, -0.36, 0.51, 0.045, 0.14],
  ],
  "pen-tools": [
    ["grooming-table", "wood", -0.31, 0.26, 0.23, 0.25, 0.1, 0.3],
    ["shears", "iron", -0.31, 0.34, 0.23, 0.1, 0.065, 0.19],
  ],
  "market-pack": [
    ["parcel", "wood", -0.29, 0.18, 0.33, 0.26, 0.22, 0.21],
    ["scale", "iron", 0.31, 0.2, 0.33, 0.22, 0.09, 0.21],
  ],
  "market-orders": [
    ["order-book", "gold", 0.22, 0.38, 0.31, 0.2, 0.05, 0.19],
    ["dispatch-box", "wood", 0.32, 0.15, 0.24, 0.24, 0.22, 0.24],
  ],
  "library-tools": [["tool-rack", "wood", 0, 0.28, 0.47, 0.73, 0.38, 0.045]],
  "blaze-reservoir": [
    ["heat-cage", "dark", 0, 0.22, 0, 0.43, 0.3, 0.43],
    ["reservoir", "hot", 0, 0.25, 0.235, 0.23, 0.19, 0.035],
  ],
  "blaze-feed": [
    ["heat-pipe", "copper", 0.25, 0.32, 0, 0.075, 0.5, 0.1],
    ["heat-nozzle", "hot", 0.25, 0.12, 0.12, 0.12, 0.08, 0.23],
  ],
  "blaze-exchanger": [
    ["heat-sink", "copper", -0.3, 0.37, 0.32, 0.15, 0.4, 0.16],
  ],
  "blaze-chamber": [
    ["lining", "dark", 0.26, 0.36, 0.35, 0.23, 0.3, 0.16],
    ["chamber", "hot", 0.26, 0.36, 0.442, 0.12, 0.17, 0.025],
  ],
  "piglin-crates": [
    ["reinforced-crate", "wood", -0.28, 0.17, 0.31, 0.31, 0.26, 0.27],
    ["gold-band", "gold", -0.28, 0.2, 0.454, 0.05, 0.22, 0.025],
  ],
  "piglin-contract": [
    ["contract-desk", "wood", 0.28, 0.3, 0.3, 0.28, 0.06, 0.24],
    ["contract", "gold", 0.28, 0.343, 0.3, 0.2, 0.018, 0.18],
  ],
  "magma-press": [
    ["bottom-press", "dark", 0, 0.04, 0, 0.88, 0.07, 0.88],
    ["upper-press", "iron", 0, 0.9, 0, 0.87, 0.07, 0.87],
  ],
  "ghast-harness": [
    ["freight-box", "wood", 0, 0.2, 0, 0.39, 0.23, 0.39],
    ["sling-left", "dark", -0.22, 0.43, 0, 0.03, 0.3, 0.07],
    ["sling-right", "dark", 0.22, 0.43, 0, 0.03, 0.3, 0.07],
  ],
  "nether-customs": [
    ["source-gate", "copper", -0.3, 0.3, 0.3, 0.1, 0.48, 0.12],
    ["destination-gate", "purple", 0.3, 0.3, 0.3, 0.1, 0.48, 0.12],
  ],
  "forge-anvil": [
    ["anvil", "iron", 0, 0.93, 0, 0.5, 0.07, 0.31],
    ["hammer", "dark", 0.33, 0.86, 0.24, 0.18, 0.18, 0.16],
  ],
  "end-anchor": [
    ["anchor", "purple", -0.27, 0.035, 0, 0.21, 0.06, 0.24],
    ["teleport-pixel", "gold", -0.27, 0.17, 0, 0.055, 0.06, 0.055],
  ],
  "end-relay": [
    ["backpack", "dark", 0, 0.52, -0.34, 0.43, 0.24, 0.26],
    ["cargo", "purple", 0, 0.55, -0.474, 0.29, 0.16, 0.035],
  ],
  "shulker-coil": [
    ["levitation-base", "dark", 0, 0.08, 0, 0.85, 0.13, 0.84],
    ["front-coil", "purple", 0, 0.17, 0.39, 0.83, 0.08, 0.065],
  ],
  "shulker-dock": [
    ["lift-left", "iron", -0.43, 0.36, 0, 0.08, 0.49, 0.2],
    ["lift-right", "iron", 0.43, 0.36, 0, 0.08, 0.49, 0.2],
  ],
  "shulker-cells": [
    ["divider-x", "dark", 0, 0.87, 0, 0.06, 0.08, 0.78],
    ["divider-z", "dark", 0, 0.87, 0, 0.86, 0.08, 0.06],
  ],
  "ender-routing": [
    ["ow-port", "leaf", -0.3, 0.23, 0.475, 0.18, 0.14, 0.04],
    ["nether-port", "copper", 0, 0.23, 0.475, 0.18, 0.14, 0.04],
    ["end-port", "purple", 0.3, 0.23, 0.475, 0.18, 0.14, 0.04],
  ],
  "chorus-roots": [
    ["root-link", "purple", 0, 0.09, 0, 0.8, 0.075, 0.075],
    ["root-link-z", "purple", 0, 0.11, 0, 0.075, 0.075, 0.8],
  ],
  "brew-cooling": [
    ["condenser", "copper", -0.26, 0.48, -0.12, 0.08, 0.47, 0.11],
    ["flask", "water", -0.26, 0.24, 0.16, 0.2, 0.23, 0.19],
  ],
  "terrarium-climate": [
    ["climate-base", "dark", 0, 0.18, 0, 0.8, 0.1, 0.8],
    ["alien-tree", "purple", 0.22, 0.6, 0.16, 0.11, 0.26, 0.09],
    ["tree-crown", "leaf", 0.22, 0.76, 0.16, 0.23, 0.1, 0.2],
  ],
  "dragon-rig": [
    ["saddle", "copper", 0, 0.63, 0.06, 0.19, 0.07, 0.2],
    ["cargo-bay", "wood", 0, 0.73, 0.06, 0.15, 0.11, 0.16],
  ],
  "dragon-route": [
    ["ow-beacon", "leaf", -0.045, 0.815, 0.07, 0.02, 0.04, 0.035],
    ["nether-beacon", "hot", 0, 0.815, 0.07, 0.02, 0.04, 0.035],
    ["end-beacon", "purple", 0.045, 0.815, 0.07, 0.02, 0.04, 0.035],
  ],
};
export const MODELED_UPGRADES = new Set([
  ...Object.keys(PARTS),
  "drill-steel",
  "drill-diamond",
  "drill-netherite",
  "drill-twin",
  "wind-blades",
]);

export function applyFacilityUpgrades(root, id, state, animations) {
  const bought = facilityUpgrades(id).filter((row) =>
    upgradeLevel(state, row.id),
  );
  if (!bought.length) return;
  root.updateWorldMatrix(true, true);
  const bounds = new T.Box3().setFromObject(root);
  const min = root.worldToLocal(bounds.min.clone()),
    max = root.worldToLocal(bounds.max.clone());
  const size = max.clone().sub(min),
    center = min.clone().add(max).multiplyScalar(0.5);
  const parts = group(root);
  parts.name = "dedicated-upgrades";
  parts.userData.upgrades = bought.map((row) => row.id);
  function add(key, name, color, x, y, z, w, h, d) {
    const mesh = blockBox(
      parts,
      color === "wood" ? "wood" : color === "dark" ? "stone" : "iron",
      C[color] || color,
      center.x + x * size.x,
      min.y + y * size.y,
      center.z + z * size.z,
      w * size.x,
      h * size.y,
      d * size.z,
    );
    mesh.userData.upgrade = key;
    mesh.userData.facilityPart = name;
    return mesh;
  }
  for (const row of bought) {
    const level = upgradeLevel(state, row.id),
      key = row.id;
    for (const spec of PARTS[key] || []) add(key, ...spec);
    if (key === "torch-bank")
      for (let k = 0; k < Math.min(6, level * 2); k++) {
        const x = ((k % 3) - 1) * 0.3,
          z = (Math.floor(k / 3) - 0.5) * 0.5;
        add(key, "extra-torch-stem", "wood", x, 0.29, z, 0.09, 0.32, 0.09);
        add(key, "extra-torch-head", "red", x, 0.49, z, 0.2, 0.12, 0.2);
      }
    if (key === "store-shelves" || key === "drill-buffer")
      for (let k = 0; k < level; k++)
        add(
          key,
          "stacked-bin",
          "wood",
          -0.25 + k * 0.25,
          0.77,
          0.36,
          0.19,
          0.18,
          0.2,
        );
    if (key === "library-tools")
      for (let k = 0; k < 6; k++) {
        add(
          key,
          "job-tool-handle",
          "wood",
          -0.3 + k * 0.12,
          0.31,
          0.475,
          0.022,
          0.22,
          0.022,
        );
        add(
          key,
          "job-tool-head",
          k % 2 ? "iron" : "gold",
          -0.3 + k * 0.12,
          0.43,
          0.477,
          0.08,
          0.05,
          0.03,
        );
      }
    if (key === "blaze-exchanger" || key === "drill-cooling")
      for (let k = 0; k < 5; k++)
        add(
          key,
          "cooling-fin",
          "copper",
          key === "blaze-exchanger" ? -0.3 : 0.33,
          0.3 + k * 0.055,
          0.41,
          0.2,
          0.023,
          0.08,
        );
    if (key === "wind-blades") {
      let fan;
      root.traverse((o) => {
        if (o.userData.facilityPart === "windmill-rotor") fan = o;
      });
      if (fan)
        for (let k = 0; k < 4; k++) {
          const blade = group(fan);
          blade.rotation.z = (k * Math.PI) / 2;
          for (let j = 0; j < level; j++) {
            const slat = blockBox(
              blade,
              "wood",
              C.wood,
              0.08,
              0.38 + j * 0.19,
              0.07,
              0.13,
              0.13,
              0.028,
            );
            slat.userData.upgrade = key;
          }
        }
    }
  }
  if (id === "M9") {
    let shaft;
    root.traverse((o) => {
      if (o.userData.facilityPart === "drill-shaft") shaft = o;
    });
    if (shaft) {
      const color = upgradeLevel(state, "drill-netherite")
        ? "#554d55"
        : upgradeLevel(state, "drill-diamond")
          ? "#75bec0"
          : upgradeLevel(state, "drill-steel")
            ? C.iron
            : null;
      if (color)
        shaft.traverse((o) => {
          if (o.isMesh) {
            o.material = mat(color);
            o.userData.upgrade = "drill-head";
          }
        });
      if (upgradeLevel(state, "drill-twin")) {
        shaft.position.x = -0.22;
        const twin = shaft.clone(true);
        twin.position.x = 0.22;
        shaft.parent.add(twin);
        twin.userData.upgrade = "drill-twin";
        animations.push(
          (t) => (twin.position.y = Math.sin(t * 5 + Math.PI) * 0.085),
        );
      }
    }
  }
  const movers = parts.children
    .filter((o) =>
      [
        "pusher",
        "arm",
        "hook",
        "input-ore",
        "upper-press",
        "hammer",
        "teleport-pixel",
      ].includes(o.userData.facilityPart),
    )
    .map((o) => ({ o, y: o.position.y }));
  if (movers.length)
    animations.push((t) => {
      // The world advances powered host phases only when their actual load works.
      for (const { o, y } of movers) {
        if (o.userData.facilityPart === "upper-press")
          o.position.y =
            y -
            Math.sin((Math.PI * (state.dimensions?.magmaProgress || 0)) / 10) *
              size.y *
              0.18;
        else
          o.position.y = y + Math.sin(t * 3) * Math.min(size.y * 0.012, 0.035);
      }
    });
}
