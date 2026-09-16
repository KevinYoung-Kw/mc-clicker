import * as T from "three";

// Original 16px surfaces, shared by material class rather than guessed from tint.
// Mipmaps reduce distant texture shimmer; close views keep hard pixel edges.
const textures = new Map(),
  materials = new Map();
const originals = new WeakMap(),
  tintedBatches = new Map();
export const BLOCK_SURFACES = Object.freeze([
  "wood",
  "log",
  "stone",
  "cobblestone",
  "iron",
  "blackstone",
  "obsidian",
  "purpur",
  "cloth",
  "leaves",
  "rock",
  "petals",
]);
function makeTexture(kind) {
  const data = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      const noise = ((x * 17 + y * 31 + x * y * 7) % 13) - 6;
      let tone = 244 + noise;
      if(kind === 'leaves') {
        const patch=(Math.floor(x/2)*7+Math.floor(y/2)*13+Math.floor(x/4)*Math.floor(y/3))%11;
        tone=patch<2?207:patch<5?229:248+Math.floor(noise/3);
      } else if(kind === 'rock') {
        tone=228+Math.floor(noise*1.7);if((x*3+y*7)%29<2)tone=194;
      } else if(kind === 'petals') {
        tone=((Math.floor(x/3)*5+Math.floor(y/2)*3)%9<2?220:246)+Math.floor(noise/2);
      } else if (kind === "wood") {
        tone = y % 4 === 0 ? 199 : 239 + noise;
        if ((x + Math.floor(y / 4) * 5) % 16 === 0) tone -= 22;
      } else if (kind === "log") {
        tone = [216, 242, 228, 250][Math.floor(x / 2) % 4] + noise;
        if (x % 7 === 0 && y % 6 < 3) tone -= 24;
      } else if (["stone", "purpur"].includes(kind)) {
        const joint = y % 8 === 0 || (x + Math.floor(y / 8) * 4) % 8 === 0;
        tone = joint ? 186 : 241 + Math.floor(noise / 2);
        if (y % 8 === 1) tone = 252;
      } else if (["cobblestone", "blackstone"].includes(kind)) {
        const row = Math.floor(y / 4),
          sx = (x + row * 3) % 8;
        const joint = y % 4 === 0 || sx === 0 || (y % 4 === 1 && sx === 1);
        tone = joint
          ? 164
          : 222 +
            ((row * 7 + Math.floor((x + row * 3) / 8) * 11) % 27) +
            Math.floor(noise / 2);
      } else if (kind === "iron") {
        tone = x === 0 || y === 15 ? 209 : 245 + Math.floor(noise / 3);
        if ((x === 2 || x === 13) && (y === 2 || y === 13)) tone = 190;
      } else if (kind === "obsidian") {
        tone = 212 + noise * 3;
        if ((x * 3 + Math.floor(y / 3) * 5) % 11 < 2) tone = 247;
      } else if (kind === "cloth") {
        tone = 242 + ((x + y) % 2 ? 6 : -6);
      }
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, tone));
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, 16, 16);
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.name = `mc-original-${kind}`;
  return texture;
}
export function blockMat(kind, color, glow = 0) {
  if (!BLOCK_SURFACES.includes(kind))
    throw new Error(`Unknown block surface: ${kind}`);
  const key = `${kind}:${color}:${glow}`;
  if (!textures.has(kind)) textures.set(kind, makeTexture(kind));
  if (!materials.has(key)) {
    const material = new T.MeshStandardMaterial({
      color,
      map: textures.get(kind),
      roughness: kind === "iron" ? 0.74 : 0.88,
      metalness: kind === "iron" ? 0.06 : 0,
      emissive: color,
      emissiveIntensity: glow,
    });
    material.userData.blockSurface = kind;
    originals.set(material, kind);
    materials.set(key, material);
  }
  return materials.get(key);
}

// Only our unmodified, opaque factory surfaces may share a colour-instanced
// draw. Other shaders, glowing parts and mutable UI materials keep their own bin.
export function blockBatchMaterial(material) {
  const kind = originals.get(material);
  if (
    !kind ||
    material.version !== 0 ||
    material.emissiveIntensity !== 0 ||
    material.transparent ||
    material.opacity !== 1 ||
    material.side !== T.FrontSide ||
    material.onBeforeCompile !== T.Material.prototype.onBeforeCompile ||
    material.alphaTest !== 0 ||
    material.map !== textures.get(kind) ||
    material.roughness !== (kind === "iron" ? 0.74 : 0.88) ||
    material.metalness !== (kind === "iron" ? 0.06 : 0)
  )
    return null;
  if (!tintedBatches.has(kind)) {
    const batch = material.clone();
    batch.color.set(0xffffff);
    batch.emissive.set(0x000000);
    batch.userData = { blockBatch: kind };
    tintedBatches.set(kind, batch);
  }
  return tintedBatches.get(kind);
}
