import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import metadata from '../package.json' with {type:'json'};
import lock from '../package-lock.json' with {type:'json'};
import {RELEASE_NAME, RELEASE_VERSION} from '../src/release.js';
import {VERSION} from '../src/game.js';
test('release metadata has one source while existing save schema stays compatible',()=>{
  assert.equal(RELEASE_VERSION,metadata.version);
  assert.equal(RELEASE_NAME,'V'+metadata.version);
  assert.equal(lock.version,metadata.version);
  assert.equal(lock.packages[''].version,metadata.version);
  assert.equal(VERSION, 10);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('__MC_RELEASE__'));
  assert.ok(!/V\d+\.\d+/.test(html),'HTML must not hard-code a release number');
});
test('a version bump includes a distinct, newest player-facing update record',()=>{
  const notes=readFileSync(new URL('../docs/CHANGELOG.md',import.meta.url),'utf8');
  const versions=[...notes.matchAll(/^## V(\d+\.\d+\.\d+(?:-alpha\.\d+)?)\b/gm)].map(m=>m[1]);
  assert.equal(versions[0],RELEASE_VERSION,'add the release notes before shipping a new version');
  assert.equal(new Set(versions).size,versions.length,'each version has one update entry');
  for(const [version,count] of [['1.6.0',5],['1.7.0',3]])
    for(let alpha=1;alpha<=count;alpha++)assert.ok(versions.includes(`${version}-alpha.${alpha}`));
});
