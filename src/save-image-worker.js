import { IMAGE_SIZES, imageFormat, imageSizeForArchive, archiveFromCode, codeFromArchive, embedSaveImage, extractSaveImage } from './save-image-codec.js';
import { makeSaveTexture } from './save-image-art.js';
import { inspectImageHeader, MAX_IMAGE_FILE, MAX_IMAGE_PIXELS } from './save-image-file.js';
import { resampleSaveLuma } from './save-image-resample.js';

export async function encodeImageData(code, theme) {
  const archive=archiveFromCode(code),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',archive));
  const size=imageSizeForArchive(archive.length),seed=new DataView(digest.buffer).getUint32(0),pixels=await embedSaveImage(makeSaveTexture(seed,theme,size),archive);
  // Validate the actual pixels after rounding/clamping, not the encoder's source bytes.
  if(codeFromArchive(await extractSaveImage(pixels))!==code)throw Error('存档图自检失败，请使用备用存档码。');
  return {pixels,size,id:Array.from(digest.slice(0,4),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()};
}
export async function decodeImageFile(file) {
  if(!file || !Number.isFinite(file.size) || file.size>MAX_IMAGE_FILE)throw Error('请选择 32 MB 以内的完整存档图片。');
  inspectImageHeader(await file.arrayBuffer());
  if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')throw Error('这个浏览器暂不支持图片读档，请换用备用存档码。');
  let bitmap;
  try { bitmap=await createImageBitmap(file); } catch { throw Error('图片未能打开，请重新选择。'); }
  try {
    if(bitmap.width*bitmap.height>MAX_IMAGE_PIXELS)throw Error('图片尺寸过大。');
    const canvas=new OffscreenCanvas(1,1),ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw Error('这个浏览器暂不支持图片读档。');
    let attempted=false;
    for(const size of IMAGE_SIZES) for(let quarter=0;quarter<4;quarter++) {
      const f=imageFormat(size);
      const ratio=quarter%2?bitmap.height/bitmap.width:bitmap.width/bitmap.height;
      if(Math.abs(ratio-f.width/f.height)>.004)continue;
      attempted=true;canvas.width=f.width;canvas.height=f.height;ctx.resetTransform();ctx.clearRect(0,0,f.width,f.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.translate(f.width/2,f.height/2);ctx.rotate(quarter*Math.PI/2);
      const w=quarter%2?f.height:f.width,h=quarter%2?f.width:f.height;ctx.drawImage(bitmap,-w/2,-h/2,w,h);
      try { return codeFromArchive(await extractSaveImage(ctx.getImageData(f.x,f.y,f.size,f.size).data)); } catch { /* Retry with deterministic resampling before changing orientation. */ }
      if(bitmap.width!==w||bitmap.height!==h) {
        const ow=quarter%2?bitmap.height:bitmap.width,oh=quarter%2?bitmap.width:bitmap.height;
        const source=new OffscreenCanvas(ow,oh),sc=source.getContext('2d',{willReadFrequently:true});
        sc.translate(ow/2,oh/2);sc.rotate(quarter*Math.PI/2);sc.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
        const luma=resampleSaveLuma(sc.getImageData(0,0,ow,oh).data,ow,oh,f);source.width=source.height=1;
        try {return codeFromArchive(await extractSaveImage(luma));} catch { /* Try the other whole-image orientation. */ }
      }
    }
    throw Error(attempted?'图片压缩过重或不完整，请选择保存的原图。':'这不是完整的存档图，请选择未裁切的原图。');
  } finally { bitmap.close(); }
}
