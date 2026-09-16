import { validateSave } from './save-validation.js';
export { validateSave, parseSaveJSON } from './save-validation.js';
import { gzipSync, Gunzip } from 'fflate';
import { packSave, unpackSave } from './save-packed.js';
import { packSaveV2, unpackSaveV2 } from './save-packed-v2.js';
import { unpackSaveV3 } from './save-packed-v3.js';
import { persistentSave } from './save-persistent.js';
import { encodeText, decodeText } from './save-text.js';

// The code contains the entire save. CRC detects copy errors, not cheating.
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const MAX_CODE_CHARS = 12 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function checksum(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function fromBase64(text) {
  if (text.length % 4 === 1) throw Error('存档码不完整，请重新复制整段内容。');
  const bytes = Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  if (toBase64(bytes) !== text) throw Error('存档码格式有误，请重新复制。');
  return bytes;
}
export function encodeSave(raw, release, now = Date.now()) {
  validateSave(raw);
  const bytes = encoder.encode(JSON.stringify({ game: 'mc-clicker-2', release, createdAt: now, save: raw }));
  if (bytes.length > MAX_SAVE_BYTES) throw Error('世界较大，请使用 JSON 文件备份。');
  const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
  return `MCC1.${toBase64(compressed)}.${checksum(compressed)}`;
}
export function encodeCompactSave(raw, release, now = Date.now()) {
  validateSave(raw);
  const envelope = JSON.parse(JSON.stringify({ game: 'mc-clicker-2', release, createdAt: now, save: raw }));
  const json = encoder.encode(JSON.stringify(envelope));
  if (json.length > MAX_SAVE_BYTES) throw Error('世界较大，请使用 JSON 文件备份。');
  // The first byte chooses the frozen structural format or plain JSON fallback.
  const compress = (kind, bytes) => gzipSync(join(kind, bytes), { level: 9, mtime: 0 });
  let compressed = compress(0, json);
  try {
    const packed = compress(1, packSave(envelope));
    if (packed.length < compressed.length) compressed = packed;
  } catch { /* Preserve complete data even when structural packing is unsuitable. */ }
  return `MCC2.${encodeText(compressed)}.${checksum(compressed)}`;
}
export function encodePersistentSave(raw, release, now = Date.now()) {
  validateSave(raw);
  const envelope = JSON.parse(JSON.stringify({ game: 'mc-clicker-2', release, createdAt: now, save: raw }));
  const json = encoder.encode(JSON.stringify(envelope));
  if (json.length > MAX_SAVE_BYTES) throw Error('世界较大，请使用 JSON 文件备份。');
  const compress = (kind, bytes) => gzipSync(join(kind, bytes), { level: 9, mtime: 0 });
  let compressed = compress(0, json);
  // Removing runtime fields can break sharing with an immutable victory record.
  // Compare the actual complete archives; never make a save longer just to prune.
  for (const save of [envelope.save, persistentSave(envelope.save)]) {
    for (const [kind, pack] of [[1, packSave], [2, packSaveV2]]) {
      try {
        const candidate = compress(kind, pack({ ...envelope, save }));
        if (candidate.length < compressed.length) compressed = candidate;
      } catch { /* A full JSON candidate always remains available. */ }
    }
  }
  return `MCC3.${encodeText(compressed)}.${checksum(compressed)}`;
}
function join(kind, bytes) { const out = new Uint8Array(bytes.length + 1); out[0] = kind; out.set(bytes, 1); return out; }
export function decodeSave(input) {
  if (typeof input !== 'string' || input.length > MAX_CODE_CHARS) throw Error('存档码过长，无法读取。');
  const code = input.replace(/\s/g, '');
  if (/^MCC(?![123]\.)\d+\./.test(code)) throw Error('这是新版存档码，请先刷新游戏再读取。');
  const match = /^MCC([123])\.([A-Za-z0-9_\-\u4e00-\u8dff]+)\.([a-fA-F0-9]{8})$/.exec(code);
  if (!match) throw Error('请粘贴完整存档码，不要附带其他文字。');
  const maxPayload = Math.ceil((MAX_SAVE_BYTES + 65536) * 8 / (match[1] === '1' ? 6 : 14)) + 1;
  if (match[2].length > maxPayload) throw Error('存档码过长，无法读取。');
  const bytes = match[1] === '1' ? fromBase64(match[2]) : decodeText(match[2]);
  if (checksum(bytes) !== match[3].toLowerCase()) throw Error('存档码缺字或被改动了，请重新复制完整内容。');
  const chunks = []; let length = 0, finished = false;
  try {
    // Small input chunks bound each inflation step; never trust gzip's size trailer.
    const unzip = new Gunzip((chunk, final) => {
      length += chunk.length;
      if (length > MAX_SAVE_BYTES + (match[1] === '1' ? 0 : 1)) throw Error('too-large');
      chunks.push(chunk); finished = final;
    });
    for (let i = 0; i < bytes.length; i += 256) unzip.push(bytes.subarray(i, i + 256), i + 256 >= bytes.length);
  } catch (error) {
    throw Error(error.message === 'too-large' ? '存档解压后过大，无法读取。' : '存档码损坏，无法解压。');
  }
  if (!finished) throw Error('存档码不完整。');
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return unpackSaveFrame(result, match[1]);
}
// Old frames are frozen. MCC5 alone can carry the source-transcript table.
export function unpackSaveFrame(result, format = '3') {
  if (result.length > MAX_SAVE_BYTES + 1) throw Error('存档解压后过大，无法读取。');
  let envelope;
  try {
    if (format === '1') envelope = JSON.parse(decoder.decode(result));
    else if (result[0] === 0) envelope = JSON.parse(decoder.decode(result.subarray(1)));
    else if (result[0] === 1) envelope = unpackSave(result.subarray(1));
    else if (format === '3' && result[0] === 2) envelope = unpackSaveV2(result.subarray(1));
    else if (format === '5' && result[0] === 3) envelope = unpackSaveV3(result.subarray(1));
    else throw Error('Unknown format');
  } catch { throw Error('存档码内容损坏，无法读取。'); }
  if (!object(envelope) || envelope.game !== 'mc-clicker-2') throw Error('这不是 MC Clicker 存档码。');
  validateSave(envelope.save);
  return envelope;
}
