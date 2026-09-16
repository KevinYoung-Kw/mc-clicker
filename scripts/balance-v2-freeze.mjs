// Capture once, before integration. Later experiments import this immutable engine.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(root, 'docs/v2.0.0/simulation');
const arg = (key, fallback) => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback;
const name = arg('--name', 'baseline-engine');
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid snapshot name');
const target = resolve(out, `${name}.mjs`);
if (existsSync(target)) throw new Error('Baseline already frozen; refusing to overwrite historical input.');
const modules = ['game', 'catalog', 'residents', 'housing', 'housing-data', 'power', 'guidance', 'mail', 'upgrades', 'development'];
if (process.argv.includes('--include-life')) modules.push('villager-life', 'research');
const source = modules.map((id) => `export * as ${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} from './src/${id}.js';`).join('\n') +
  "\nexport { simulate as simulateEarly, PROFILES as earlyProfiles } from './scripts/balance-early-v16.mjs';\n";
const captured = {};
const result = await build({ stdin: { contents: source, resolveDir: root, sourcefile: 'baseline-entry.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false, metafile: true,
  plugins: [{ name: 'capture-exact-input-and-remove-historical-cli', setup(b) { b.onLoad({ filter: /\.[cm]?js$/ }, ({ path }) => {
    const raw=readFileSync(path,'utf8');captured[relative(root,path)]=createHash('sha256').update(raw).digest('hex');
    return {contents:path.endsWith('balance-early-v16.mjs')?raw.split('if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)')[0]:raw,loader:'js'};
  }); } }],
});
const hashes = Object.fromEntries(Object.keys(result.metafile.inputs).filter(p => p !== 'baseline-entry.mjs').sort().map(p => [p, captured[p] || createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
const code = result.outputFiles[0].text;
mkdirSync(out, { recursive: true });
writeFileSync(target, code);
writeFileSync(resolve(out, name === 'baseline-engine' ? 'baseline-manifest.json' : `${name}-manifest.json`), JSON.stringify({ capturedAt: new Date().toISOString(), version: JSON.parse(readFileSync(resolve(root, 'package.json'))).version, method: 'Unmodified current runtime bundled once. Only the historical early-policy CLI output block was omitted. Future research experiments import this file, not evolving src/game.js.', sha256: createHash('sha256').update(code).digest('hex'), inputs: hashes }, null, 2) + '\n');
console.log(JSON.stringify({ target, bytes: Buffer.byteLength(code), inputs: Object.keys(hashes).length }));
