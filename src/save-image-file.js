// Inspect raster headers BEFORE asking the browser to allocate a decoded image.
export const MAX_IMAGE_FILE = 32 * 1024 * 1024, MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
export function inspectImageHeader(buffer) {
  const a = new Uint8Array(buffer), d = new DataView(buffer); let w = 0, h = 0;
  if (a.length > MAX_IMAGE_FILE || a.length < 24) throw Error('请选择 32 MB 以内的完整存档图片。');
  if (a[0]===137 && a[1]===80 && a[2]===78 && a[3]===71 && a[4]===13 && a[5]===10 && a[6]===26 && a[7]===10) { w=d.getUint32(16);h=d.getUint32(20); }
  else if (a[0]===255 && a[1]===216) {
    for(let p=2;p<a.length-8;) {
      if(a[p++]!==255)throw Error('JPEG 图片不完整。');
      while(a[p]===255)p++;const marker=a[p++];if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(p+2>a.length)break;const size=d.getUint16(p);if(size<2||p+size>a.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)break;h=d.getUint16(p+3);w=d.getUint16(p+5);break;}p+=size;
    }
  } else if(String.fromCharCode(...a.slice(0,4))==='RIFF' && String.fromCharCode(...a.slice(8,12))==='WEBP') {
    const tag=String.fromCharCode(...a.slice(12,16));
    if(tag==='VP8X' && a.length>=30) { w=1+a[24]+a[25]*256+a[26]*65536;h=1+a[27]+a[28]*256+a[29]*65536; }
    else if(tag==='VP8 ' && a.length>=30 && a[23]===157&&a[24]===1&&a[25]===42) { w=d.getUint16(26,true)&16383;h=d.getUint16(28,true)&16383; }
    else if(tag==='VP8L' && a.length>=25 && a[20]===47) { const bits=d.getUint32(21,true);w=1+(bits&16383);h=1+(bits>>>14&16383); }
  }
  if(!w||!h)throw Error('请选择 PNG、JPEG 或 WebP 存档图片。');
  if(w>6000||h>6000||w*h>MAX_IMAGE_PIXELS)throw Error('图片尺寸过大，请选择保存的存档图。');
  return {width:w,height:h};
}
