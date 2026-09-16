import {RELEASE_NAME} from './release.js';

export const CARD_STYLES = [
 {id:'',name:'世界纪念',color:'#567953',paper:'#f2f0e4',ink:'#304b38',muted:'#6e7c61'},
 {id:'web-card-worklog',name:'方块施工档',color:'#506974',paper:'#e9ede5',ink:'#29464d',muted:'#61787a'},
 {id:'web-card-oak',name:'橡木旅行册',color:'#a16f3f',paper:'#eddfc5',ink:'#553e2d',muted:'#8a755f'},
 {id:'web-card-redstone',name:'红石运行单',color:'#e9a069',paper:'#202e2b',ink:'#eaf0d9',muted:'#a7b9a5'},
 {id:'web-card-end',name:'末地收藏页',color:'#b7a0d5',paper:'#252238',ink:'#eee9f6',muted:'#b1a7c9'},
];
const font=(ctx,size,weight=500)=>ctx.font=`${weight} ${size}px system-ui, sans-serif`;
function text(ctx,value,x,y,width,size,color,weight=500){
 const label=String(value??'');ctx.fillStyle=color;font(ctx,size,weight);
 const measure=ctx.measureText(label).width;if(measure>width)font(ctx,Math.max(12,size*width/measure),weight);
 ctx.fillText(label,x,y);
}
function line(ctx,x,y,w,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,1);}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();}
async function picture(ctx,shot,f){
 const img=new Image();img.src=shot.url;
 if(img.decode)await img.decode();else await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;});
 ctx.fillStyle=shot.background||'#e5eadc';ctx.fillRect(f.x,f.y,f.w,f.h);
 const scale=Math.min(f.w/img.width,f.h/img.height);ctx.drawImage(img,f.x+(f.w-img.width*scale)/2,f.y+(f.h-img.height*scale)/2,img.width*scale,img.height*scale);
}
export async function paintMemento({shots,statistics=[],detail='',label='',style='',release=RELEASE_NAME,historical=false}) {
 if(!shots?.length||![1,3].includes(shots.length))throw Error('请选择一个场景或三个世界。');
 const t=CARD_STYLES.find(t=>t.id===style)||CARD_STYLES[0],kind=CARD_STYLES.indexOf(t),victory=shots.length===3;
 const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1920;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前设备暂时无法生成图片。');ctx.scale(4/3,4/3);
 canvas.setAttribute('aria-label',label+' · '+t.name);ctx.fillStyle=t.paper;ctx.fillRect(0,0,1080,1440);
 const title=victory?'三个世界，一路盖过来。':'从一块草方块开始';
 let main={x:64,y:245,w:952,h:victory?545:745};
 if(kind===0){
  text(ctx,'A LITTLE WORLD OF MY OWN',64,73,830,17,t.muted,700);
  text(ctx,title,64,151,950,54,t.ink,800);text(ctx,label,66,198,900,20,t.muted);
  diamond(ctx,988,67,12,t.color);line(ctx,64,219,952,'#c8cfb9');
 }else if(kind===1){
  ctx.strokeStyle='#cad3cb';ctx.lineWidth=.6;
  for(let x=36;x<1080;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1440);ctx.stroke();}
  for(let y=36;y<1440;y+=36)line(ctx,0,y,1080,'#d5ddd2');
  ctx.fillStyle=t.ink;ctx.fillRect(48,45,112,132);text(ctx,'01',63,139,90,70,t.paper,800);
  text(ctx,'方块施工档',192,117,780,52,t.ink,800);text(ctx,'CONSTRUCTION ARCHIVE / '+(victory?'COMPLETE':'IN PROGRESS'),195,155,810,16,t.muted,700);
  text(ctx,label,64,215,960,20,t.ink);main={...main,x:80,w:920};
 }else if(kind===2){
  ctx.fillStyle='#c59867';ctx.fillRect(55,0,21,128);ctx.fillRect(994,0,8,1440);
  text(ctx,'寄自我的小世界',115,106,700,48,t.ink,700);text(ctx,'A POSTCARD, BUILT BY HAND',116,146,800,16,t.muted,700);
  ctx.save();ctx.translate(932,98);ctx.rotate(.12);ctx.strokeStyle=t.muted;ctx.lineWidth=2;ctx.strokeRect(-46,-46,92,92);diamond(ctx,0,-5,20,t.color);text(ctx,'方块邮局',-37,30,74,14,t.ink,700);ctx.restore();
  text(ctx,label,76,207,850,20,t.muted);main={x:77,y:263,w:926,h:victory?500:702};
 }else if(kind===3){
  ctx.fillStyle=t.color;ctx.fillRect(0,0,1080,14);text(ctx,'WORLD / ONLINE',56,75,840,18,t.color,750);
  text(ctx,'小世界，大工程。',56,153,920,60,t.ink,800);text(ctx,label,60,202,900,20,t.muted);
  main={x:56,y:252,w:968,h:victory?510:666};
  for(let i=0;i<34;i++){ctx.fillStyle=i%5===0?t.color:'#597368';ctx.fillRect(58+i*29,228,i%5===0?8:2,8);}
 }else{
  ctx.fillStyle='#322d49';ctx.fillRect(38,35,1004,1267);
  text(ctx,'收藏一整个世界',67,116,950,57,t.ink,750);text(ctx,'A WORLD TO KEEP',70,165,850,18,t.color,700);
  text(ctx,label,70,210,910,20,t.muted);diamond(ctx,973,155,16,t.color);
  main={x:70,y:258,w:940,h:victory?510:694};
 }
 const fields=victory?[main,{x:64,y:835,w:466,h:246},{x:550,y:835,w:466,h:246}]:[main];
 for(let i=0;i<shots.length;i++){
  const f=fields[i];ctx.save();
  if(kind===2&&i===0){ctx.translate(540,f.y+f.h/2);ctx.rotate(-.022);ctx.translate(-540,-f.y-f.h/2);ctx.fillStyle='#fff8ea';ctx.fillRect(f.x-15,f.y-15,f.w+30,f.h+62);}
  await picture(ctx,shots[i],f);
  if(kind===1){ctx.strokeStyle=t.ink;ctx.lineWidth=2;for(const [x,y]of[[f.x-8,f.y-8],[f.x+f.w+8,f.y+f.h+8]]){ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();}}
  if(kind===4){for(const [x,y]of[[f.x-5,f.y-5],[f.x+f.w-25,f.y+f.h+2]]){ctx.fillStyle=t.color;ctx.fillRect(x,y,30,3);}}
  text(ctx,shots[i].label||['主世界','下界','末地'][i],f.x+8,f.y+f.h+29,f.w-16,16,t.muted,600);ctx.restore();
 }
 const y=victory?1150:kind===3?1000:1075;
 const list=statistics.slice(0,4);
 if(kind===3&&!victory){
  for(let i=0;i<list.length;i++){
   const x=56+(i%2)*492,sy=y+Math.floor(i/2)*105;line(ctx,x,sy,470,'#536b5f');
   text(ctx,list[i][1],x,sy+28,220,15,t.muted);text(ctx,list[i][0],x,sy+77,466,38,t.ink,750);
  }
 }else{
  if(kind===0){ctx.fillStyle=t.ink;ctx.fillRect(48,y-20,984,139);}
  for(let i=0;i<list.length;i++){
   const x=70+i*243;const ink=kind===0?t.paper:t.ink,muted=kind===0?'#c8d3bc':t.muted;
   if(kind!==0)line(ctx,x,y-12,212,t.muted);
   text(ctx,list[i][0],x,y+39,208,31,ink,750);text(ctx,list[i][1],x,y+81,210,16,muted);
  }
 }
 if(detail)text(ctx,detail,64,victory?1290:kind===3?1260:1257,952,17,t.muted);
 line(ctx,64,1326,952,t.muted);text(ctx,'MC Clicker',64,1373,600,28,t.ink,800);
 text(ctx,victory?'THREE WORLDS / ONE JOURNEY':'KEEP BUILDING.',650,1371,360,14,t.muted,700);
 text(ctx,`${release}${historical?' · 首次通关记录':''}`,64,1410,950,13,t.muted);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图片未能生成');
 return {canvas,blob,file:new File([blob],`MC-Clicker-${style||'world'}${victory?'-journey':''}.png`,{type:'image/png'}),label,style};
}
