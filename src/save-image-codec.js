// MCI1: a complete local save carried in an error-correcting image, not a URL.
// Frozen geometry and bit mapping: visual themes MUST NOT change these values.
import GFModule from '@zxing/library/cjs/core/common/reedsolomon/GenericGF.js';
import EncoderModule from '@zxing/library/cjs/core/common/reedsolomon/ReedSolomonEncoder.js';
import DecoderModule from '@zxing/library/cjs/core/common/reedsolomon/ReedSolomonDecoder.js';
import { encodeText, decodeText } from './save-text.js';
import { checksum } from './save-code.js';

const GF = GFModule.default || GFModule, Encoder = EncoderModule.default || EncoderModule, Decoder = DecoderModule.default || DecoderModule;
const encoder = new Encoder(GF.QR_CODE_FIELD_256), decoder = new Decoder(GF.QR_CODE_FIELD_256);
export const SAVE_IMAGE = Object.freeze({ version: 1, width: 1728, height: 2048, x: 96, y: 384, size: 1536, strength: 96 });
const CHANNELS = 4, EC = 64, RAW_BLOCK = 191, HEADER = 40;
// MCI1 stays frozen. Larger MCI2 frames keep the same pixels per bit and ECC.
export const IMAGE_SIZES = Object.freeze([1536, 2304, 3072, 3584]);
export function imageFormat(size = SAVE_IMAGE.size) {
  if (!IMAGE_SIZES.includes(size)) throw Error('存档图尺寸无效。');
  return { ...SAVE_IMAGE, version: size === 1536 ? 1 : 2, size, width: size + 192, height: size + 512 };
}
const capacity = size => Math.floor((size / 8) ** 2 * CHANNELS / (255 * 8)) * RAW_BLOCK - HEADER;
export const MAX_IMAGE_ARCHIVE = capacity(3584);
export function imageSizeForArchive(length) {
  const size = IMAGE_SIZES.find(size => length >= 2 && length <= capacity(size));
  if (!size) throw Error('这份存档超过单张图片的安全容量，请使用 JSON 备份。');
  return size;
}
export function seededRandom(seed) { let n = seed >>> 0 || 1; return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; }; }
const layouts = new Map();
function layout(size) {
  imageFormat(size);
  if (layouts.has(size)) return layouts.get(size);
  const cols = size / 8, blocks = Math.floor(cols * cols * CHANNELS / (255 * 8));
  const random = seededRandom(0x4d434931);
  const slots = Uint32Array.from({ length: cols * cols * CHANNELS }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)), v = slots[i]; slots[i] = slots[j]; slots[j] = v; }
  const value = { cols, blocks, slots, rawSize: blocks * RAW_BLOCK, encodedSize: blocks * 255 };
  layouts.set(size, value); return value;
}
const basis = [[0, 1], [1, 0], [0, 2], [2, 0]].map(([u, v]) => Float64Array.from({ length: 64 }, (_, p) =>
  .25 * (u ? 1 : Math.SQRT1_2) * (v ? 1 : Math.SQRT1_2) * Math.cos((2 * (p >> 3) + 1) * u * Math.PI / 16) * Math.cos((2 * (p & 7) + 1) * v * Math.PI / 16)));

export function archiveFromCode(code) {
  if (typeof code !== 'string' || code.length > Math.ceil(MAX_IMAGE_ARCHIVE * 8 / 14) + 32) throw Error('这份存档超过单张图片的安全容量，请使用 JSON 备份。');
  const match = /^MCC([2345])\.([\u4e00-\u8dff]+)\.([a-f0-9]{8})$/.exec(code);
  if (!match) throw Error('存档码格式不适合生成图片。');
  const payload = decodeText(match[2]);
  if (checksum(payload) !== match[3]) throw Error('存档码校验失败。');
  if (payload.length + 1 > MAX_IMAGE_ARCHIVE) throw Error('这份存档超过单张图片的安全容量，请使用 JSON 备份。');
  return Uint8Array.from([Number(match[1]), ...payload]);
}
export function codeFromArchive(archive) {
  if (archive.length < 2 || archive.length > MAX_IMAGE_ARCHIVE || ![2, 3, 4, 5].includes(archive[0])) throw Error('存档图的数据版本无效。');
  const payload = archive.subarray(1);
  return `MCC${archive[0]}.${encodeText(payload)}.${checksum(payload)}`;
}
export async function encodeFrame(archive, size = imageSizeForArchive(archive.length)) {
  const { rawSize: RAW_SIZE, encodedSize: ENCODED_SIZE, blocks: BLOCKS } = layout(size);
  if (!(archive instanceof Uint8Array) || archive.length < 2 || archive.length > capacity(size)) throw Error('存档图容量不足。');
  const raw = new Uint8Array(RAW_SIZE), rng = seededRandom(0x5a1749);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(rng() * 256);
  raw.set([77, 67, 73, size === 1536 ? 49 : 50]); new DataView(raw.buffer).setUint32(4, archive.length);
  raw.set(new Uint8Array(await crypto.subtle.digest('SHA-256', archive)), 8); raw.set(archive, HEADER);
  const encoded = new Uint8Array(ENCODED_SIZE);
  for (let i = 0; i < BLOCKS; i++) {
    const block = new Int32Array(255); block.set(raw.subarray(i * RAW_BLOCK, (i + 1) * RAW_BLOCK));
    encoder.encode(block, EC); encoded.set(block, i * 255);
  }
  return encoded;
}
export async function decodeFrame(bytes) {
  const size = IMAGE_SIZES.find(size => layout(size).encodedSize === bytes?.length);
  if (!size) throw Error('存档图的数据长度无效。');
  const { rawSize: RAW_SIZE, encodedSize: ENCODED_SIZE, blocks: BLOCKS } = layout(size);
  if (!(bytes instanceof Uint8Array) || bytes.length !== ENCODED_SIZE) throw Error('存档图的数据长度无效。');
  const raw = new Uint8Array(RAW_SIZE);
  try {
    for (let i = 0; i < BLOCKS; i++) {
      const block = Int32Array.from(bytes.subarray(i * 255, (i + 1) * 255)); decoder.decode(block, EC);
      raw.set(block.subarray(0, RAW_BLOCK), i * RAW_BLOCK);
      if (!i && (raw[0] !== 77 || raw[1] !== 67 || raw[2] !== 73 || raw[3] !== (size === 1536 ? 49 : 50))) throw Error();
    }
  } catch { throw Error('图片压缩过重或不完整，请选择保存的原图。'); }
  const length = new DataView(raw.buffer).getUint32(4);
  if (length < 2 || length > capacity(size)) throw Error('存档图的数据长度无效。');
  const archive = raw.slice(HEADER, HEADER + length), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', archive));
  if (digest.some((v, i) => v !== raw[i + 8])) throw Error('存档图校验失败，请重新选择原图。');
  return archive;
}
function checkPixels(rgba, N) { if (!(rgba instanceof Uint8ClampedArray) || rgba.length !== N * N * 4) throw Error('存档图尺寸无效。'); imageFormat(N); }
function coefficients(rgba, bx, by, values, N, isLuma = false) {
  values.fill(0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const offset = (by * 8 + y) * N + bx * 8 + x, i = offset * 4, p = y * 8 + x;
    const luma = isLuma ? rgba[offset] - 128 : .299 * rgba[i] + .587 * rgba[i + 1] + .114 * rgba[i + 2] - 128;
    for (let c = 0; c < CHANNELS; c++) values[c] += luma * basis[c][p];
  }
}
export async function embedSaveImage(rgba, archive, strength = SAVE_IMAGE.strength) {
  const N = Math.sqrt(rgba.length / 4), { cols: COLS, slots } = layout(N);
  checkPixels(rgba, N);
  // The explicit legacy value is used only by compatibility fixtures.
  if (![SAVE_IMAGE.strength, 72].includes(strength)) throw Error('存档图编码版本无效。');
  const frame = await encodeFrame(archive, N), bits = new Int8Array(slots.length).fill(-1);
  for (let i = 0; i < frame.length * 8; i++) bits[slots[i]] = frame[i >> 3] >> (7 - (i & 7)) & 1;
  const values = new Float64Array(CHANNELS), delta = new Float64Array(CHANNELS), step = strength;
  for (let by = 0; by < COLS; by++) for (let bx = 0; bx < COLS; bx++) {
    coefficients(rgba, bx, by, values, N);
    for (let c = 0; c < CHANNELS; c++) { const bit = bits[(by * COLS + bx) * CHANNELS + c]; delta[c] = bit < 0 ? 0 : step * (2 * Math.round((values[c] / step - bit) / 2) + bit) - values[c]; }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const p = y * 8 + x, i = ((by * 8 + y) * N + bx * 8 + x) * 4;
      let change = 0; for (let c = 0; c < CHANNELS; c++) change += delta[c] * basis[c][p];
      for (let channel = 0; channel < 3; channel++) rgba[i + channel] = Math.round(rgba[i + channel] + change);
    }
  }
  return rgba;
}
export async function extractSaveImage(rgba) {
  const isLuma = rgba instanceof Float32Array, N = Math.sqrt(rgba.length / (isLuma ? 1 : 4));
  const { cols: COLS, slots, encodedSize: ENCODED_SIZE } = layout(N);
  if (!isLuma) checkPixels(rgba, N);
  const values = new Float64Array(CHANNELS), all = new Float32Array(slots.length);
  for (let by = 0; by < COLS; by++) for (let bx = 0; bx < COLS; bx++) {
    coefficients(rgba, bx, by, values, N, isLuma);
    for (let c = 0; c < CHANNELS; c++) all[(by * COLS + bx) * CHANNELS + c] = values[c];
  }
  // Also accept the early, locally generated strength-72 cards. Both candidates
  // must pass the same RS, length and full SHA-256 checks before returning data.
  for (const strength of [SAVE_IMAGE.strength, 72]) {
    const frame = new Uint8Array(ENCODED_SIZE);
    for (let i = 0; i < frame.length * 8; i++) frame[i >> 3] |= (Math.round(all[slots[i]] / strength) & 1) << (7 - (i & 7));
    try { return await decodeFrame(frame); } catch { /* Try the bounded legacy candidate. */ }
  }
  throw Error('图片压缩过重或不完整，请选择保存的原图。');
}
