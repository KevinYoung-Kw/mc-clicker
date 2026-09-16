import { gunzipSync } from 'fflate';
import { encodePersistentSave, decodeSave, checksum, unpackSaveFrame, MAX_SAVE_BYTES, MAX_CODE_CHARS } from './save-code.js';
import { encodeText, decodeText } from './save-text.js';
import { packSaveV3 } from './save-packed-v3.js';

// Compare complete codes, including the old fallback. MCC5 adds a frozen
// source-transcript dictionary; it never regenerates text from today's script.
export async function encodePortableSave(raw, release, now, loadBrotli) {
  const fallback = encodePersistentSave(raw, release, now);
  try {
    const brotli = await loadBrotli();
    // This frame was just generated locally and already passed the size checks.
    const frame = gunzipSync(decodeText(fallback.split('.')[1]));
    const compressed = brotli.compress(frame, { quality: 11 });
    const candidate = `MCC4.${encodeText(compressed)}.${checksum(compressed)}`;
    let best = candidate.length < fallback.length ? candidate : fallback;
    try {
      const envelope = unpackSaveFrame(frame), packed = packSaveV3(envelope);
      const transcriptFrame = new Uint8Array(packed.length + 1);
      transcriptFrame[0] = 3; transcriptFrame.set(packed, 1);
      const bytes = brotli.compress(transcriptFrame, { quality: 11 });
      const code = `MCC5.${encodeText(bytes)}.${checksum(bytes)}`;
      if (code.length < best.length) best = code;
    } catch { /* Keep the validated old candidate if a new structure cannot fit. */ }
    return best;
  } catch { return fallback; } // Older browsers can still create portable saves.
}

export async function decodePortableSave(input, loadBrotli) {
  if (typeof input !== 'string' || input.length > MAX_CODE_CHARS) throw Error('存档码过长，无法读取。');
  const code = input.replace(/\s/g, '');
  if (!/^MCC[45]\./.test(code)) return decodeSave(input);
  const match = /^MCC([45])\.([\u4e00-\u8dff]+)\.([a-fA-F0-9]{8})$/.exec(code);
  if (!match) throw Error('请粘贴完整存档码，不要附带其他文字。');
  if (match[2].length > Math.ceil((MAX_SAVE_BYTES + 65536) * 8 / 14) + 1) throw Error('存档码过长，无法读取。');
  const bytes = decodeText(match[2]);
  if (checksum(bytes) !== match[3].toLowerCase()) throw Error('存档码缺字或被改动了，请重新复制完整内容。');
  let brotli;
  try { brotli = await loadBrotli(); } catch { throw Error('存档工具未能加载，请刷新游戏后重试。'); }
  const frame = inflateBrotli(bytes, brotli);
  if (match[1] === '5' && frame[0] !== 3) throw Error('存档码内容损坏，无法读取。');
  return unpackSaveFrame(frame, match[1] === '5' ? '5' : '3');
}

// Never call the library's unbounded decompress() on pasted player input.
// Fixed output buffers bound each expansion, including malicious valid streams.
export function inflateBrotli(bytes, brotli) {
  const stream = new brotli.DecompressStream(), chunks = [];
  let offset = 0, length = 0;
  try {
    while (true) {
      const result = stream.decompress(bytes.subarray(offset, offset + 256), 4096);
      let buffer, consumed, status;
      try { buffer = result.buf; consumed = result.input_offset; status = result.code; } finally { result.free(); }
      if (consumed > Math.min(256, bytes.length - offset)) throw Error('存档码损坏。');
      offset += consumed; length += buffer.length;
      if (length > MAX_SAVE_BYTES + 1) throw Error('存档解压后过大，无法读取。');
      chunks.push(buffer);
      if (status === brotli.BrotliStreamResultCode.ResultSuccess) {
        if (offset !== bytes.length) throw Error('存档包含多余内容。');
        break;
      }
      if ((!consumed && !buffer.length) || (offset === bytes.length && status === brotli.BrotliStreamResultCode.NeedsMoreInput)) throw Error('存档码不完整。');
    }
    const output = new Uint8Array(length); let position = 0;
    for (const chunk of chunks) { output.set(chunk, position); position += chunk.length; }
    return output;
  } catch (error) {
    throw Error(error.message?.includes('存档') ? error.message : '存档码损坏，无法解压。');
  } finally { stream.free(); }
}
