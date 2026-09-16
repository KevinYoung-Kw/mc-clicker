const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function validateSave(raw) {
  if (!object(raw) || !Number.isInteger(raw.version)) throw Error('这不是 MC Clicker 存档。');
  if (raw.version > 10) throw Error('这份存档来自更新的游戏版本，请先刷新游戏。');
  if (![2, 3, 4, 5, 6, 7, 8, 9, 10].includes(raw.version) || !object(raw.counts) || !Number.isFinite(raw.money) || raw.money < 0)
    throw Error('存档内容不完整，当前世界没有被替换。');
  // Reject pathological nesting before restore() follows saved victory snapshots.
  let nodes = 0;
  function visit(value, depth) {
    if (++nodes > 400000 || depth > 48) throw Error('存档结构过于复杂，无法读取。');
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw Error('存档包含无效字段。');
      visit(child, depth + 1);
    }
  }
  visit(raw, 0);
  return raw;
}
export function parseSaveJSON(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES || encoder.encode(text).length > MAX_SAVE_BYTES)
    throw Error('存档过大，请使用较小的备份。');
  let raw;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw Error('无法读取 JSON 存档，请检查文件是否完整。'); }
  return validateSave(raw);
}
