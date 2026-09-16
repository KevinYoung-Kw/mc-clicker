// 14 bits per BMP character, using assigned CJK Unified Ideographs only.
// No surrogate pairs, whitespace, combining marks or normalization changes.
// This shortens character count, not the number of compressed bytes.
const FIRST = 0x4e00, MASK = 0x3fff;
export function encodeText(bytes) {
  let bits = 0, value = 0, text = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    if (bits >= 14) { bits -= 14; text += String.fromCharCode(FIRST + (value >> bits & MASK)); value &= (1 << bits) - 1; }
  }
  if (bits) text += String.fromCharCode(FIRST + (value << (14 - bits)));
  return text + String.fromCharCode(FIRST + bits);
}
export function decodeText(text) {
  const tail = text.charCodeAt(text.length - 1) - FIRST;
  const byteLength = ((text.length - 1) * 14 - (tail ? 14 - tail : 0)) / 8;
  if (tail < 0 || tail > 13 || !Number.isInteger(byteLength) || byteLength < 0) throw Error('存档码长度无效。');
  const bytes = new Uint8Array(byteLength); let bits = 0, value = 0, offset = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const n = text.charCodeAt(i) - FIRST;
    if (n < 0 || n > MASK) throw Error('存档码包含不正确的字符。');
    value = (value << 14) | n; bits += 14;
    while (bits >= 8) { bits -= 8; if (offset < byteLength) bytes[offset++] = value >> bits & 255; }
    value &= (1 << bits) - 1;
  }
  if (encodeText(bytes) !== text) throw Error('存档码不完整，请重新复制。');
  return bytes;
}
