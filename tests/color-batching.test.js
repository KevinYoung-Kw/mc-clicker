import test from 'node:test';
import assert from 'node:assert/strict';
import {mat,colorBatchMaterial} from '../src/models.js';
test('opaque model tints share a batch without altering their source surfaces',()=>{
  const a=mat('#134567'),b=mat('#765431');const original=a.color.clone();
  const batch=colorBatchMaterial(a);assert.equal(batch,colorBatchMaterial(b));
  assert.equal(batch.color.getHex(),0xffffff);assert.ok(a.color.equals(original));
  assert.equal(batch.roughness,a.roughness);assert.equal(batch.map,a.map);
  assert.notEqual(colorBatchMaterial(mat('#916c4b')),batch,'textured dirt remains a separate surface');
  assert.equal(colorBatchMaterial(mat('#134567',.4)),null,'emissive sources retain their own lighting');
  assert.equal(colorBatchMaterial(a.clone()),null,'unknown/edited materials are not merged');
});
