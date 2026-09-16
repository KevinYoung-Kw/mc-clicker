// Local prototype: read exact pixels, validate the archive, then reuse the real save decoder.
// This reader never writes localStorage or replaces the running world.
export async function readSaveCard(file){
 if(file.size>12*1024*1024)throw Error('图片太大，请选择导出的存档原图。');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();
  const w=img.naturalWidth,h=img.naturalHeight;
  if(w!==1440||h<=1600||h>4096||(h-1600)%3)throw Error('这不是完整的存档原图。请勿使用截图或缩略图。');
  const rows=(h-1600)/3,c=document.createElement('canvas');c.width=1296;c.height=rows*3;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,72,1380,1296,rows*3,0,0,1296,rows*3);
  const pixels=ctx.getImageData(0,0,1296,rows*3).data,nibbles=[];
  for(let y=0;y<rows;y++)for(let x=0;x<432;x++){
   const i=((y*3+1)*1296+x*3+1)*4;
   const n=Math.round((pixels[i+1]-36)/13);
   if(n<0||n>15||pixels[i]!==24+n*11||pixels[i+1]!==36+n*13||pixels[i+2]!==24+n*9){
    // Only the unused last-row padding may be paper-colored.
    nibbles.push(-1);continue;
   }
   nibbles.push(n);
  }
  const bytes=new Uint8Array(Math.floor(nibbles.length/2));
  for(let i=0;i<bytes.length;i++)bytes[i]=nibbles[i*2]*16+nibbles[i*2+1];
  if(String.fromCharCode(...bytes.slice(0,4))!=='MCIs')throw Error('未找到存档数据，请选择保存下来的原图。');
  const length=new DataView(bytes.buffer).getUint32(4);
  if(length<2||length>bytes.length-40)throw Error('存档图片不完整，当前世界没有被修改。');
  if(nibbles.slice(0,(length+40)*2).some(v=>v<0))throw Error('图片的数据像素被改动了，请选择原图。');
  const archive=bytes.slice(40,40+length);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',archive));
  if(!digest.every((v,i)=>v===bytes[8+i]))throw Error('图片中的存档数据损坏，请重新保存原图。');
  if(![2,3,4,5].includes(archive[0]))throw Error('暂不支持这张存档图的版本。');
  const [{encodeText},{checksum},{decodePortableSave},{loadBrotli}]=await Promise.all([
   import('../../src/save-text.js'),import('../../src/save-code.js'),import('../../src/save-brotli.js'),import('../../src/save-brotli-runtime.js')]);
  const payload=archive.subarray(1),code=`MCC${archive[0]}.${encodeText(payload)}.${checksum(payload)}`;
  return {code,envelope:await decodePortableSave(code,loadBrotli)};
 }finally{URL.revokeObjectURL(url)}
}
