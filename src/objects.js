import { mineSite } from './mine-model.js';
import { LIFE_MODEL_IDS, lifeBuilding } from './life-models.js';
import {gardenModel} from './garden-models.js';
import { decorationStall } from './decoration-stall-model.js';
import { makeNetworkFacility } from './network-models.js';
import { observatory } from './observatory-model.js';
import { applyFacilityUpgrades } from "./upgrade-models.js";
import * as T from "three";
import {
  ModelKit,
  box,
  cube,
  group,
  mat,
  ringGeometry,
  blockBox,
  P,
} from "./models.js";
import { villageBuilding, broadcastHouse } from "./village-models.js";
import { endPortal } from "./end-portal.js";
import { industrialBuilding } from "./industrial-models.js";
import { blockFacility, FACILITY_TYPES } from "./facility-models.js";
import { STUDIO_MODEL_IDS, studioDeviceModel } from "./studio-device-models.js";
import { specialtyStall } from "./specialty-stalls.js";
import { makeMailbox, updateMailbox } from "./mailbox-model.js";
import { mailSummary, postalLevel } from "./mail.js";
import { n } from "./game.js";
import { extraEnabled } from "./collection.js";
import {
  copperGolem,
  ironGolem,
  blaze,
  farmAnimal,
  humanoidMob,
  magmaCube,
  ghast,
  wither,
  shulker,
  enderDragon,
} from "./mob-models.js";

export function makeObject(parent, item, state, animations) {
  const root = group(parent),
    kit = new ModelKit(root, animations, state),
    type = item.model,
    id = item.id;
  root.userData.item = id;
  const basic = {
    farm: () => kit.cropPatch(0, 0),
    drill: () => kit.drill(0, 0, n(state, id)),
    windmill: () => kit.windmill(0, 0, n(state, id)),
    slime: () => kit.slimeMachine(0, 0),
    universe: () => kit.universe(0, 0),
    netherportal: () => netherPortal(root),
    endportal: () => endPortal(root, state, animations),
  };
  if (LIFE_MODEL_IDS.includes(id)) {
    lifeBuilding(root, id, state);
  } else if (["M4","M5","M7","M15"].includes(id)) {
    makeNetworkFacility(root,id,state,animations);
  } else if (id === "X7" && !extraEnabled(state, "garden")) {
    cube(root, "#b4a287", 0, 0.035, 0, 0.9, 0.07, 0.9);
    cube(root, "#916c4b", 0, 0.072, 0, 0.73, 0.015, 0.73);
  } else if (id === "V20") {
    root.add(gardenModel(Math.max(1,n(state,id))));
  } else if (id === "V19") {
    observatory(root,state);
  } else if (id === "V18") {
    const model = makeMailbox(
      root,
      Math.max(1, postalLevel(state)),
      mailSummary(state).unread,
    );
    const update = () => {
      const summary = mailSummary(state);
      updateMailbox(model, {
        level: Math.max(1, postalLevel(state)),
        unread: summary.unread,
        ready: summary.unclaimed > 0,
      });
    };
    update();
    animations.push(update);
  } else if (["N4", "N12", "M17"].includes(id))
    industrialBuilding(root, id, animations);
  else if (id === "L2") broadcastHouse(root, animations, false, state);
  else if (STUDIO_MODEL_IDS.includes(id)) {
    const grounded = group(root, 0, -0.2, 0);
    studioDeviceModel(grounded, id, state, animations);
  } else if (id === "X2") decorationStall(root, n(state,id));
  else if (id === "N2") specialtyStall(root, id);
  else if (["V3", "V14", "V17"].includes(id))
    villageBuilding(root, id, animations);
  else if (FACILITY_TYPES.has(type)) blockFacility(root, type, animations);
  else if (basic[type]) basic[type]();
  else if (type === "pen") {
    for (const x of [-0.65, 0.65])
      for (const z of [-0.55, 0, 0.55])
        blockBox(root, "log", P.wood, x, 0.36, z, 0.095, 0.72, 0.095);
    for (const y of [0.3, 0.56]) {
      for (const x of [-0.65, 0.65])
        blockBox(root, "wood", P.wood, x, y, 0, 0.07, 0.09, 1.14);
      blockBox(root, "wood", P.wood, 0, y, -0.55, 1.3, 0.09, 0.07);
      // Two short gate leaves retain a clear opening into the pasture.
      for (const x of [-0.5, 0.5])
        blockBox(root, "wood", P.wood, x, y, 0.55, 0.3, 0.09, 0.07);
    }
  } else if (type === "mine") {
    mineSite(root,state,animations);
  } else if (type === "soulsand") {
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        blockBox(
          root,
          "cobblestone",
          "#92785e",
          x * 0.43,
          0.175,
          z * 0.43,
          0.42,
          0.35,
          0.42,
        );
        for (const eye of [-0.07, 0.07])
          box(
            root,
            "#554e4a",
            x * 0.43 + eye,
            0.361,
            z * 0.43 - 0.055,
            0.06,
            0.017,
            0.07,
          );
        box(
          root,
          "#554e4a",
          x * 0.43,
          0.361,
          z * 0.43 + 0.075,
          0.075,
          0.017,
          0.09,
        );
      }
  } else if (type === "chorus") {
    for (let i = 0; i < 3; i++) {
      const stem = group(root, (i - 1) * 0.35, 0, (i % 2) * 0.2);
      blockBox(stem, "purpur", "#786885", 0, 0.8, 0, 0.17, 1.6, 0.17);
      blockBox(stem, "purpur", "#ae97b2", 0.15, 1.5, 0, 0.48, 0.4, 0.4);
      blockBox(stem, "purpur", "#99839e", -0.1, 1.05, 0.1, 0.4, 0.3, 0.4);
      const glow = box(stem, "#ebdcf1", 0.15, 1.72, 0, 0.16, 0.06, 0.16);
      glow.userData.facilityPart = "chorus-harvest";
      animations.push((t) => {
        stem.rotation.z = Math.sin(t + i) * 0.02;
        const age =
          state.play - (state.dimensions?.chorusWave || -10) - i * 0.24;
        const pulse =
          age >= 0 && age < 0.65 ? Math.sin((Math.PI * age) / 0.65) : 0;
        glow.visible = pulse > 0;
        glow.position.y = 1.72 + pulse * 0.18;
      });
    }
  } else if (type === "garden") {
    kit.lantern(0, 0);
    for (let j = 0; j < 8; j++)
      kit.flower(Math.sin(j) * 0.65, Math.cos(j) * 0.65, j);
  } else if (type === "project") {
    blockBox(root, "stone", "#80a89a", 0, 0.65, 0, 1.15, 1.3, 1.15);
    for (let j = 0; j < 3; j++)
      box(root, P.cream, -0.32 + j * 0.32, 0.7, 0.59, 0.17, 0.4, 0.025);
    for (let j = 0; j < 3; j++) {
      const ring = new T.Mesh(
        ringGeometry,
        mat(["#cbd8a4", "#d6a275", "#b3a0c7"][j]),
      );
      ring.scale.setScalar(1 + j * 0.2);
      ring.position.y = 1.3 + j * 0.45;
      root.add(ring);
      animations.push((t) => {
        ring.rotation.y = t * 0.1;
        ring.rotation.x = 0.8 + j * 0.3;
        ring.visible = state.project / 180000 > j / 3;
      });
    }
  } else {
    // Non-placeable blueprints have their own icon renderers. This small token
    // keeps future unknown abilities visible without inventing a world building.
    blockBox(root, "stone", "#9da5a0", 0, 0.1, 0, 0.8, 0.2, 0.8);
    box(root, P.yellow, 0, 0.32, 0, 0.22, 0.24, 0.22);
  }
  if (!["M4","M7"].includes(id)) applyFacilityUpgrades(root, id, state, animations);
  root.scale.setScalar(0.72);
  if (n(state, id) >= 5 && !["M4","M5","M6","M7","M15","M2","E8"].includes(id)) {
    const marker = group(root, 0.65, 0.2, -0.35);
    for (let i = 0; i < Math.min(3, Math.floor(n(state, id) / 5)); i++)
      box(marker, P.yellow, 0, i * 0.2, 0, 0.21, 0.17, 0.21);
  }
  return root;
}
export function makeActor(parent, id, animations, index = 0, state = null) {
  const g = group(parent);
  if (["V8", "V9", "V10"].includes(id)) {
    farmAnimal(g, id, animations, index);
  } else if (id === "V15") {
    copperGolem(g, index);
  } else if (id === "V16") {
    ironGolem(g, animations, () => !!g.userData.walking, index);
  } else if (id === "N3") {
    blaze(g, animations, index);
  } else if (id === "N5") {
    magmaCube(g, animations, index);
  } else if (id === "N6") {
    ghast(g, animations, index);
  } else if (id === "N9") {
    wither(g, animations, index);
  } else if (id === "E5") {
    shulker(g, animations, index);
  } else if (id === "E9") {
    enderDragon(g, animations, index);
  } else if (id === "V2") {
    box(g, "#ac835e", 0, 1.13, 0, 0.42, 0.5, 0.4);
    box(g, "#795b42", 0, 1.45, 0, 0.45, 0.13, 0.42);
    box(g, "#4e4538", 0, 1.2, 0.21, 0.34, 0.055, 0.025);
    for (const x of [-0.11, 0.11]) {
      box(g, "#d9d6ad", x, 1.12, 0.214, 0.085, 0.08, 0.026);
      box(g, "#4e7161", x, 1.12, 0.231, 0.04, 0.055, 0.015);
    }
    box(g, "#9a714f", 0, 0.99, 0.29, 0.13, 0.26, 0.18);
    box(
      g,
      ["#79583d", "#695a47", "#7d6948"][index % 3],
      0,
      0.55,
      0,
      0.43,
      0.72,
      0.32,
    );
    box(g, "#a27b58", 0, 0.72, 0.24, 0.57, 0.17, 0.17);
    box(g, "#614b37", 0, 0.69, 0.21, 0.44, 0.12, 0.2);
    for (const x of [-0.12, 0.12])
      box(g, "#4c453a", x, 0.08, 0, 0.14, 0.17, 0.24);
  } else {
    humanoidMob(g, id, animations, index);
  }
  if (state) applyFacilityUpgrades(g, id, state, animations);
  if (["V8", "V9", "V10"].includes(id)) {
    for (const child of g.children) child.position.x -= 0.14;
    g.scale.setScalar(0.5);
  } else g.scale.setScalar(id === "E9" ? 0.8 : 0.64);
  g.userData.item = id;
  return g;
}
function netherPortal(root) {
  for (const x of [-0.68, 0.68])
    for (let y = 0; y < 4; y++)
      blockBox(
        root,
        "obsidian",
        "#494452",
        x,
        0.465 + y * 0.44,
        0,
        0.4,
        0.44,
        0.45,
      );
  blockBox(root, "obsidian", "#494452", 0, 2.15, 0, 1.76, 0.3, 0.5);
  blockBox(root, "obsidian", "#494452", 0, 0.15, 0, 1.76, 0.3, 0.65);
  const field = box(root, "#aa86bc", 0, 1.15, 0, 0.97, 1.72, 0.045);
  field.material = mat("#aa86bc", 0.45);
  for (let j = 0; j < 6; j++)
    box(
      root,
      j % 2 ? "#bd9bc9" : "#8966a2",
      -0.31 + (j % 3) * 0.31,
      0.56 + Math.floor(j / 3) * 0.76,
      0.032,
      0.12 + (j % 2) * 0.12,
      0.15,
      0.018,
    );
  return root;
}
