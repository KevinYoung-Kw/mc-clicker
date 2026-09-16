import defaults from './save-format/defaults-v1.json' with { type: 'json' };
import records from './save-format/records-v1.json' with { type: 'json' };
import persistentDefaults from './save-format/persistent-defaults-v1.json' with { type: 'json' };
import words from './save-format/words-v2.json' with { type: 'json' };
// Format 2 extends frozen format 1 with subset/superset record differences.
// A historical full record and its current persistent record can share values
// even when transient fields have been removed. Object/array order stays exact.
const MAX = 8 * 1024 * 1024, LIMIT = 400000;
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const forbidden = key => ['__proto__', 'constructor', 'prototype'].includes(key);
const object = v => v && typeof v === 'object';
const templateStrings = [], templateShapes = [], templates = [];
const initialWords = new Set(), initialShapes = new Set(), initialObjects = new Set();
function seed(v) {
  const word = s => { if (!initialWords.has(s)) { initialWords.add(s); templateStrings.push(s); } };
  if (typeof v === 'string') word(v);
  if (!object(v)) return;
  if (!Array.isArray(v)) {
    const keys = Object.keys(v), shape = JSON.stringify(keys);
    for (const k of keys) word(k);
    if (!initialShapes.has(shape)) { initialShapes.add(shape); templateShapes.push(keys); }
  }
  for (const child of Object.values(v)) seed(child);
  const key = JSON.stringify(v);
  if (key.length >= 64 && !initialObjects.has(key)) { initialObjects.add(key); templates.push(v); }
}
seed(defaults);
for (const record of records) seed(record);
seed(persistentDefaults);
for (const word of words) seed(word);
const trie = new Map();
for (const word of words) {
  let at = trie;
  for (const char of word) { if (!at.has(char)) at.set(char, new Map()); at = at.get(char); }
  at.set('', word);
}
function fragments(value) {
  const chars = [...value], result = []; let literal = '';
  for (let i = 0; i < chars.length;) {
    let at = trie, found = '', end = i;
    for (let j = i; j < chars.length && at.has(chars[j]); j++) {
      at = at.get(chars[j]); if (at.has('')) { found = at.get(''); end = j + 1; }
    }
    if (found) { if (literal) result.push(literal); literal = ''; result.push(found); i = end; }
    else literal += chars[i++];
  }
  if (literal) result.push(literal);
  return result;
}
function stats(v) {
  let nodes = 1, height = 0;
  if (object(v)) for (const child of Object.values(v)) { const s = stats(child); nodes += s.nodes; height = Math.max(height, s.height + 1); }
  return { nodes, height, size: enc.encode(JSON.stringify(v)).length };
}
const templateStats = templates.map(v => ({ value: v, ...stats(v) }));
export function packSaveV2(value) {
  const out = [], strings = new Map(templateStrings.map((v,i) => [v,i])), shapes = new Map(templateShapes.map((v,i) => [JSON.stringify(v),i])), objects = new Map();
  const memo = [], similar = new Map();
  function remember(v, key) {
    const id = memo.length; objects.set(key, id); memo.push(v);
    if (!Array.isArray(v)) {
      const group = JSON.stringify(Object.keys(v).slice(0, 2)), candidates = similar.get(group) || [];
      candidates.push(id); if (candidates.length > 24) candidates.shift(); similar.set(group, candidates);
    }
  }
  for (const v of templates) remember(v, JSON.stringify(v));
  let nodes = 0;
  const byte = n => { if (out.length >= MAX) throw Error('存档过大，请使用 JSON 文件。'); out.push(n); };
  function uint(n) { do { const d = n % 128; n = Math.floor(n / 128); byte(d | (n ? 128 : 0)); } while (n); }
  function text(s) {
    if (strings.has(s)) { uint(strings.get(s) + 1); return; }
    // JSON quoting also preserves lone UTF-16 surrogates in old/custom names.
    uint(0); const b = enc.encode(JSON.stringify(s)); uint(b.length); for (const x of b) byte(x); strings.set(s, strings.size);
  }
  function write(v, depth = 0) {
    if (++nodes > LIMIT || depth > 48) throw Error('存档结构过于复杂。');
    let key;
    if (v && typeof v === 'object') {
      key = JSON.stringify(v);
      if (key.length >= 64 && objects.has(key)) { byte(10); uint(objects.get(key)); return; }
    }
    if (v === null) byte(0);
    else if (v === false) byte(1);
    else if (v === true) byte(2);
    else if (typeof v === 'number') {
      if (Number.isSafeInteger(v)) { byte(v < 0 ? 4 : 3); uint(Math.abs(v)); }
      else if (Number.isSafeInteger(v * 2)) { byte(11); byte(v < 0 ? 1 : 0); uint(Math.abs(v * 2)); }
      else { byte(5); const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); for (const x of b) byte(x); }
    } else if (typeof v === 'string') {
      const parts = strings.has(v) ? [] : fragments(v);
      const cost = parts.reduce((sum, s) => sum + (strings.has(s) ? 2 : enc.encode(JSON.stringify(s)).length + 3), 3);
      if (parts.length && cost < enc.encode(JSON.stringify(v)).length) {
        byte(13); uint(parts.length); for (const part of parts) text(part); strings.set(v, strings.size);
      } else { byte(6); text(v); }
    }
    else if (Array.isArray(v)) { byte(7); uint(v.length); for (const x of v) write(x, depth + 1); }
    else {
      const keys = Object.keys(v), shape = JSON.stringify(keys);
      let base = -1, changed, least = keys.length;
      if (keys.length >= 3 && key.length >= 64) for (const id of similar.get(JSON.stringify(keys.slice(0, 2))) || []) {
        const flags = keys.map(k => !Object.hasOwn(memo[id], k) || JSON.stringify(v[k]) !== JSON.stringify(memo[id][k]));
        const count = flags.filter(Boolean).length;
        if (count < least) { base = id; least = count; changed = flags; }
      }
      if (base >= 0 && least < keys.length / 2) {
        byte(12); uint(base); writeShape(keys, shape);
        for (let i = 0; i < keys.length; i += 8) { let mask = 0; for (let j = 0; j < 8; j++) if (changed[i + j]) mask |= 1 << j; byte(mask); }
        for (let i = 0; i < keys.length; i++) if (changed[i]) write(v[keys[i]], depth + 1);
        remember(v, key); return;
      }
      byte(8);
      writeShape(keys, shape);
      for (const k of keys) write(v[k], depth + 1);
    }
    if (key?.length >= 64) remember(v, key);
  }
  function writeShape(keys, shape) {
    if (shapes.has(shape)) uint(shapes.get(shape) + 1);
    else { uint(0); uint(keys.length); for (const k of keys) text(k); shapes.set(shape, shapes.size); }
  }
  write(value); return Uint8Array.from(out);
}
export function unpackSaveV2(bytes) {
  if (bytes.length > MAX) throw Error('存档过大。');
  let pos = 0, nodes = 0, size = 0;
  const strings = [...templateStrings], shapes = [...templateShapes], objects = [...templateStats];
  const byte = () => { if (pos >= bytes.length) throw Error('存档不完整。'); return bytes[pos++]; };
  function uint() {
    let n = 0, scale = 1;
    for (let i = 0; i < 8; i++) { const b = byte(); n += (b & 127) * scale; if (!Number.isSafeInteger(n)) throw Error('存档数值无效。'); if (!(b & 128)) return n; scale *= 128; }
    throw Error('存档数值无效。');
  }
  function charge(amount, count = 0) { size += amount; nodes += count; if (size > MAX || nodes > LIMIT) throw Error('存档展开后过大。'); }
  function text() {
    const index = uint();
    if (index) { if (index > strings.length) throw Error('存档字典损坏。'); return strings[index - 1]; }
    const len = uint(); if (len > MAX || len > bytes.length - pos) throw Error('存档文字损坏。');
    const s = JSON.parse(dec.decode(bytes.subarray(pos, pos + len))); pos += len;
    if (typeof s !== 'string') throw Error('存档文字损坏。'); strings.push(s); return s;
  }
  function read(depth = 0) {
    if (depth > 48) throw Error('存档层级过深。');
    charge(0, 1); const before = size, nodeBefore = nodes, tag = byte(); let v;
    if (tag === 10) {
      const ref = objects[uint()]; if (!ref) throw Error('存档引用损坏。');
      if (depth + ref.height > 48) throw Error('存档层级过深。');
      charge(ref.size, ref.nodes - 1); return structuredClone(ref.value);
    }
    if (tag === 0) v = null;
    else if (tag === 1 || tag === 2) v = tag === 2;
    else if (tag === 3 || tag === 4) v = uint() * (tag === 4 ? -1 : 1);
    else if (tag === 11) { const sign = byte(); if (sign > 1) throw Error('存档坐标无效。'); v = uint() / 2 * (sign ? -1 : 1); }
    else if (tag === 5) {
      const data = Uint8Array.from({ length: 8 }, byte); v = new DataView(data.buffer).getFloat64(0, true);
      if (!Number.isFinite(v)) throw Error('存档数值无效。');
    } else if (tag === 6) v = text();
    else if (tag === 13) {
      const count = uint(); if (count > LIMIT) throw Error('存档文字片段过多。');
      const parts = []; let length = 0;
      for (let i = 0; i < count; i++) { const part = text(); length += enc.encode(JSON.stringify(part)).length - 2; if (length + size > MAX) throw Error('存档展开后过大。'); parts.push(part); }
      v = parts.join(''); strings.push(v);
    }
    else if (tag === 7) {
      const count = uint(); if (count > LIMIT) throw Error('存档列表过长。');
      charge(count + 2); v = Array.from({ length: count }, () => read(depth + 1));
    } else if (tag === 12) {
      const base = objects[uint()];
      if (!base || !object(base.value) || Array.isArray(base.value)) throw Error('存档差量无效。');
      const keys = readShape(), masks = Array.from({ length: Math.ceil(keys.length / 8) }, byte);
      if (keys.length % 8 && masks.at(-1) >> (keys.length % 8)) throw Error('存档差量无效。');
      charge(2 + keys.length * 2); v = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]; charge(enc.encode(JSON.stringify(k)).length);
        if (masks[i >> 3] & (1 << (i % 8))) v[k] = read(depth + 1);
        else {
          if (!Object.hasOwn(base.value, k)) throw Error('存档差量字段缺失。');
          const child = base.value[k], s = stats(child);
          if (depth + 1 + s.height > 48) throw Error('存档层级过深。');
          charge(s.size, s.nodes); v[k] = structuredClone(child);
        }
      }
    } else if (tag === 8) {
      const keys = readShape();
      charge(2 + keys.length * 2); v = {};
      for (const k of keys) { charge(enc.encode(JSON.stringify(k)).length); v[k] = read(depth + 1); }
    } else throw Error('存档编码无效。');
    if (!v || typeof v !== 'object') charge(enc.encode(JSON.stringify(v)).length);
    else if (JSON.stringify(v).length >= 64) {
      objects.push({ value: v, size: size - before, nodes: nodes - nodeBefore + 1, height: stats(v).height });
    }
    return v;
  }
  function readShape() {
    const index = uint();
    if (index) { const keys = shapes[index - 1]; if (!keys) throw Error('存档结构损坏。'); return keys; }
    const count = uint(); if (count > LIMIT) throw Error('存档字段过多。'); const keys = [];
    for (let i = 0; i < count; i++) keys.push(text());
    if (new Set(keys).size !== keys.length || keys.some(forbidden)) throw Error('存档字段无效。'); shapes.push(keys); return keys;
  }
  const result = read(); if (pos !== bytes.length) throw Error('存档包含多余内容。'); return result;
}
