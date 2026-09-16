import { SAVE_IMAGE } from './save-image-codec.js';
// Browser "high" interpolation differs between engines. Use a fixed Lanczos-3
// luma resampler for the data square instead of relying on that implementation.
const kernel = x => { x=Math.abs(x);if(x<1e-8)return 1;if(x>=3)return 0;return Math.sin(Math.PI*x)*Math.sin(Math.PI*x/3)/(Math.PI*Math.PI*x*x/3); };
function weights(length, full, start, count) {
  const ratio=length/full,filter=Math.max(1,ratio),radius=3*filter;
  return Array.from({length:count},(_,i)=>{
    const center=(start+i+.5)*ratio-.5,indices=[],values=[];let sum=0;
    for(let j=Math.ceil(center-radius);j<=Math.floor(center+radius);j++){if(j<0||j>=length)continue;const value=kernel((j-center)/filter);indices.push(j);values.push(value);sum+=value;}
    return {indices,values:values.map(v=>v/sum)};
  });
}
export function resampleSaveLuma(rgba,width,height,f=SAVE_IMAGE) {
  if(rgba.length!==width*height*4)throw Error('图片像素不完整。');
  const n=f.size,wx=weights(width,f.width,f.x,n),wy=weights(height,f.height,f.y,n);
  const first=Math.min(...wy[0].indices),last=Math.max(...wy[n-1].indices),rows=last-first+1;
  const horizontal=new Float32Array(rows*n),output=new Float32Array(n*n);
  for(let y=first;y<=last;y++)for(let x=0;x<n;x++){
    const {indices,values}=wx[x];let value=0;
    for(let k=0;k<indices.length;k++){const i=(y*width+indices[k])*4;value+=(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2])*values[k];}
    horizontal[(y-first)*n+x]=value;
  }
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const {indices,values}=wy[y];let value=0;
    for(let k=0;k<indices.length;k++)value+=horizontal[(indices[k]-first)*n+x]*values[k];
    output[y*n+x]=value;
  }
  return output;
}
