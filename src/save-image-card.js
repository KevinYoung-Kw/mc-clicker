import { imageFormat } from './save-image-codec.js';
import { saveImageTheme } from './save-image-art.js';

export async function paintSaveImage(encoded, snapshot, release, format) {
  const f=imageFormat(encoded.size),t=saveImageTheme(snapshot.webAppearance?.equipped?.theme),canvas=document.createElement('canvas');
  canvas.width=f.width;canvas.height=f.height;const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('图片未能生成，请使用备用存档码。');
  const text=(value,x,y,width,size,color=t.ink,weight=500)=>{ctx.font=`${weight} ${size}px system-ui,sans-serif`;const s=String(value),measured=ctx.measureText(s).width;if(measured>width)ctx.font=`${weight} ${size*width/measured}px system-ui,sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y);};
  ctx.fillStyle=t.paper;ctx.fillRect(0,0,f.width,f.height);ctx.strokeStyle=t.edge;ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(24,24);ctx.lineTo(f.width-80,24);ctx.lineTo(f.width-24,80);ctx.lineTo(f.width-24,f.height-24);ctx.lineTo(24,f.height-24);ctx.closePath();ctx.stroke();
  text('MC CLICKER / SAVE',96,66,1000,29,t.muted,650);text('存档记录',96,144,850,60,t.ink,700);
  const time=new Date(snapshot.savedAt||Date.now()).toLocaleString('zh-CN',{hour12:false});text(time,96,200,1200,31,t.muted);
  text(encoded.id,f.width-398,92,286,32,t.muted);text(t.name,f.width-528,146,416,32,t.ink);
  const minutes=Math.floor((snapshot.play||0)/60),play=minutes<60?`${minutes} 分钟`:`${Math.floor(minutes/60)} 小时 ${minutes%60} 分`;
  const fields=[['绿宝石',format(snapshot.money)],['游玩时间',play],['村民',`${snapshot.counts?.V2||0} 位`],['主世界土地',`${snapshot.chunks?.overworld?.length||0} 片`]];
  fields.forEach(([label,value],i)=>{const col=f.size/4,x=96+i*col;text(label,x,268,col-28,31,t.muted);text(value,x,323,col-28,45,t.ink,650);});
  ctx.fillStyle=t.edge;ctx.fillRect(96,350,f.size,2);
  ctx.putImageData(new ImageData(encoded.pixels,f.size,f.size),f.x,f.y);
  ctx.fillStyle=t.edge;for(let i=0;i<12;i++)ctx.fillRect(96+i*34,f.height-78,19,46);
  text('本地存档',660,f.height-42,350,28,t.muted);text(`MCI${f.version} · ${release}`,f.width-678,f.height-42,580,28,t.muted);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  canvas.width=canvas.height=1;
  if(!blob)throw Error('图片未能生成，请使用备用存档码。');
  return blob;
}
