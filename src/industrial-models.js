import { blockBox, cube, group, mat } from "./models.js";
import { blastFurnace } from "./facility-models.js";

function block(p, name, kind, color, x, y, z, w, h, d) {
  const m = blockBox(p, kind, color, x, y, z, w, h, d);
  m.userData.facilityPart = name;
  return m;
}

// Freight and foundry plots have working bays, not recoloured village cottages.
export function industrialBuilding(parent, id, animations) {
  const g = group(parent),
    nether = id.startsWith("N"),
    foundry = id === "N4";
  g.userData.facility = foundry
    ? "blaze-foundry"
    : nether
      ? "nether-freight"
      : "loading-station";
  block(
    g,
    "foundation",
    nether ? "blackstone" : "stone",
    nether ? "#66534b" : "#9da5a0",
    0,
    0.08,
    0,
    2.8,
    0.16,
    1.8,
  );
  if (foundry) {
    block(
      g,
      "heat-chamber",
      "blackstone",
      "#66534b",
      0,
      0.93,
      -0.27,
      2.45,
      1.54,
      0.98,
    );
    for (const x of [-1.13, 1.13])
      block(
        g,
        "iron-corner",
        "iron",
        "#9da5a0",
        x,
        0.98,
        0.243,
        0.13,
        1.66,
        0.075,
      );
    block(
      g,
      "upper-slab",
      "blackstone",
      "#514a4c",
      0,
      1.77,
      -0.27,
      2.61,
      0.18,
      1.18,
    );
    const furnace = blastFurnace(g, animations);
    furnace.position.set(0, 0.15, 0.23);
    furnace.scale.setScalar(1.13);
    for (const x of [-0.89, 0.89]) {
      block(g, "heat-duct", "iron", "#747e78", x, 0.57, 0.4, 0.38, 0.55, 0.45);
      const channel = cube(g, "#e99c4d", x, 0.68, 0.634, 0.2, 0.17, 0.035);
      channel.material = mat("#e99c4d", 0.3);
      channel.userData.facilityPart = "heat-window";
      block(
        g,
        "chimney",
        "blackstone",
        "#514a4c",
        x,
        1.88,
        -0.4,
        0.4,
        0.87,
        0.42,
      );
      block(
        g,
        "chimney-cap",
        "iron",
        "#747e78",
        x,
        2.33,
        -0.4,
        0.49,
        0.11,
        0.51,
      );
      block(
        g,
        "chimney-opening",
        "blackstone",
        "#334941",
        x,
        2.389,
        -0.4,
        0.3,
        0.018,
        0.32,
      );
    }
    for (let j = 0; j < 3; j++) {
      const ember = cube(
        g,
        "#e6ad6a",
        -0.89,
        2.5 + j * 0.16,
        -0.4,
        0.07,
        0.07,
        0.07,
      );
      ember.userData.facilityPart = "heat-particle";
      ember.userData.nonSolid = true;
      ember.castShadow = false;
      animations.push((t) => {
        const phase = (t * 0.22 + j * 0.3) % 1;
        ember.position.set(j % 2 ? 0.89 : -0.89, 2.42 + phase * 0.5, -0.4);
        ember.visible = phase < 0.75;
      });
    }
    return g;
  }
  const timber = nether ? "#725258" : "#977054",
    stone = nether ? "#514a4c" : "#747e78";
  for (const x of [-1.16, 1.16])
    for (const z of [-0.61, 0.55]) {
      block(
        g,
        "pier-foot",
        nether ? "blackstone" : "stone",
        stone,
        x,
        0.3,
        z,
        0.29,
        0.28,
        0.29,
      );
      block(g, "gantry-pier", "log", timber, x, 0.99, z, 0.17, 1.38, 0.17);
    }
  for (const z of [-0.55, 0.35])
    block(g, "gantry-beam", "log", timber, 0, 1.64, z, 2.55, 0.19, 0.21);
  for (let z = 0; z < 3; z++)
    block(
      g,
      "roof-slab",
      nether ? "blackstone" : "wood",
      nether ? "#514a4c" : "#b58a55",
      0,
      1.78 + (z === 1 ? 0.07 : 0),
      -0.55 + z * 0.49,
      2.72,
      0.14,
      0.51,
    );
  for (let j = 0; j < 6; j++)
    block(
      g,
      "sleeper",
      "wood",
      "#977054",
      -1.16 + j * 0.46,
      0.192,
      0.44,
      0.2,
      0.065,
      0.69,
    );
  for (const z of [0.18, 0.7])
    block(g, "rail", "iron", "#9da5a0", 0, 0.244, z, 2.7, 0.055, 0.07);
  const cargo = group(g, 0, 0.29, 0.44);
  block(cargo, "cargo-cart", "iron", "#747e78", 0, 0.115, 0, 0.66, 0.23, 0.58);
  block(cargo, "crate", "wood", timber, 0, 0.37, 0, 0.48, 0.32, 0.4);
  block(
    cargo,
    "crate-band",
    "iron",
    nether ? "#d5a54e" : "#9da5a0",
    0,
    0.37,
    0.214,
    0.07,
    0.32,
    0.028,
  );
  const hook = group(g, 0, 0, 0.35);
  block(hook, "hoist-chain", "iron", "#747e78", 0, 1.17, 0, 0.045, 0.66, 0.045);
  block(hook, "loading-grip", "iron", "#9da5a0", 0, 0.83, 0, 0.36, 0.08, 0.27);
  if (nether) {
    block(
      g,
      "portal-wall",
      "obsidian",
      "#443e51",
      0,
      0.9,
      -0.71,
      1.34,
      1.26,
      0.23,
    );
    const portal = cube(g, "#aa86bc", 0, 0.9, -0.581, 0.89, 0.88, 0.032);
    portal.material = mat("#aa86bc", 0.22);
    portal.userData.facilityPart = "freight-portal";
    for (const x of [-0.5, 0.5])
      block(
        g,
        "gold-corner",
        "iron",
        "#d5a54e",
        x,
        1.43,
        -0.575,
        0.12,
        0.14,
        0.04,
      );
  } else {
    for (const x of [-0.56, 0.56]) {
      block(
        g,
        "buffer-crate",
        "wood",
        "#b58a55",
        x,
        0.43,
        -0.45,
        0.58,
        0.54,
        0.48,
      );
      block(
        g,
        "crate-band",
        "iron",
        "#747e78",
        x,
        0.43,
        -0.198,
        0.075,
        0.54,
        0.028,
      );
    }
  }
  animations.push((t) => {
    cargo.position.x = Math.sin(t * 0.7) * 0.86;
    hook.position.x = cargo.position.x;
  });
  return g;
}
