import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveFromCode,codeFromArchive,encodeFrame,decodeFrame,embedSaveImage,extractSaveImage,MAX_IMAGE_ARCHIVE } from '../src/save-image-codec.js';
import { makeSaveTexture,SAVE_IMAGE_THEMES } from '../src/save-image-art.js';
import { inspectImageHeader } from '../src/save-image-file.js';
import { encodePersistentSave,decodeSave } from '../src/save-code.js';
import { fresh } from '../src/game.js';

test('image frame preserves a complete save and repairs up to 32 byte errors per RS block',async()=>{
  const code=encodePersistentSave(fresh(23),'test',123456),archive=archiveFromCode(code),bytes=await encodeFrame(archive);
  for(let block=0;block<72;block++)for(let i=0;i<32;i++)bytes[block*255+i*7]^=i+1;
  assert.deepEqual(await decodeFrame(bytes),archive);assert.equal(codeFromArchive(archive),code);
  assert.deepEqual(decodeSave(codeFromArchive(archive)),decodeSave(code));
});
test('an uncorrectable image is rejected, never partly restored',async()=>{
  const bytes=await encodeFrame(Uint8Array.from({length:9000},(_,i)=>i%256));
  for(let i=0;i<110;i++)bytes[i]^=i+1;
  await assert.rejects(decodeFrame(bytes));await assert.rejects(encodeFrame(new Uint8Array(MAX_IMAGE_ARCHIVE+1)));
  assert.throws(()=>archiveFromCode('MCC5.'+'一'.repeat(9000)+'.00000000'));
});
test('every actual theme survives pixel rounding and retains the entire archive',async()=>{
  const archive=Uint8Array.from({length:12800},(_,i)=>(i*153+i%19)%256);
  for(const theme of SAVE_IMAGE_THEMES){const pixels=await embedSaveImage(makeSaveTexture(0x414829,theme),archive);assert.deepEqual(await extractSaveImage(pixels),archive,theme);}
});
test('raster header checks reject SVG, truncated, oversized and huge-pixel input before decoding',()=>{
  assert.throws(()=>inspectImageHeader(new TextEncoder().encode('<svg width="1000000" height="1000000"></svg>').buffer));
  const png=new Uint8Array(32);png.set([137,80,78,71,13,10,26,10]);const d=new DataView(png.buffer);d.setUint32(16,1728);d.setUint32(20,2048);
  assert.deepEqual(inspectImageHeader(png.buffer),{width:1728,height:2048});
  d.setUint32(16,1000000);assert.throws(()=>inspectImageHeader(png.buffer));assert.throws(()=>inspectImageHeader(new ArrayBuffer(17*1024*1024)));
  const jpeg=Uint8Array.from([255,216,255,224,255,255,...new Array(40).fill(0)]);assert.throws(()=>inspectImageHeader(jpeg.buffer));
});
test('early local strength-72 images remain readable after the strength upgrade',async()=>{
  const archive=archiveFromCode(encodePersistentSave(fresh(17),'legacy-image',123456));
  const pixels=await embedSaveImage(makeSaveTexture(0x1739),archive,72);
  assert.deepEqual(await extractSaveImage(pixels),archive);
});

test('large image frames expand without dropping data or weakening error correction',async()=>{
  const {imageSizeForArchive,imageFormat,IMAGE_SIZES}=await import('../src/save-image-codec.js');
  for(const size of IMAGE_SIZES){
    const capacity=Math.floor((size/8)**2*4/(255*8))*191-40;
    const archive=Uint8Array.from({length:capacity},(_,i)=>(i*137+i%31)%256);archive[0]=3;
    assert.equal(imageSizeForArchive(archive.length),size);
    const frame=await encodeFrame(archive);
    for(let b=0;b<frame.length/255;b++)for(let i=0;i<32;i++)frame[b*255+i*7]^=i+1;
    assert.deepEqual(await decodeFrame(frame),archive);
    const code=codeFromArchive(archive);assert.deepEqual(archiveFromCode(code),archive);
    const f=imageFormat(size);assert.deepEqual(inspectImageHeader(pngHeader(f.width,f.height)),{width:f.width,height:f.height});
  }
  assert.throws(()=>imageSizeForArchive(MAX_IMAGE_ARCHIVE+1));
  assert.throws(()=>inspectImageHeader(new ArrayBuffer(33*1024*1024)));
});
function pngHeader(w,h){const a=new Uint8Array(32);a.set([137,80,78,71,13,10,26,10]);const d=new DataView(a.buffer);d.setUint32(16,w);d.setUint32(20,h);return a.buffer;}
test('expanded textures preserve archives beyond the old 8000 character limit in every theme',async()=>{
  const archive=Uint8Array.from({length:30000},(_,i)=>(i*137+i%31)%256);archive[0]=3;
  assert.ok(codeFromArchive(archive).length>8000);
  for(const theme of SAVE_IMAGE_THEMES){const pixels=await embedSaveImage(makeSaveTexture(42,theme,2304),archive);assert.deepEqual(await extractSaveImage(pixels),archive,theme);}
});
