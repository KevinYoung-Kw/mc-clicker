// Keep historical duration experiments reproducible while the product evolves.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const input = new URL('../src/research.js', import.meta.url);
const output = new URL('../docs/v2.0.0/simulation/research-model.mjs', import.meta.url);
if (existsSync(output)) throw new Error('Research candidate already frozen; refusing to overwrite.');
const source = readFileSync(input, 'utf8');
const code = source.replace("import { housingCapacity } from './housing-data.js';", "import { housingData } from './baseline-engine.mjs';\nconst { housingCapacity } = housingData;");
writeFileSync(output, code);
writeFileSync(new URL('research-model-manifest.json', output), JSON.stringify({capturedAt:new Date().toISOString(),sourceHash:createHash('sha256').update(source).digest('hex'),sha256:createHash('sha256').update(code).digest('hex'),method:'Historical 20-second candidate. Only housing import redirected to frozen baseline. Production defaults may subsequently change.'},null,2)+'\n');
