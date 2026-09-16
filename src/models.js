import { pixelRingGeometry } from "./voxel-geometry.js";
import { currentCrop } from "./collection.js";
import * as T from "three";
import { blockMat } from "./block-materials.js";
export { blockMat } from "./block-materials.js";

// Original model kit. Shared proportions, materials and lighting replace mixed asset packs.
const boxGeometry = new T.BoxGeometry(1, 1, 1);
// These boxes have identical vertices, normals and UVs. Sharing their geometry
// lets the renderer batch equal materials without changing any model detail.
const hardBox = boxGeometry;
const cylinderGeometry = new T.BoxGeometry(1.65, 1, 1.65);
const sphereGeometry = new T.BoxGeometry(1.65, 1.65, 1.65);
const ringGeometry = pixelRingGeometry(1, 0.17, 0.1, 0.09);
const jewelGeometry = new T.OctahedronGeometry(0.1),
  sunGeometry = boxGeometry;
const materials = new Map();
const colorSources = new WeakSet(), colorBatches = new Map();
const slimeShellMaterial = new T.MeshStandardMaterial({
  color: "#99c77a", transparent: true, opacity: 0.3,
  depthWrite: false, roughness: 0.9, side: T.FrontSide,
});
function pixelMap(kind) {
  const size = 16,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        noise = ((x * 17 + y * 31 + x * y * 7) % 19) - 9;
      let shade;
      if (kind === "wood") {
        shade = y % 4 === 0 ? 174 : 224 + noise;
      } else if (kind === "dirt") {
        shade = 219 + noise * 3;
      } else if (kind === "sand") {
        // Quiet dune: even field, sparse 1px grains. Same density as rock, not speckle.
        shade = 240 + Math.floor(noise / 4);
        if ((x * 5 + y * 11) % 17 === 0) shade = 222;
        if ((x * 9 + y * 3) % 19 === 2) shade = 252;
      } else if (kind === "earth") {
        // Packed soil: clustered 1–2px clods, not a 2×2 weave.
        const seed = (x * 7 + y * 13) % 23 === 0;
        const beside =
          ((x - 1) * 7 + y * 13) % 23 === 0 ||
          (x * 7 + (y - 1) * 13) % 23 === 0;
        shade = 234 + Math.floor(noise / 3);
        if (seed) shade = 204;
        else if (beside) shade = 218;
        if ((x * 3 + y * 7) % 29 === 4) shade = 248;
      } else {
        shade = x % 8 === 0 || y % 8 === 0 ? 182 : 223 + noise * 2;
      }
      for (let k = 0; k < 3; k++) data[i + k] = shade;
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size);
  texture.magFilter = T.NearestFilter;
  // Keep hard pixels close up; prefiltered levels stop subpixel texels from
  // crawling when the camera zooms out. Same filtering as block-materials.
  texture.minFilter = T.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
const pixelMaps = {
  wood: pixelMap("wood"),
  stone: pixelMap("stone"),
  dirt: pixelMap("dirt"),
  sand: pixelMap("sand"),
  earth: pixelMap("earth"),
};
function mat(color, glow = 0) {
  const k = color + "-" + glow;
  if (!materials.has(k))
    materials.set(
      k,
      new T.MeshStandardMaterial({
        color,
        map: ["#977054", "#966f46", "#b58a55", "#665c48"].includes(color)
          ? pixelMaps.wood
          : color === "#916c4b"
            ? pixelMaps.dirt
            : color === "#d7bf82"
              ? pixelMaps.sand
            : color === "#9a7350"
              ? pixelMaps.earth
            : [
                  "#858c80",
                  "#b4a287",
                  "#727f79",
                  "#747e78",
                  "#adbbab",
                  "#9da5a0",
                  "#c4caba",
                  "#c2c39a",
                  "#c5b591",
                  "#876256",
                ].includes(color)
              ? pixelMaps.stone
              : null,
        roughness: 0.83,
        metalness: 0,
        emissive: color,
        emissiveIntensity: glow,
      }),
    );
  colorSources.add(materials.get(k));
  return materials.get(k);
}
// Same surfaces and lighting, with the base tint carried by instanceColor.
export function colorBatchMaterial(material) {
  if(!colorSources.has(material)||material.version!==0||material.emissiveIntensity!==0||material.transparent||material.opacity!==1||material.side!==T.FrontSide||material.alphaTest!==0||material.roughness!==.83||material.metalness!==0||material.wireframe||!material.depthWrite||material.onBeforeCompile!==T.Material.prototype.onBeforeCompile)return null;
  if(material.map&&!Object.values(pixelMaps).includes(material.map))return null;
  const key=material.map?.uuid||'plain';
  if(!colorBatches.has(key)){const batch=material.clone();batch.color.set(0xffffff);batch.emissive.set(0x000000);colorBatches.set(key,batch);}
  return colorBatches.get(key);
}
function shape(parent, geometry, color, x, y, z, sx, sy, sz, glow = 0) {
  const m = new T.Mesh(geometry, mat(color, glow));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p, c, x, y, z, w = 1, h = 1, d = 1) =>
  shape(p, boxGeometry, c, x, y, z, w, h, d);
const cube = (p, c, x, y, z, w = 1, h = 1, d = 1) =>
  shape(p, hardBox, c, x, y, z, w, h, d);
export function blockBox(
  p,
  kind,
  color,
  x,
  y,
  z,
  w = 1,
  h = 1,
  d = 1,
  glow = 0,
) {
  const mesh = new T.Mesh(boxGeometry, blockMat(kind, color, glow));
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = mesh.receiveShadow = true;
  p.add(mesh);
  return mesh;
}
const cyl = (p, c, x, y, z, r = 0.2, h = 0.4) =>
  shape(p, cylinderGeometry, c, x, y, z, r, h, r);
const ball = (p, c, x, y, z, r = 0.2) =>
  shape(p, sphereGeometry, c, x, y, z, r, r, r);
function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function rand(n) {
  return (((Math.sin(n * 71.137 + 42.271) * 43758.5453) % 1) + 1) % 1;
}
const P = {
  cream: "#f8edcf",
  wood: "#977054",
  dark: "#334941",
  green: "#71995b",
  light: "#a8c582",
  orange: "#dd8158",
  stone: "#adbbab",
  red: "#e9664f",
  yellow: "#edbd64",
};

export class ModelKit {
  constructor(root, animators, state) {
    this.root = root;
    this.animators = animators;
    this.state = state;
  }
  tree(x, z, scale) {
    const g = group(this.root, x, 0.35, z);
    g.scale.setScalar(scale);
    box(g, P.wood, 0, 0.45, 0, 0.2, 0.9, 0.2);
    box(g, "#5f844e", 0, 1.06, 0, 0.88, 0.8, 0.86);
    box(g, "#719955", -0.15, 1.43, 0.04, 0.7, 0.62, 0.67);
    box(g, "#94b36a", 0.16, 1.63, -0.05, 0.54, 0.4, 0.5);
    this.animators.push((t) => (g.rotation.z = Math.sin(t * 0.7 + x) * 0.018));
    return g;
  }
  rock(x, z, scale) {
    const m = box(
      this.root,
      "#c1c4b2",
      x,
      0.36 + scale * 0.25,
      z,
      scale * 1.6,
      scale,
      scale,
    );
    m.rotation.y = x;
  }
  flower(x, z, i) {
    const g = group(this.root, x, 0.35, z);
    box(g, "#638659", 0, 0.1, 0, 0.035, 0.2, 0.035);
    for (let j = 0; j < 4; j++)
      box(
        g,
        i % 2 ? "#ed947a" : "#e6cf83",
        Math.sin((j * Math.PI) / 2) * 0.07,
        0.22,
        Math.cos((j * Math.PI) / 2) * 0.07,
        0.11,
        0.06,
        0.11,
      );
    box(g, "#f6e7b3", 0, 0.25, 0, 0.06, 0.05, 0.06);
  }
  lantern(x, z) {
    const g = group(this.root, x, 0.35, z);
    box(g, P.wood, 0, 0.45, 0, 0.07, 0.9, 0.07);
    box(g, P.dark, 0.09, 0.9, 0, 0.26, 0.04, 0.09);
    box(g, "#f1bd64", 0.19, 0.79, 0, 0.19, 0.22, 0.19);
    box(g, P.dark, 0.19, 0.92, 0, 0.23, 0.04, 0.23);
  }
  block() {
    const g = group(this.root, 0, 0.38, 0);
    box(g, "#916c4b", 0, 0.55, 0, 1.68, 1.1, 1.68);
    box(g, "#75a456", 0, 1.12, 0, 1.76, 0.28, 1.76);
    box(g, "#a3c574", -0.26, 1.272, -0.2, 0.98, 0.025, 0.58);
    for (let i = 0; i < 14; i++)
      cube(
        g,
        i % 3 ? "#ad8961" : "#73583d",
        -0.63 + (i % 5) * 0.315,
        0.19 + Math.floor(i / 5) * 0.27,
        0.847,
        0.17,
        0.16,
        0.025,
      );
    for (let i = 0; i < 8; i++)
      cube(
        g,
        "#678b4c",
        rand(i + 33) * 1.6 - 0.8,
        0.91,
        0.86,
        0.18,
        rand(i) * 0.19 + 0.1,
        0.05,
      );
    const sparkle = group(g);
    const diamond = shape(
      sparkle,
      jewelGeometry,
      P.cream,
      0,
      1.66,
      0,
      1,
      1,
      1,
      0.4,
    );
    this.animators.push((t) => {
      diamond.rotation.y = t;
      diamond.position.y = 1.62 + Math.sin(t * 2) * 0.09;
    });
    return g;
  }
  villager() {
    const g = group(this.root);
    box(g, "#c49b75", 0, 0.51, 0, 0.31, 0.31, 0.3);
    box(g, "#b18660", 0, 0.65, 0, 0.34, 0.09, 0.32);
    box(g, "#d2ae86", 0, 0.46, 0.19, 0.08, 0.13, 0.14);
    box(g, "#343e36", -0.076, 0.53, 0.154, 0.045, 0.035, 0.018);
    box(g, "#343e36", 0.076, 0.53, 0.154, 0.045, 0.035, 0.018);
    box(g, "#547b60", 0, 0.24, 0, 0.31, 0.33, 0.23);
    box(g, "#74573f", -0.083, 0.052, 0, 0.09, 0.12, 0.14);
    box(g, "#74573f", 0.083, 0.052, 0, 0.09, 0.12, 0.14);
    box(g, P.wood, 0, 0.27, 0.2, 0.31, 0.12, 0.18);
    box(g, "#87a965", 0, 0.38, 0.2, 0.32, 0.1, 0.2);
    return g;
  }
  cropPatch(x, z) {
    const g = group(this.root, x, 0.35, z);
    for (const x of [-0.66, 0.66]) {
      box(g, "#846145", x, 0.035, 0, 0.41, 0.1, 1.3);
      box(g, "#618b9b", x, 0.09, 0, 0.055, 0.02, 1.25);
    }
    // Ground-level field path, open at both ends; no crops or beams across it.
    for (let j = 0; j < 5; j++)
      box(
        g,
        j % 2 ? "#b3a284" : "#bca984",
        0,
        -0.013,
        -0.54 + j * 0.27,
        0.82,
        0.004,
        0.23,
      );
    const crop = currentCrop(this.state),
      level = this.state?.counts?.V4 || 1;
    const rows = level >= 4 ? 4 : 3,
      columns = 4;
    for (let i = 0; i < columns; i++)
      for (let j = 0; j < rows; j++) {
        const sprout = group(
          g,
          [-0.78, -0.55, 0.55, 0.78][i],
          0.08,
          -0.47 + (j * 0.94) / (rows - 1),
        );
        if (crop.id === "wheat") {
          box(sprout, "#879556", 0, 0.15, 0, 0.035, 0.3, 0.035);
          box(sprout, crop.color, 0, 0.32, 0, 0.11, 0.19, 0.09);
        } else {
          box(
            sprout,
            crop.color,
            0,
            0.075,
            0,
            crop.id === "pumpkin" ? 0.23 : 0.12,
            crop.id === "pumpkin" ? 0.23 : 0.12,
            0.16,
          );
          box(sprout, "#607d3e", 0, 0.19, 0, 0.045, 0.17, 0.04);
          box(sprout, "#81974e", 0, 0.21, 0, 0.22, 0.045, 0.055);
          box(sprout, "#728c42", 0, 0.18, 0, 0.055, 0.045, 0.21);
          if (crop.id === "pumpkin")
            for (const x of [-0.07, 0.06])
              box(sprout, "#a86531", x, 0.07, 0.083, 0.022, 0.18, 0.012);
          if (crop.id === "beet")
            box(sprout, "#974659", 0, 0.24, 0, 0.04, 0.025, 0.2);
        }
        this.animators.push((t) => {
          sprout.rotation.z = Math.sin(t * 1.5 + i + j) * 0.035;
          sprout.scale.y = 0.22 + (this.state?.harvest?.farm ?? 0) * 0.78;
        });
      }
    if (level >= 3)
      for (const x of [-0.79, 0.79])
        box(g, "#94aaa0", x, 0.15, 0, 0.035, 0.1, 1.2);
    if (level >= 6) {
      for (const x of [-0.65, 0.65])
        box(g, P.wood, x, 0.62, -0.56, 0.45, 0.055, 0.055);
      for (const x of [-0.72, 0.72])
        box(g, P.wood, x, 0.33, -0.56, 0.055, 0.66, 0.055);
    }
    for (let i = 0; i < 4; i++) {
      box(g, P.wood, -0.87, 0.24, -0.55 + i * 0.37, 0.05, 0.42, 0.05);
      box(g, P.wood, 0.87, 0.24, -0.55 + i * 0.37, 0.05, 0.42, 0.05);
    }
    box(g, P.wood, -0.87, 0.32, 0, 0.05, 0.07, 1.4);
    box(g, P.wood, 0.87, 0.32, 0, 0.05, 0.07, 1.4);
    return g;
  }
  drill(x, z, n) {
    const g = group(this.root, x, 0, z);
    g.userData.facilityStyle = "redstone-drill";
    blockBox(g, "cobblestone", "#858c80", 0, 0.12, 0, 1.5, 0.24, 1.25);
    for (const xx of [-0.56, 0.56]) {
      blockBox(g, "iron", "#a6aca1", xx, 0.92, 0, 0.2, 1.36, 0.26);
      blockBox(g, "iron", "#56625e", xx, 0.31, 0, 0.32, 0.14, 0.42);
    }
    blockBox(g, "iron", "#89958b", 0, 1.61, 0, 1.42, 0.22, 0.48);
    blockBox(g, "stone", "#59675f", 0, 1.35, -0.1, 0.52, 0.32, 0.52);
    const shaft = group(g, 0, 0, 0.18);
    shaft.userData.facilityPart = "drill-shaft";
    blockBox(shaft, "iron", "#bcc3b6", 0, 0.89, 0, 0.14, 0.9, 0.14);
    for (let i = 0; i < 4; i++)
      blockBox(
        shaft,
        "iron",
        i % 2 ? "#8e9b90" : "#c3cbbd",
        0,
        0.45 + i * 0.12,
        0,
        0.13 + i * 0.065,
        0.08,
        0.13 + i * 0.065,
      );
    blockBox(g, "iron", "#6c7970", 0, 0.35, -0.38, 0.6, 0.22, 0.32);
    for (const xx of [-0.31, 0.31])
      box(g, "#9e493d", xx, 0.254, -0.23, 0.08, 0.024, 0.7);
    box(g, "#d86645", 0.58, 1.26, 0.143, 0.06, 0.12, 0.024);
    this.animators.push((t) => {
      shaft.position.y = Math.sin(t * 5) * 0.085;
    });
    return g;
  }
  windmill(x, z, n) {
    const g = group(this.root, x, 0, z);
    g.userData.facilityStyle = "block-windmill";
    blockBox(g, "cobblestone", "#9da58f", 0, 0.16, 0, 0.94, 0.32, 0.88);
    blockBox(g, "wood", "#c2af83", 0, 1, 0, 0.65, 1.36, 0.64);
    for (const xx of [-0.28, 0.28])
      for (const zz of [-0.28, 0.28])
        blockBox(g, "log", "#876543", xx, 0.99, zz, 0.12, 1.36, 0.12);
    for (let i = 0; i < 4; i++)
      blockBox(
        g,
        "wood",
        "#876543",
        0,
        1.7 + i * 0.12,
        0,
        0.98 - i * 0.22,
        0.12,
        0.92,
      );
    blockBox(g, "iron", "#6f8072", 0, 0.42, 0.329, 0.24, 0.22, 0.024);
    box(g, "#ba6046", 0.07, 0.43, 0.35, 0.04, 0.08, 0.025);
    const fan = group(g, 0, 1.4, 0.53);
    fan.userData.facilityPart = "windmill-rotor";
    blockBox(g, "iron", "#a4aa97", 0, 1.4, 0.42, 0.13, 0.13, 0.3);
    blockBox(fan, "log", "#795b3c", 0, 0, 0, 0.22, 0.22, 0.16);
    for (let i = 0; i < 4; i++) {
      const a = group(fan);
      a.rotation.z = (i * Math.PI) / 2;
      blockBox(a, "wood", "#977054", 0, 0.48, 0, 0.065, 0.95, 0.065);
      blockBox(a, "cloth", "#eee2bc", 0.125, 0.61, 0, 0.21, 0.65, 0.045);
      for (const y of [0.31, 0.61, 0.91])
        blockBox(a, "wood", "#977054", 0.115, y, 0.038, 0.29, 0.035, 0.027);
    }
    this.animators.push(
      (t) => (fan.rotation.z = -t * (0.6 + Math.min(4, n) * 0.15)),
    );
    return g;
  }
  balloon() {
    const g = group(this.root);
    shape(g, sphereGeometry, "#e3a05d", 0, 1, 0, 0.66, 0.8, 0.58);
    box(g, P.cream, 0, 1, 0, 0.15, 1.47, 1.1);
    box(g, P.wood, 0, -0.05, 0, 0.58, 0.27, 0.46);
    for (const x of [-0.23, 0.23])
      box(g, P.wood, x, 0.35, 0, 0.025, 0.65, 0.025);
    this.animators.push((t) => {
      g.position.set(
        Math.sin(t * 0.13) * 3.8,
        3.5 + Math.sin(t) * 0.09,
        -2.5 + Math.cos(t * 0.13) * 1.3,
      );
      g.rotation.y = t * 0.13;
    });
    return g;
  }
  slimeMachine(x, z) {
    const g = group(this.root, x, 0, z);
    g.userData.facilityStyle = "slime-press";
    blockBox(g, "stone", "#778679", 0, 0.125, 0, 1.45, 0.25, 1.2);
    for (const xx of [-0.61, 0.61])
      blockBox(g, "iron", "#aab6a0", xx, 0.75, 0, 0.2, 1, 0.38);
    blockBox(g, "wood", "#b89e6c", 0, 1.31, 0, 1.5, 0.16, 1.2);
    blockBox(g, "iron", "#667766", 0, 1.43, 0, 0.7, 0.08, 0.5);
    const slime = group(g, 0, 0.25, 0);
    slime.userData.facilityPart = "slime-pad";
    box(slime, "#83ad62", 0, 0.385, 0, 0.57, 0.55, 0.55);
    const shell = box(slime, "#a1cc70", 0, 0.385, 0, 0.81, 0.77, 0.79);
    shell.material = slimeShellMaterial;
    shell.castShadow = false;
    shell.renderOrder = 1;
    for (let i of [-1, 1])
      box(slime, "#416141", i * 0.2, 0.49, 0.409, 0.1, 0.11, 0.025);
    box(slime, "#416141", 0, 0.22, 0.41, 0.11, 0.08, 0.025);
    this.animators.push((t) => {
      slime.scale.y = 0.85 + Math.sin(t * 3) * 0.15;
    });
    return g;
  }
  solar(x, z) {
    const g = group(this.root, x, 0.35, z);
    for (let i = 0; i < 3; i++) {
      box(g, P.dark, i * 0.43, 0.42, 0, 0.04, 0.8, 0.04);
      const flower = group(g, i * 0.43, 0.82, 0);
      box(flower, P.yellow, 0, 0, 0, 0.4, 0.4, 0.09);
      box(flower, P.wood, 0, 0, 0.06, 0.24, 0.24, 0.035);
      this.animators.push(
        (t) => (flower.rotation.y = Math.sin(t * 0.2) * 0.45),
      );
    }
    return g;
  }
  flyingPig() {
    const g = group(this.root);
    box(g, "#df9b95", 0, 0, 0, 1.2, 0.68, 0.65);
    box(g, "#e8b1a3", 0.65, 0.12, 0, 0.57, 0.52, 0.55);
    box(g, "#cc8c83", 0.98, 0.03, 0, 0.16, 0.22, 0.31);
    for (let z of [-0.18, 0.18])
      box(g, P.dark, 0.944, 0.24, z, 0.028, 0.065, 0.055);
    for (let x of [-0.4, 0.4])
      for (let z of [-0.2, 0.2])
        box(g, "#b87d73", x, -0.39, z, 0.14, 0.22, 0.15);
    const wings = [];
    for (let z of [-1, 1]) {
      const wing = group(g, 0, 0.13, z * 0.3);
      box(wing, P.cream, 0, 0, z * 0.37, 0.7, 0.075, 0.68);
      wings.push([wing, z]);
    }
    this.animators.push((t) => {
      g.position.set(
        Math.cos(t * 0.19) * 5,
        3.5 + Math.sin(t * 1.8) * 0.19,
        Math.sin(t * 0.19) * 2.4,
      );
      g.rotation.y = -t * 0.19 - Math.PI / 2;
      wings.forEach(([w, z]) => (w.rotation.x = Math.sin(t * 7) * 0.5 * z));
    });
    return g;
  }
  orbital() {
    const g = group(this.root, 0, 3.8, 0);
    const ring = new T.Mesh(ringGeometry, mat("#c2bdb0"));
    ring.scale.set(3.1, 2.6, 3.1);
    ring.rotation.x = Math.PI / 2.5;
    g.add(ring);
    const satellite = group(g);
    box(satellite, P.cream, 0, 0, 0, 0.5, 0.5, 0.5);
    box(satellite, "#728c9c", -0.62, 0, 0, 0.65, 0.06, 0.6);
    box(satellite, "#728c9c", 0.62, 0, 0, 0.65, 0.06, 0.6);
    this.animators.push((t) => {
      satellite.position.set(
        Math.sin(t * 0.5) * 3.1,
        Math.cos(t * 0.5) * 0.8,
        Math.cos(t * 0.5) * 2.45,
      );
      satellite.rotation.y = t * 0.5;
    });
    return g;
  }
  pocketSun() {
    const g = group(this.root, -3.4, 3.6, -1.5);
    shape(g, sunGeometry, "#f4bd62", 0, 0, 0, 1, 1, 1, 0.65);
    const ring = new T.Mesh(ringGeometry, mat("#e9d5a0"));
    ring.scale.setScalar(0.95);
    g.add(ring);
    this.animators.push((t) => {
      ring.rotation.x = t * 0.3;
      ring.rotation.y = t * 0.17;
      g.position.y = 3.6 + Math.sin(t) * 0.09;
    });
    return g;
  }
  portal(x, z) {
    const g = group(this.root, x, 0.35, z);
    for (const xx of [-0.65, 0.65])
      for (let y = 0; y < 4; y++)
        box(g, "#4d5264", xx, 0.28 + y * 0.45, 0, 0.38, 0.43, 0.42);
    box(g, "#4d5264", 0, 2.05, 0, 1.67, 0.35, 0.46);
    box(g, "#4d5264", 0, 0.08, 0, 1.67, 0.19, 0.8);
    const inside = shape(
      g,
      hardBox,
      "#a991ca",
      0,
      1.09,
      0.01,
      0.97,
      1.68,
      0.1,
      0.8,
    );
    this.animators.push(
      (t) => (inside.scale.x = 0.94 + Math.sin(t * 2) * 0.04),
    );
    return g;
  }
  universe(x, z) {
    const g = group(this.root, x, 0.35, z);
    box(g, "#bf8566", 0, 0.2, 0, 1, 0.4, 1);
    box(g, "#705347", 0, 0.41, 0, 0.8, 0.04, 0.8);
    box(g, "#90b599", 0, 0.79, 0, 0.1, 0.75, 0.1);
    const orb = group(g, 0, 1.45, 0);
    // Keep the full rotating orbit inside the planter's two-square plot.
    orb.scale.setScalar(0.55);
    box(orb, "#adcbab", 0, 0, 0, 0.82, 0.82, 0.82);
    const r = new T.Mesh(ringGeometry, mat(P.cream));
    r.scale.setScalar(0.74);
    r.rotation.x = 0.7;
    orb.add(r);
    this.animators.push((t) => {
      orb.rotation.y = t * 0.2;
      orb.position.y = 1.45 + Math.sin(t * 1.6) * 0.08;
    });
    return g;
  }
  conveyor() {
    const g = group(this.root);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const m = box(
        g,
        "#597264",
        Math.sin(a) * 2.9,
        0.405,
        Math.cos(a) * 2.35,
        0.34,
        0.06,
        0.3,
      );
      m.rotation.y = -a;
    }
    for (let i = 0; i < 8; i++) {
      const m = box(g, P.yellow, 0, 0.58, 0, 0.2, 0.2, 0.2);
      this.animators.push((t) => {
        const a = t * 0.3 + (i / 8) * Math.PI * 2;
        m.position.set(Math.sin(a) * 2.9, 0.58, Math.cos(a) * 2.35);
        m.rotation.y = a;
      });
    }
  }
}
export {
  box,
  cube,
  cyl,
  ball,
  group,
  shape,
  mat,
  hardBox,
  boxGeometry,
  ringGeometry,
  P,
};
