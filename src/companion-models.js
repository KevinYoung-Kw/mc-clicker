import {makeHaulerCart} from './life-models.js';
import { cube, group } from "./models.js";
import { copperGolem } from "./mob-models.js";
import { createPickaxe } from "./pickaxe.js";
import { createResidentMotion } from "./resident-motion.js";
import {
  appearance,
  SKIN,
  HAIR,
  COATS,
  JOBS,
  skillLevel,
} from "./residents.js";
export function makeResident(parent, r, animations, options = {}) {
  const a = r.look || appearance(0),
    g = group(parent),
    skin = SKIN[a.skin % 6],
    hair = HAIR[a.hair % 6],
    coat = COATS[a.coat % 10],
    job = options.job || r.job;
  const multiplier = Number.isFinite(options.scale)
    ? Math.max(0.1, Math.min(2, options.scale))
    : 0.7;
  g.scale.setScalar(a.height * multiplier);
  g.userData.resident = r.id;
  g.userData.item = "V2";
  g.userData.dynamic = true;
  g.userData.residentRig = "hinged-v1";
  const body = group(g, 0, 0.46, 0);
  body.userData.mobPart = "body";
  cube(body, coat, 0, 0.18, 0, 0.37, 0.48, 0.28);
  cube(body, "#504b40", 0, -0.06, 0, 0.38, 0.09, 0.29);
  const legs = [];
  for (const x of [-0.1, 0.1]) {
    const leg = group(g, x, 0.24, 0);
    leg.userData.mobPart = "leg";
    leg.userData.side = x < 0 ? "left" : "right";
    cube(leg, coat, 0, -0.04, 0, 0.14, 0.32, 0.15);
    cube(leg, "#514435", 0, -0.2, 0.045, 0.16, 0.08, 0.22);
    legs.push(leg);
  }
  const head = group(body, 0, 0.56, 0);
  head.userData.mobPart = "head";
  cube(head, skin, 0, 0, 0, 0.36, 0.4, 0.34);
  cube(head, hair, 0, 0.215, 0, 0.38, 0.06, 0.36);
  // Hair is a separate outer layer, with no shared front/side plane with skin.
  cube(head, hair, -0.156, 0.11, -0.035, 0.1, 0.2 + a.style * 0.025, 0.37);
  if (a.style > 1) cube(head, hair, 0.14, 0.1, -0.11, 0.09, 0.23, 0.13);
  cube(head, "#4a3f34", 0, 0.055, 0.177, 0.3, 0.045, 0.025);
  for (const x of [-0.09, 0.09]) {
    cube(head, "#e2dfc7", x, -0.005, 0.178, 0.075, 0.06, 0.025);
    cube(head, "#47765a", x, -0.005, 0.195, 0.032, 0.055, 0.015);
  }
  cube(head, skin, 0, -0.1, 0.225, 0.105, 0.21, 0.13);
  cube(head, "#805d43", 0, -0.185, 0.3, 0.1, 0.035, 0.016);
  if (a.beard) {
    cube(head, hair, 0, -0.185, 0.17, 0.28, 0.09, 0.025);
    for (const x of [-0.135, 0.135])
      cube(head, hair, x, -0.11, 0.17, 0.05, 0.15, 0.025);
  }
  if (a.glasses) {
    for (const x of [-0.09, 0.09]) {
      cube(head, "#3b5356", x, 0.035, 0.205, 0.11, 0.025, 0.025);
      cube(head, "#3b5356", x, -0.055, 0.205, 0.11, 0.018, 0.025);
    }
    cube(head, "#3b5356", 0, 0, 0.211, 0.045, 0.02, 0.018);
  }
  const arms = [],
    elbows = [];
  for (const x of [-0.245, 0.245]) {
    const arm = group(body, x, 0.33, 0);
    arm.userData.mobPart = "arm";
    arm.userData.side = x < 0 ? "left" : "right";
    cube(arm, coat, 0, -0.085, 0, 0.13, 0.21, 0.16);
    const elbow = group(arm, 0, -0.18, 0);
    elbow.userData.mobPart = "elbow";
    elbow.userData.side = arm.userData.side;
    cube(elbow, coat, 0, -0.025, 0, 0.122, 0.065, 0.15);
    cube(elbow, skin, 0, -0.095, 0.005, 0.12, 0.11, 0.15);
    arms.push(arm);
    elbows.push(elbow);
  }
  if (job === "farmer") {
    cube(head, "#ccab60", 0, 0.23, 0, 0.59, 0.055, 0.5);
    cube(head, "#dac076", 0, 0.3, -0.025, 0.39, 0.12, 0.35);
    cube(head, coat, 0, 0.25, 0.21, 0.23, 0.04, 0.025);
  }
  if (job === "miner") {
    cube(head, "#b7bca8", 0, 0.25, 0, 0.42, 0.13, 0.4);
    cube(head, "#f0d488", 0, 0.28, 0.23, 0.13, 0.1, 0.06);
  }
  if (job === "crafter" || job === "rancher") {
    cube(body, "#d7c5a0", 0, 0.14, 0.151, 0.25, 0.39, 0.025);
    cube(body, "#907b59", 0, 0.045, 0.17, 0.16, 0.12, 0.035);
  }
  if (["musician", "engineer", "stagehand", "host"].includes(job)) {
    for (const x of [-0.22, 0.22])
      cube(head, "#31525b", x, 0.015, 0, 0.075, 0.19, 0.16);
    cube(head, "#31525b", 0, 0.27, 0, 0.47, 0.055, 0.055);
  }
  if (job === "merchant") {
    cube(body, "#dbc69b", 0, .05, .16, .23, .3, .025);
    cube(head, "#5b7660", 0, .215, 0, .40, .07, .38);
  }
  if (job === "hauler") {
    cube(body, "#936c45", 0, 0.16, -0.26, 0.35, 0.4, 0.18);
    for (const y of [0.02, 0.27])
      cube(body, "#c6a275", 0, y, -0.36, 0.39, 0.055, 0.03);
  }
  const tools = group(elbows[1], 0, -0.1, 0.09),
    shearJaws = [];
  tools.userData.mobPart = "hand-tool";
  if (job === "miner") {
    const pick = createPickaxe("#91a4a6");
    pick.scale.setScalar(0.34);
    pick.rotation.z = 0.12;
    pick.position.y = 0.025;
    tools.add(pick);
  } else if (job === "crafter") {
    cube(tools, "#a98a58", 0, -0.025, 0, 0.035, 0.23, 0.035);
    cube(tools, "#819aa0", 0, 0.09, 0, 0.16, 0.075, 0.075);
  } else if (job === "farmer") {
    cube(tools, "#a98a58", 0, -0.025, 0, 0.028, 0.24, 0.035);
    cube(tools, "#8a9877", 0.025, -0.15, 0.015, 0.13, 0.035, 0.09);
  } else if (job === "rancher") {
    for (const side of [-1, 1]) {
      const jaw = group(tools, side * 0.026, 0, 0);
      cube(jaw, "#a8b6a8", side * 0.012, 0.055, 0, 0.028, 0.15, 0.025);
      cube(jaw, "#5d6f65", 0, -0.055, 0, 0.045, 0.055, 0.035);
      shearJaws.push(jaw);
    }
  } else if (job === "engineer") {
    cube(tools, "#ad815b", 0, 0, 0, 0.035, 0.15, 0.035);
    cube(tools, "#c17561", 0, 0.09, 0, 0.055, 0.045, 0.04);
  } else if (job === "researcher") {
    cube(tools, "#547561", 0, 0, 0, .18, .24, .05);
    cube(tools, "#e5dbbc", .015, 0, .031, .14, .20, .012);
  } else if (job === "host") {
    tools.rotation.x = Math.PI;
    cube(tools, "#3b4b49", 0, 0, 0, 0.045, 0.16, 0.045);
    cube(tools, "#6c7d73", 0, 0.102, 0, 0.092, 0.09, 0.08);
    for (let j = 0; j < 3; j++)
      cube(
        tools,
        "#32453f",
        -0.027 + j * 0.027,
        0.105,
        0.045,
        0.012,
        0.055,
        0.014,
      );
    cube(body, "#d5bd87", 0.065, 0.26, 0.158, 0.065, 0.095, 0.021);
  } else if (job === "stagehand") {
    const board = group(elbows[0], 0, -0.1, 0.09);
    cube(board, "#476354", 0, 0, 0, 0.16, 0.2, 0.035);
    cube(board, "#ded4af", 0, 0.045, 0.025, 0.11, 0.065, 0.014);
  }
  const rank = skillLevel(r);
  if (rank >= 3) {
    for (let j = 0; j < (rank >= 5 ? 2 : 1); j++)
      cube(body, "#e2bb60", 0.075 + j * 0.05, 0.26, 0.164, 0.035, 0.045, 0.02);
  }
  const cargo = group(body, 0, 0.08, 0.39);
  cargo.userData.mobPart = "cargo";
  cube(cargo, "#aa8051", 0, 0, 0, 0.4, 0.3, 0.3);
  cube(cargo, "#dcc593", 0, 0, 0.155, 0.08, 0.32, 0.016);
  const cart=job==='hauler'&&!options.indoor?makeHaulerCart(g):null;
  const wheels=[],cartLoad=cart?group(cart,0,.26,0):null;
  if(cartLoad)cube(cartLoad,'#ac8753',0,0,0,.3,.2,.24);
  if(cart){cart.position.set(0,.045,.44);cart.traverse(o=>{if(o.userData.cartWheel)wheels.push(o)});cart.visible=false;}
  const motion = createResidentMotion(r, { indoor: !!options.indoor, job });
  cargo.visible = !!r.cargo;
  animations.push((t) => {
    const pose = motion(t, {
      speaking:
        typeof options.speaking === "function"
          ? !!options.speaking()
          : !!options.speaking,
    });
    cargo.visible = !!r.cargo;
    tools.visible = pose.activity !== "rest";
    const equipped=!!cart&&!!options.cart?.();
    if(cartLoad)cartLoad.visible=!!r.cargo;
    if(cart){cart.visible=equipped&&pose.activity!=='rest';wheels.forEach(w=>w.rotation.x=pose.activity==='travel'?t*3:0);}
    cargo.visible=!!r.cargo&&!equipped;
    cargo.position.y = 0.08 + pose.cargoLift;
    cargo.rotation.x = pose.cargoPitch;
    body.rotation.set(pose.bodyPitch, pose.bodyYaw, pose.bodyRoll);
    body.position.y = 0.46 + pose.breath;
    head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
    arms[0].rotation.set(pose.armLX, pose.armLY, pose.armLZ);
    arms[1].rotation.set(pose.armRX, pose.armRY, pose.armRZ);
    elbows[0].rotation.x = pose.elbowL;
    elbows[1].rotation.x = pose.elbowR;
    for (let i = 0; i < 2; i++) {
      const angle = i ? pose.legR : pose.legL;
      legs[i].rotation.x = angle;
      // Exact lower bound of the swinging voxel shoe: it never penetrates the
      // ground or lifts both resting feet with torso breathing.
      legs[i].position.y =
        0.24 * Math.cos(angle) +
        0.11 * Math.abs(Math.sin(angle)) +
        0.045 * Math.sin(angle) +
        (i ? pose.stepR : pose.stepL) -
        Math.min(pose.stepL, pose.stepR);
    }
    shearJaws.forEach((jaw, i) => {
      jaw.rotation.z = (i ? 1 : -1) * pose.snip * 0.18;
    });
    g.userData.residentMotion = pose;
  });
  return g;
}
export function makeCopper(parent, a, animations) {
  const {
    root: g,
    body,
    head,
    arms,
    legs,
  } = copperGolem(parent, (Number(a.id.split("-")[1]) || 1) - 1);
  // Attach head and shoulders to the torso pivot while preserving rest poses.
  body.add(head);
  head.position.y = 0.39;
  for (const arm of arms) {
    body.add(arm);
    arm.position.y = 0.15;
  }
  const antenna = head.children.find(
    (o) => o.userData.mobPart === "lightning-rod",
  );
  g.userData.item = "V15";
  g.userData.golem = a.id;
  g.scale.setScalar(0.64);
  g.userData.dynamic = true;
  cube(
    body,
    "#7e6149",
    0,
    0.08,
    -0.23,
    0.32 + 0.05 * (a.upgrades?.basket || 0),
    0.27 + 0.09 * a.upgrades.basket,
    0.16,
  );
  cube(body, "#d1b170", 0, -0.05, -0.325, 0.34, 0.04, 0.03);
  const cargo = group(body, 0, 0.04, 0.37);
  cargo.userData.mobPart = "cargo";
  cube(cargo, "#ab8454", 0, 0, 0, 0.43, 0.32, 0.31);
  cube(cargo, "#e1c68c", 0, 0, 0.16, 0.07, 0.34, 0.02);
  if (a.upgrades?.bell)
    cube(body, "#cbd477", 0.26, 0.4, -0.02, 0.1, 0.13, 0.09);
  if (a.upgrades?.sorting)
    for (let i = 0; i < 3; i++)
      cube(
        body,
        ["#6b9d78", "#caae67", "#9a85ad"][i],
        -0.09 + i * 0.09,
        0.09,
        -0.32,
        0.06,
        0.08,
        0.015,
      );
  const motion = createResidentMotion(a, { job: "hauler" });
  cargo.visible = !!a.cargo;
  animations.push((t) => {
    const pose = motion(t);
    cargo.visible = !!a.cargo;
    cargo.position.y = 0.04 + pose.cargoLift;
    body.rotation.set(pose.bodyPitch * 0.75, 0, pose.bodyRoll * 0.3);
    head.rotation.set(pose.headPitch * 0.8, pose.headYaw * 0.8, 0);
    if (antenna) antenna.rotation.z = pose.antenna;
    for (let i = 0; i < 2; i++) {
      const angle = (i ? pose.legR : pose.legL) * 0.83;
      legs[i].rotation.x = angle;
      legs[i].position.y =
        0.223 * Math.cos(angle) +
        0.105 * Math.abs(Math.sin(angle)) +
        0.025 * Math.sin(angle) +
        0.002 +
        ((i ? pose.stepR : pose.stepL) - Math.min(pose.stepL, pose.stepR)) *
          0.7;
      arms[i].rotation.x = i ? pose.armRX : pose.armLX;
    }
    // A tiny planted-weight response remains compatible with the existing
    // courier silhouette; body/head movement supplies the expressive motion.
    g.rotation.z = pose.activity === "travel" ? pose.bodyRoll * 0.15 : 0;
    g.userData.courierMotion = pose;
  });
  return g;
}
