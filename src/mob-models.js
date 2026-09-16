import { cube, group } from "./models.js";
import { mobEnvelope, groundLeg } from "./mob-motion.js";

function part(parent, name, x = 0, y = 0, z = 0) {
  const root = group(parent, x, y, z);
  root.userData.mobPart = name;
  return root;
}

export function copperGolem(parent, variant = 0) {
  const root = group(parent),
    copper = ["#b87549", "#c68455", "#a86a47", "#bd805c"][
      Math.abs(variant) % 4
    ],
    light = "#d69a69",
    dark = "#78513e",
    patina = "#568d79",
    head = part(root, "head", 0, 0.79, 0),
    body = part(root, "body", 0, 0.4, 0),
    arms = [],
    legs = [];
  root.userData.mob = "copper-golem";
  cube(body, copper, 0, 0, 0, 0.38, 0.34, 0.3);
  cube(body, light, 0, 0.025, 0.16, 0.25, 0.22, 0.025);
  cube(body, dark, 0, -0.11, 0.178, 0.12, 0.035, 0.018);
  cube(head, copper, 0, 0, 0, 0.5, 0.46, 0.43);
  cube(head, light, -0.06, 0.18, 0.224, 0.29, 0.045, 0.025);
  cube(head, dark, 0, 0.048, 0.232, 0.32, 0.042, 0.026);
  for (const x of [-0.13, 0.13]) {
    cube(head, "#374839", x, -0.012, 0.234, 0.083, 0.068, 0.028);
    cube(head, "#ead5a3", x - 0.013, -0.006, 0.253, 0.025, 0.027, 0.016);
  }
  cube(head, copper, 0, -0.095, 0.28, 0.105, 0.145, 0.13);
  cube(head, dark, 0, -0.142, 0.354, 0.076, 0.031, 0.018);
  const rod = part(head, "lightning-rod", 0, 0.23, 0);
  cube(rod, dark, 0, 0.022, 0, 0.13, 0.045, 0.13);
  cube(rod, copper, 0, 0.115, 0, 0.065, 0.145, 0.065);
  cube(rod, light, 0, 0.207, 0, 0.13, 0.04, 0.13);
  // Uneven oxidation patches are distinct raised pixels, never coincident faces.
  for (const [x, y, w, h] of [
    [-0.2, 0.105, 0.08, 0.12],
    [-0.155, 0.19, 0.13, 0.06],
    [0.19, -0.165, 0.105, 0.09],
  ])
    cube(head, patina, x, y, 0.237, w, h, 0.027);
  cube(body, patina, -0.125, -0.105, 0.171, 0.095, 0.1, 0.025);
  if (variant % 2) cube(head, "#7daa87", 0.2, 0.12, -0.224, 0.09, 0.14, 0.023);
  for (const side of [-1, 1]) {
    const leg = part(root, "leg", side * 0.115, 0.225, 0);
    cube(leg, copper, 0, -0.095, 0, 0.15, 0.22, 0.17);
    cube(leg, dark, 0, -0.202, 0.025, 0.165, 0.042, 0.21);
    legs.push(leg);
    const arm = part(root, "arm", side * 0.27, 0.55, 0);
    cube(arm, dark, 0, -0.005, 0, 0.12, 0.11, 0.14);
    cube(arm, copper, 0, -0.17, 0.01, 0.125, 0.29, 0.15);
    cube(arm, light, 0, -0.315, 0.025, 0.14, 0.055, 0.17);
    arms.push(arm);
  }
  return { root, head, body, arms, legs };
}

export function ironGolem(
  parent,
  animations,
  walking = () => false,
  variant = 0,
) {
  const root = group(parent),
    iron = "#d0d1bb",
    shade = "#a2a99a",
    joint = "#777e73",
    torso = part(root, "body", 0, 1.12, 0),
    head = part(root, "head", 0, 1.69, -0.015),
    arms = [],
    legs = [];
  root.userData.mob = "iron-golem";
  cube(torso, iron, 0, 0.08, 0, 0.7, 0.61, 0.4);
  cube(torso, shade, 0, -0.32, 0, 0.45, 0.41, 0.32);
  cube(torso, "#e2decb", -0.18, 0.28, 0.215, 0.23, 0.07, 0.028);
  cube(head, iron, 0, 0, 0, 0.4, 0.42, 0.38);
  cube(head, shade, 0, -0.035, 0.252, 0.13, 0.24, 0.15);
  cube(head, "#828774", 0, -0.15, 0.335, 0.1, 0.045, 0.022);
  for (const x of [-0.12, 0.12]) {
    cube(head, "#73796a", x, 0.053, 0.202, 0.12, 0.05, 0.028);
    cube(head, "#aa6050", x, 0.007, 0.218, 0.06, 0.045, 0.017);
  }
  for (const side of [-1, 1]) {
    const arm = part(root, "arm", side * 0.42, 1.39, 0);
    cube(arm, shade, 0, -0.06, 0, 0.17, 0.25, 0.31);
    cube(arm, iron, 0, -0.57, 0, 0.17, 0.84, 0.27);
    cube(arm, "#e2decb", 0, -0.977, 0.014, 0.185, 0.07, 0.31);
    arms.push(arm);
    const leg = part(root, "leg", side * 0.155, 0.6, 0);
    cube(leg, iron, 0, -0.27, 0, 0.23, 0.54, 0.29);
    cube(leg, shade, 0, -0.566, 0.052, 0.25, 0.065, 0.38);
    legs.push(leg);
  }
  for (const [x, y, w, h] of [
    [0.23, 0.2, 0.075, 0.26],
    [0.16, 0.02, 0.11, 0.065],
    [0.24, -0.115, 0.085, 0.23],
    [0.125, -0.21, 0.16, 0.06],
  ])
    cube(torso, "#587748", x, y, 0.219, w, h, 0.023);
  for (const [x, y] of [
    [0.29, 0.12],
    [0.1, 0.05],
    [0.23, -0.18],
  ])
    cube(torso, "#8a9d58", x, y, 0.237, 0.075, 0.05, 0.018);
  cube(torso, "#b9a867", 0.27, 0.21, 0.25, 0.045, 0.045, 0.017);
  cube(head, "#728267", -0.13, 0.135, 0.206, 0.065, 0.09, 0.022);
  for (const [x, y] of [
    [-0.19, 0.12],
    [-0.135, 0.07],
    [0.04, -0.05],
  ])
    cube(torso, joint, x, y, 0.217, 0.055, 0.022, 0.02);
  const motion = mobEnvelope(root, variant, walking);
  animations.push((t) => {
    const m = motion(t),
      breath = Math.sin(t * 1.45 + variant);
    // Only the upper body breathes; the feet and world collision root stay fixed.
    torso.position.y = 1.12 + breath * 0.004;
    head.position.y = 1.69 + breath * 0.004;
    head.rotation.y = Math.sin(t * 0.53 + variant) * 0.12 * (1 - m.work * 0.7);
    head.rotation.x = Math.sin(t * 0.83 + variant) * 0.025 + m.work * 0.1;
    for (let i = 0; i < 2; i++) {
      const stride = Math.sin(m.phase + i * Math.PI),
        swing = stride * m.walk;
      groundLeg(
        legs[i],
        "x",
        swing * 0.14,
        0.6,
        -0.5985,
        -0.145,
        0.242,
        Math.max(0, stride) * m.walk * 0.012,
      );
      arms[i].rotation.x =
        -swing * 0.1 +
        breath * 0.01 -
        m.work * (0.095 + Math.sin(m.phase * 0.7) * 0.025);
    }
  });
  return root;
}

export function blaze(parent, animations, variant = 0) {
  const root = group(parent),
    head = part(root, "head", 0, 1.06, 0),
    rods = [];
  root.userData.mob = "blaze";
  cube(head, "#dba640", 0, 0, 0, 0.43, 0.43, 0.43);
  cube(head, "#efcd64", -0.085, 0.125, 0.224, 0.22, 0.08, 0.023);
  for (const side of [-1, 1]) {
    cube(head, "#57381e", side * 0.115, 0.025, 0.225, 0.14, 0.065, 0.024);
    cube(head, "#fff0a0", side * 0.115, 0.008, 0.243, 0.055, 0.03, 0.016);
    cube(head, "#b87929", side * 0.15, -0.13, 0.225, 0.08, 0.07, 0.025);
  }
  cube(head, "#744621", 0, -0.095, 0.23, 0.11, 0.04, 0.026);
  for (let tier = 0; tier < 3; tier++) {
    const ring = part(root, "rod-tier-" + tier);
    for (let j = 0; j < 4; j++) {
      const rod = part(ring, "blaze-rod");
      cube(rod, "#e4b04a", 0, 0, 0, 0.085, 0.32, 0.085);
      cube(rod, "#f4d97a", 0, 0.15, 0, 0.09, 0.04, 0.09);
      cube(rod, "#a66a25", 0, -0.145, 0, 0.09, 0.032, 0.09);
      rods.push({ root: rod, tier, j });
    }
  }
  const motion = mobEnvelope(root, variant);
  let orbit = variant * 0.47,
    previous;
  const animate = (t) => {
    const m = motion(t),
      dt =
        previous === undefined ? 0 : Math.max(0, Math.min(0.1, t - previous));
    previous = t;
    orbit += dt * (0.5 + m.work * 0.85 + m.walk * 0.25);
    head.position.y = 1.06 + Math.sin(t * 1.7) * 0.025;
    head.rotation.y = Math.sin(t * 0.65 + variant) * (0.15 - m.work * 0.1);
    head.rotation.x = Math.sin(t * 1.1 + variant) * 0.035 + m.work * 0.07;
    for (const rod of rods) {
      const angle =
          orbit * [0.9, -0.7, 0.6][rod.tier] +
          (rod.j * Math.PI) / 2 +
          rod.tier * 0.6,
        radius = [0.27, 0.4, 0.37][rod.tier];
      rod.root.position.set(
        Math.sin(angle) * radius,
        0.24 +
          rod.tier * 0.37 +
          Math.sin(t * 2 + rod.j + rod.tier * 1.1) * 0.025,
        Math.cos(angle) * radius,
      );
    }
  };
  animate(0);
  animations.push(animate);
  return root;
}

export function farmAnimal(parent, id, animations, variant = 0) {
  const root = group(parent),
    cow = id === "V8",
    sheep = id === "V9",
    color = cow ? "#685044" : sheep ? "#e9e7d9" : "#dcaaa3",
    body = part(root, "body", 0, 0.45, 0),
    head = part(root, "head", 0.26, 0.56, 0),
    legs = [],
    ears = [],
    tail = part(root, "tail", -0.355, 0.5, 0);
  root.userData.mob = cow ? "cow" : sheep ? "sheep" : "pig";
  cube(body, color, 0, 0, 0, 0.8, 0.5, 0.45);
  cube(head, sheep ? "#a39783" : color, 0.18, 0.06, 0, 0.36, 0.35, 0.39);
  if (cow) {
    cube(head, "#b8aa9a", 0.355, -0.035, 0, 0.12, 0.17, 0.36);
    for (const z of [-0.1, 0.1])
      cube(head, "#544c44", 0.422, -0.028, z, 0.016, 0.037, 0.055);
    cube(body, "#c99491", -0.06, -0.265, 0, 0.25, 0.08, 0.2);
    for (const side of [-1, 1]) {
      for (const [x, y, w, h] of [
        [-0.26, 0.1, 0.19, 0.22],
        [-0.08, 0.16, 0.17, 0.11],
        [0.2, -0.07, 0.24, 0.2],
        [0.31, 0.07, 0.1, 0.15],
      ])
        cube(body, "#e5e1cf", x, y, side * 0.231, w, h, 0.02);
      cube(head, "#e5e1cf", 0.075, 0.15, side * 0.201, 0.14, 0.1, 0.018);
    }
    cube(body, "#e5e1cf", -0.15, 0.258, -0.02, 0.24, 0.018, 0.25);
  }
  if (sheep) {
    cube(head, "#e9e7d9", 0.12, 0.22, 0, 0.29, 0.06, 0.4);
    for (const side of [-1, 1])
      for (const x of [-0.27, 0.01, 0.28])
        cube(body, "#d6d6c7", x, -0.16, side * 0.234, 0.2, 0.1, 0.025);
  }
  for (const side of [-1, 1]) {
    cube(head, "#333e35", 0.32, 0.13, side * 0.201, 0.055, 0.05, 0.02);
    const ear = part(head, "ear", 0.08, 0.16, side * 0.19);
    cube(
      ear,
      cow ? "#786451" : sheep ? "#c2b5a1" : "#c98f89",
      0.012,
      -0.025,
      side * 0.025,
      0.075,
      0.09,
      0.09,
    );
    ears.push(ear);
    if (cow) {
      cube(head, "#e9ddbd", 0.23, 0.32, side * 0.15, 0.08, 0.2, 0.07);
    }
  }
  if (sheep) cube(head, "#8b8070", 0.32, -0.035, 0, 0.09, 0.15, 0.28);
  else if (!cow) {
    cube(head, "#e4b0a2", 0.367, 0.015, 0, 0.035, 0.105, 0.22);
    for (const z of [-0.06, 0.06])
      cube(head, "#7b514d", 0.39, 0.017, z, 0.013, 0.045, 0.045);
  }
  for (const x of [-0.25, 0.25])
    for (const z of [-0.14, 0.14]) {
      const leg = part(root, "leg", x, 0.26, z);
      leg.userData.diagonal = x * z > 0 ? 0 : 1;
      cube(leg, cow ? "#6d6656" : color, 0, -0.118, 0, 0.1, 0.236, 0.1);
      // The cuff meets the leg, and its bottom is the ground reference.
      cube(leg, "#6d6656", 0, -0.237, 0, 0.106, 0.046, 0.106);
      legs.push(leg);
    }
  cube(tail, color, 0, -0.11, 0, 0.065, 0.23, 0.065);
  const motion = mobEnvelope(root, variant);
  animations.push((t) => {
    const m = motion(t),
      phase = t + variant * 1.71,
      forage = Math.pow(Math.max(0, Math.sin(phase * 0.37)), 4) * (1 - m.walk),
      breathe = Math.sin(phase * 1.7);
    body.position.y = 0.45 + breathe * 0.003;
    head.rotation.z = -forage * 0.38 + m.work * -0.08 + breathe * 0.008;
    head.rotation.y = Math.sin(phase * 0.49) * 0.09 * (1 - m.walk * 0.7);
    for (const leg of legs) {
      const stride = Math.sin(m.phase + leg.userData.diagonal * Math.PI);
      groundLeg(
        leg,
        "z",
        stride * m.walk * 0.24,
        0.26,
        -0.26,
        -0.053,
        0.053,
        Math.max(0, stride) * m.walk * 0.023,
      );
    }
    for (let i = 0; i < ears.length; i++)
      ears[i].rotation.x =
        Math.pow(Math.max(0, Math.sin(phase * 1.8 + i * 1.9)), 10) *
        (i ? -0.2 : 0.2);
    tail.rotation.x = Math.sin(phase * 1.4) * 0.19;
  });
  return root;
}

export function humanoidMob(parent, id, animations, variant = 0) {
  if (id !== "E3") return witherSkeleton(parent, animations, variant);
  const root = group(parent),
    color = "#202126",
    headY = 2.01,
    hip = 1.06,
    shoulder = 1.76,
    armLength = 1.18,
    body = part(root, "body", 0, 1.45, 0),
    head = part(root, "head", 0, headY, 0),
    legs = [],
    arms = [];
  root.userData.mob = "enderman";
  cube(body, color, 0, 0, 0, 0.32, 0.7, 0.23);
  cube(head, color, 0, 0, 0, 0.42, 0.42, 0.42);
  cube(body, color, 0, 0.36, 0, 0.1, 0.1, 0.1);
  for (const side of [-1, 1]) {
    const arm = part(root, "arm", side * 0.23, shoulder, 0),
      leg = part(root, "leg", side * 0.105, hip, 0);
    cube(arm, color, 0, -armLength / 2, 0, 0.085, armLength, 0.085);
    cube(leg, color, 0, -hip / 2, 0, 0.09, hip, 0.09);
    cube(head, "#a467c5", side * 0.12, -0.005, 0.218, 0.16, 0.058, 0.017);
    cube(head, "#e6b4f0", side * 0.116, -0.002, 0.231, 0.059, 0.042, 0.014);
    legs.push(leg);
    arms.push(arm);
  }
  const motion = mobEnvelope(root, variant);
  animations.push((t) => {
    const m = motion(t),
      idle = t * 0.7 + variant,
      breath = Math.sin(t * 1.5 + variant) * 0.003;
    body.position.y = 1.45 + breath;
    head.position.y = headY + breath;
    head.rotation.y = Math.sin(idle) * 0.18 * (1 - m.work * 0.7);
    head.rotation.x = Math.sin(idle * 1.3) * 0.03 + m.work * 0.08;
    for (let i = 0; i < 2; i++) {
      const stride = Math.sin(m.phase + i * Math.PI);
      groundLeg(
        legs[i],
        "x",
        stride * m.walk * 0.18,
        hip,
        -hip,
        -0.045,
        0.045,
        Math.max(0, stride) * m.walk * 0.012,
      );
      arms[i].rotation.x =
        -stride * m.walk * 0.17 + Math.sin(idle + i) * 0.016 - m.work * 0.65;
    }
  });
  return root;
}

export function witherSkeleton(parent, animations, variant = 0) {
  const root = group(parent),
    bone = "#303135",
    edge = "#4b4d4f",
    body = part(root, "body", 0, 1.12, 0),
    head = part(root, "head", 0, 1.65, 0),
    arms = [],
    legs = [],
    hip = 0.82;
  root.userData.mob = "wither-skeleton";
  // Open ribcage: empty space between bones is part of the silhouette.
  cube(body, bone, 0, 0, -0.05, 0.085, 0.59, 0.1);
  cube(body, edge, 0, 0.25, 0, 0.43, 0.075, 0.12);
  cube(body, bone, 0, -0.28, 0, 0.27, 0.085, 0.15);
  for (const y of [-0.13, 0.015, 0.16]) {
    const rib = part(body, "rib", 0, y, 0);
    cube(rib, edge, 0, 0, 0.06, 0.31, 0.055, 0.06);
    for (const side of [-1, 1])
      cube(rib, bone, side * 0.14, 0, -0.005, 0.055, 0.055, 0.17);
  }
  cube(head, bone, 0, 0, 0, 0.42, 0.4, 0.4);
  cube(head, edge, -0.11, 0.145, 0.208, 0.12, 0.045, 0.018);
  for (const side of [-1, 1]) {
    cube(head, "#111315", side * 0.105, 0.025, 0.209, 0.105, 0.106, 0.02);
    cube(head, edge, side * 0.16, -0.104, 0.214, 0.06, 0.07, 0.025);
  }
  cube(head, "#141719", 0, -0.055, 0.219, 0.055, 0.075, 0.025);
  const jaw = part(head, "jaw", 0, -0.19, 0.06);
  cube(jaw, edge, 0, 0, 0, 0.33, 0.055, 0.31);
  for (const x of [-0.09, 0, 0.09])
    cube(jaw, bone, x, 0.043, 0.15, 0.046, 0.052, 0.027);
  cube(root, bone, 0, 1.42, 0, 0.1, 0.17, 0.1);
  for (const side of [-1, 1]) {
    const arm = part(root, "arm", side * 0.265, 1.385, 0),
      leg = part(root, "leg", side * 0.105, hip, 0);
    cube(arm, bone, 0, -0.34, 0, 0.083, 0.68, 0.092);
    cube(arm, edge, 0, -0.37, 0.047, 0.085, 0.065, 0.012);
    cube(leg, bone, 0, -hip / 2, 0, 0.083, hip, 0.092);
    cube(leg, edge, 0, -0.39, 0.047, 0.085, 0.055, 0.013);
    arms.push(arm);
    legs.push(leg);
  }
  const sword = part(arms[1], "stone-sword", 0, -0.59, 0.16);
  sword.rotation.x = 0.15;
  cube(sword, "#6a5640", 0, -0.09, 0, 0.055, 0.21, 0.06);
  cube(sword, "#51575b", 0, 0.05, 0, 0.25, 0.065, 0.08);
  cube(sword, "#7f8786", 0, 0.32, 0, 0.105, 0.49, 0.048);
  cube(sword, "#abb0a7", -0.029, 0.32, 0.029, 0.033, 0.48, 0.015);
  cube(sword, "#8f9691", 0, 0.59, 0, 0.064, 0.065, 0.048);
  const motion = mobEnvelope(root, variant);
  animations.push((t) => {
    const m = motion(t),
      breath = Math.sin(t * 1.3 + variant) * 0.003;
    body.position.y = 1.12 + breath;
    head.position.y = 1.65 + breath;
    head.rotation.y = Math.sin(t * 0.52 + variant) * 0.15 * (1 - m.work * 0.7);
    head.rotation.x = Math.sin(t * 0.83 + variant) * 0.025 + m.work * 0.08;
    for (let i = 0; i < 2; i++) {
      const stride = Math.sin(m.phase + i * Math.PI);
      groundLeg(
        legs[i],
        "x",
        stride * m.walk * 0.21,
        hip,
        -hip,
        -0.046,
        0.046,
        Math.max(0, stride) * m.walk * 0.016,
      );
      arms[i].rotation.x =
        -stride * m.walk * 0.19 +
        Math.sin(t * 0.7 + i) * 0.015 -
        m.work * (i ? 0.55 : 0.18);
    }
  });
  return root;
}

export function magmaCube(parent, animations, variant = 0) {
  const root = group(parent),
    layers = [],
    motion = mobEnvelope(root, variant);
  root.userData.mob = "magma-cube";
  const core = part(root, "lava-core", 0, 0.34, 0);
  cube(core, "#e47a29", 0, 0, 0, 0.59, 0.58, 0.58);
  for (let i = 0; i < 8; i++) {
    const layer = part(root, "magma-layer", 0, (i + 0.5) * 0.09, 0);
    cube(layer, i % 3 === 0 ? "#492b27" : "#352a29", 0, 0, 0, 0.84, 0.09, 0.82);
    layers.push(layer);
  }
  for (const x of [-0.19, 0.19]) {
    cube(layers[5], "#d96520", x, 0.015, 0.422, 0.19, 0.12, 0.022);
    cube(layers[5], "#f6bf35", x, 0.026, 0.438, 0.115, 0.079, 0.014);
  }
  animations.push((t) => {
    const m = motion(t),
      pulse = 0.5 + 0.5 * Math.sin(t * 2 + variant),
      extension = pulse * (0.002 + m.work * 0.028 + m.walk * 0.013);
    for (let i = 1; i < 8; i++)
      layers[i].position.y = (i + 0.5) * 0.09 + extension * i;
    core.scale.y = 1 + extension * 8;
    core.position.y = 0.05 + 0.29 * core.scale.y;
  });
  return root;
}

export function ghast(parent, animations, variant = 0) {
  const root = group(parent),
    body = part(root, "body", 0, 1.6, 0),
    tentacles = [],
    motion = mobEnvelope(root, variant);
  root.userData.mob = "ghast";
  cube(body, "#e4e3dd", 0, 0, 0, 1.14, 1.12, 1.14);
  for (let i = 0; i < 9; i++) {
    const length = [0.54, 0.68, 0.47, 0.7, 0.49, 0.62, 0.45, 0.66, 0.56][i],
      leg = part(
        body,
        "tentacle",
        -0.36 + (i % 3) * 0.36,
        -0.555,
        -0.36 + Math.floor(i / 3) * 0.36,
      );
    cube(leg, "#cfcec8", 0, -length / 2, 0, 0.15, length, 0.15);
    cube(
      leg,
      "#e5e4dc",
      -0.032,
      -length * 0.35,
      0.081,
      0.048,
      length * 0.53,
      0.014,
    );
    tentacles.push(leg);
  }
  for (const x of [-0.25, 0.25]) {
    cube(body, "#77777a", x, 0.07, 0.578, 0.21, 0.037, 0.018);
    cube(body, "#a5a5a5", x - 0.026, -0.065, 0.579, 0.05, 0.23, 0.019);
    cube(body, "#bab9b4", x + 0.045, -0.19, 0.58, 0.046, 0.21, 0.02);
  }
  const mouth = part(body, "mouth", 0, -0.26, 0.58);
  cube(mouth, "#77757a", 0, 0, 0, 0.125, 0.105, 0.02);
  for (const side of [-1, 1]) {
    cube(body, "#d3d3d0", side * 0.36, 0.37, 0.579, 0.1, 0.19, 0.018);
    cube(body, "#c5c6c3", side * 0.578, 0.16, -0.16, 0.018, 0.3, 0.085);
    cube(body, "#d1d2cb", side * 0.25, 0.569, -0.13, 0.12, 0.017, 0.28);
  }
  animations.push((t) => {
    const m = motion(t);
    body.position.y = 1.6 + Math.sin(t * 0.9 + variant) * 0.025;
    body.rotation.y = Math.sin(t * 0.35 + variant) * 0.035;
    mouth.scale.y = 1 + m.work * 0.65;
    for (let i = 0; i < tentacles.length; i++) {
      tentacles[i].rotation.z =
        Math.sin(t * 1.2 + i * 0.85 + variant) * (0.08 + m.work * 0.06);
      tentacles[i].rotation.x = Math.sin(t * 1.1 + i) * 0.07 + m.walk * 0.1;
    }
  });
  return root;
}

export function wither(parent, animations, variant = 0) {
  const root = group(parent),
    body = part(root, "body"),
    heads = [],
    motion = mobEnvelope(root, variant),
    bone = "#34363a",
    edge = "#53565a";
  root.userData.mob = "wither";
  cube(body, bone, 0, 1.02, -0.035, 0.16, 0.91, 0.19);
  cube(body, edge, 0, 1.45, 0, 1.35, 0.13, 0.16);
  for (let j = 0; j < 3; j++) {
    const rib = part(body, "rib", 0, 1.22 - j * 0.2, 0);
    cube(rib, edge, 0, 0, 0, 0.66 - j * 0.12, 0.065, 0.16);
    for (const side of [-1, 1])
      cube(rib, bone, side * (0.3 - j * 0.06), -0.06, 0.08, 0.065, 0.16, 0.11);
  }
  for (const x of [-0.64, 0, 0.64]) {
    const central = x === 0,
      sz = central ? 0.48 : 0.35,
      head = part(body, "head", x, central ? 1.72 : 1.52, 0.02);
    cube(head, bone, 0, 0, 0, sz, sz, sz);
    for (const side of [-1, 1])
      cube(
        head,
        "#c3c8bd",
        side * sz * 0.23,
        0.025,
        sz / 2 + 0.011,
        sz * 0.22,
        0.047,
        0.022,
      );
    cube(
      head,
      "#a0a7a0",
      0,
      -sz * 0.22,
      sz / 2 + 0.014,
      sz * 0.43,
      0.038,
      0.019,
    );
    cube(
      head,
      edge,
      -sz * 0.3,
      sz * 0.34,
      sz / 2 + 0.011,
      sz * 0.17,
      0.035,
      0.017,
    );
    heads.push(head);
  }
  animations.push((t) => {
    const m = motion(t);
    body.position.y = Math.sin(t * 1.15 + variant) * 0.025;
    body.rotation.x = Math.sin(t * 0.67) * 0.025;
    for (let i = 0; i < heads.length; i++) {
      heads[i].rotation.y =
        Math.sin(t * (0.55 + i * 0.12) + i * 2 + variant) *
        (0.16 - m.work * 0.06);
      heads[i].rotation.x = Math.sin(t * 0.8 + i) * 0.025 + m.work * 0.08;
    }
  });
  return root;
}

export function shulker(parent, animations, variant = 0) {
  const root = group(parent),
    shell = part(root, "shell", 0, 0.575, 0),
    head = part(root, "head", 0, 0.43, 0),
    motion = mobEnvelope(root, variant);
  root.userData.mob = "shulker";
  cube(root, "#86658f", 0, 0.185, 0, 0.78, 0.37, 0.78);
  cube(shell, "#9773a1", 0, 0, 0, 0.8, 0.41, 0.8);
  cube(shell, "#a886ad", 0, 0.19, 0, 0.69, 0.035, 0.69);
  for (const side of [-1, 1]) {
    cube(shell, "#72557d", 0, -0.17, side * 0.407, 0.65, 0.045, 0.018);
    cube(shell, "#72557d", side * 0.407, -0.17, 0, 0.018, 0.045, 0.65);
    for (const x of [-0.2, 0.2])
      cube(shell, "#b593bb", x, 0.05, side * 0.407, 0.075, 0.14, 0.017);
  }
  cube(head, "#d8d5b9", 0, 0, 0, 0.33, 0.27, 0.33);
  for (const x of [-0.083, 0.083])
    cube(head, "#51494e", x, 0.025, 0.173, 0.045, 0.045, 0.017);
  animations.push((t) => {
    const m = motion(t),
      peek = Math.pow(Math.max(0, Math.sin(t * 0.6 + variant)), 4),
      open =
        peek * 0.27 * (1 - m.work) +
        m.work * (0.37 + Math.sin(t * 1.4) * 0.015);
    shell.position.y = 0.575 + open;
    shell.rotation.y = open * 0.25;
    head.rotation.y = Math.sin(t * 0.7 + variant) * 0.12;
  });
  return root;
}

export function enderDragon(parent, animations, variant = 0) {
  const root = group(parent),
    body = part(root, "body", 0, 0.2, 0),
    wings = [],
    tail = [],
    neck = [],
    legs = [],
    motion = mobEnvelope(root, variant),
    skin = "#24262d",
    edge = "#565963",
    membrane = "#39323f";
  root.userData.mob = "ender-dragon";
  cube(body, skin, 0, 0, 0, 1.32, 0.52, 0.62);
  cube(body, "#33343b", -0.02, -0.18, 0, 0.98, 0.14, 0.53);
  for (let j = 0; j < 4; j++)
    cube(body, edge, -0.48 + j * 0.3, 0.32, 0, 0.11, 0.18, 0.095);
  // The long articulated neck and tapered tail, rather than the wings alone,
  // establish the dragon silhouette at the small world camera scale.
  let previous = body;
  for (let j = 0; j < 4; j++) {
    const segment = part(
      previous,
      "neck",
      j ? 0.25 : 0.65,
      j ? 0.018 : 0.055,
      0,
    );
    cube(segment, skin, 0.12, 0, 0, 0.29, 0.25, 0.28);
    cube(segment, edge, 0.06, 0.17, 0, 0.07, 0.12, 0.075);
    neck.push(segment);
    previous = segment;
  }
  const head = part(previous, "head", 0.31, 0.055, 0);
  cube(head, skin, 0.17, 0.045, 0, 0.51, 0.39, 0.43);
  cube(head, skin, 0.51, -0.075, 0, 0.45, 0.2, 0.36);
  cube(head, "#3f414b", 0.36, 0.165, 0, 0.18, 0.06, 0.45);
  const jaw = part(head, "jaw", 0.16, -0.145, 0);
  cube(jaw, "#363740", 0.29, -0.035, 0, 0.56, 0.085, 0.34);
  for (const side of [-1, 1]) {
    cube(head, "#aa61cf", 0.3, 0.075, side * 0.224, 0.18, 0.058, 0.019);
    cube(head, "#e5b3f3", 0.31, 0.075, side * 0.239, 0.065, 0.046, 0.013);
    cube(head, "#15151d", 0.68, -0.015, side * 0.145, 0.069, 0.039, 0.02);
    const horn = part(head, "horn", 0.055, 0.24, side * 0.15);
    cube(horn, edge, -0.045, 0.1, 0, 0.075, 0.22, 0.075);
    cube(horn, "#7c7d82", -0.08, 0.23, 0, 0.065, 0.07, 0.065);
    for (const x of [0.45, 0.6])
      cube(jaw, "#8a8890", x, -0.004, side * 0.16, 0.032, 0.07, 0.028);
    // Two joints per wing with a stepped, tapered membrane and exposed fingers.
    const wing = part(body, "wing", 0.24, 0.13, side * 0.28),
      tip = part(wing, "wing-tip", -0.05, 0, side * 1.08);
    cube(wing, edge, 0.025, 0, side * 0.53, 0.11, 0.12, 1.08);
    cube(tip, edge, -0.12, 0, side * 0.56, 0.085, 0.09, 1.2);
    const widths = [1.08, 1.01, 0.89, 0.81, 0.69, 0.56, 0.47, 0.31];
    for (let j = 0; j < 8; j++) {
      const span = 0.27,
        z = side * (0.12 + j * span),
        w = widths[j],
        host = j < 4 ? wing : tip,
        localZ = j < 4 ? z : z - side * 1.08;
      cube(host, membrane, -w / 2 - 0.015, -0.018, localZ, w, 0.028, span);
    }
    for (const [x, z, length] of [
      [-0.38, 0.6, 0.75],
      [-0.61, 0.75, 0.7],
    ]) {
      const finger = cube(wing, edge, x, 0, side * z, 0.055, 0.057, length);
      finger.rotation.y = side * 0.36;
    }
    wings.push({ root: wing, tip, side });
    // Four tucked legs, with articulated hocks and three square claws each.
    for (const x of [-0.46, 0.43]) {
      const leg = part(body, "leg", x, -0.2, side * 0.26),
        hind = x < 0;
      cube(
        leg,
        skin,
        -0.045,
        -0.14,
        side * 0.06,
        hind ? 0.24 : 0.16,
        0.33,
        0.17,
      );
      cube(leg, "#34353c", -0.16, -0.29, side * 0.065, 0.31, 0.1, 0.14);
      for (let j = 0; j < 3; j++)
        cube(
          leg,
          "#7c7c80",
          -0.3,
          -0.33,
          side * 0.065 + (j - 1) * 0.07,
          0.105,
          0.065,
          0.037,
        );
      legs.push(leg);
    }
  }
  previous = body;
  for (let j = 0; j < 9; j++) {
    const segment = part(
        previous,
        "tail",
        j ? -0.28 : -0.68,
        j ? -0.008 : -0.02,
        0,
      ),
      thickness = 0.27 - j * 0.023;
    cube(segment, skin, -0.15, 0, 0, 0.33, thickness, thickness);
    if (j < 7)
      cube(
        segment,
        edge,
        -0.16,
        thickness / 2 + 0.046,
        0,
        0.067,
        0.11 - j * 0.007,
        0.059,
      );
    tail.push(segment);
    previous = segment;
  }
  animations.push((t) => {
    const m = motion(t),
      beat = m.phase * 1.65;
    head.rotation.y = Math.sin(t * 0.5 + variant) * 0.045;
    head.rotation.z = Math.sin(t * 0.9) * 0.035 - m.work * 0.04;
    jaw.rotation.z =
      -0.025 -
      Math.max(0, Math.sin(t * 0.73 + variant)) * 0.065 -
      m.work * 0.06;
    for (let i = 0; i < neck.length; i++)
      neck[i].rotation.y = Math.sin(t * 0.8 - i * 0.5 + variant) * 0.025;
    for (const wing of wings) {
      wing.root.rotation.x =
        Math.sin(beat) * (0.24 + m.walk * 0.13 + m.work * 0.06) * wing.side;
      wing.tip.rotation.x = Math.sin(beat - 0.55) * 0.18 * wing.side;
    }
    for (let i = 0; i < legs.length; i++)
      legs[i].rotation.z = Math.sin(t * 1.2 + i) * 0.035;
    for (let i = 0; i < tail.length; i++)
      tail[i].rotation.y = Math.sin(t * 1.3 - i * 0.5 + variant) * 0.046;
  });
  return root;
}
