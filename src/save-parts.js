// Optional transport envelopes for text fields with short per-message limits.
// No network, shared storage, lossy summary, or dependency on the source device.
const CHUNK = 440, MAX = 12 * 1024 * 1024;
const encoder = new TextEncoder();
function crc(text) {
  let value = 0xffffffff;
  for (const byte of encoder.encode(text)) { value ^= byte; for (let i = 0; i < 8; i++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1; }
  return ((value ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
export function splitSaveCode(code) {
  if (!code || code.length > MAX) throw Error('存档码长度无效。');
  const id = crc(code), total = Math.ceil(code.length / CHUNK), parts = [];
  for (let i = 0; i < total; i++) {
    const body = `MCP1.${id}.${i + 1}.${total}.${code.slice(i * CHUNK, (i + 1) * CHUNK)}`;
    parts.push(`${body}.${crc(body)}`);
  }
  return parts;
}
export function collectSaveParts(input, previous = null) {
  if (typeof input !== 'string' || input.length > MAX * 2) throw Error('存档片段过长。');
  // Process a paste atomically: a foreign/damaged part never clears good parts.
  let state = previous ? { ...previous, parts: new Map(previous.parts) } : null;
  for (const line of input.trim().split(/\s+/)) {
    const match = /^(MCP1\.([a-f0-9]{8})\.([1-9][0-9]{0,4})\.([1-9][0-9]{0,4})\.(.+))\.([a-f0-9]{8})$/.exec(line);
    if (!match || line.length > 500 || crc(match[1]) !== match[6]) throw Error('存档片段缺字或被改动，请重新复制这一段。');
    const [, , id, number, count, data] = match, index = Number(number), total = Number(count);
    if (index > total || total > Math.ceil(MAX / CHUNK) || data.length > CHUNK || (index < total && data.length !== CHUNK)) throw Error('存档片段编号或长度无效。');
    if (!state) state = { id, total, parts: new Map() };
    if (state.id !== id || state.total !== total) throw Error('这是另一份存档的片段。请先清空已收集的片段。');
    if (state.parts.has(index) && state.parts.get(index) !== data) throw Error('同一段存档的内容不一致，请重新复制。');
    state.parts.set(index, data);
  }
  let code = null;
  if (state && state.parts.size === state.total) {
    code = Array.from({ length: state.total }, (_, i) => state.parts.get(i + 1)).join('');
    if (code.length > MAX || crc(code) !== state.id) throw Error('拼接后的存档不完整，请重新复制。');
  }
  return { state, code };
}
