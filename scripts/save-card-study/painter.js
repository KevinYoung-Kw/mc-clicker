// Design study only. QR pixels are data: no smoothing, overlays, or artwork inside symbols.
export async function paintSaveCard(data,shot,{carrier='pixels'}={}){
 const W=1440,compact=data.matrices.length===1,H=carrier==='pixels'?1600+data.pixelRows.length*3:compact?1780:2720;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const c=canvas.getContext('2d'),p={paper:'#f4f0e3',ink:'#304e3b',muted:'#7b8971',line:'#c9cfb9',green:'#dfe7d3',gold:'#b99b5e',code:'#193e2c'};
 const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
 const text=(s,x,y,size=28,col=p.ink,weight=400,align='left',mono=false)=>{c.fillStyle=col;c.font=`${weight} ${size}px ${mono?'ui-monospace, SFMono-Regular, Menlo':'"PingFang SC", "Microsoft YaHei"'}, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(String(s),x,y)};
 const rule=y=>rect(72,y,1296,2,p.line);
 const pixel=(rows,x,y,unit,col)=>rows.forEach((row,yy)=>[...row].forEach((v,xx)=>{if(v==='1')rect(x+xx*unit,y+yy*unit,unit,unit,col)}));
 rect(0,0,W,H,p.paper);rect(0,0,16,H,p.green);rect(W-16,0,16,H,p.green);
 rect(16,0,W-32,6,p.ink);rect(16,H-6,W-32,6,p.ink);
 // Notched label edges, drawn on the opaque original so saving needs no alpha support.
 for(const x of [26,W-38])for(const y of [26,H-38])rect(x,y,12,12,p.gold);
 text('MC CLICKER',72,91,30,p.ink,700);text('WORLD SAVE / 世界存档',1368,91,23,p.muted,500,'right');
 rule(119);
 text(data.label,72,212,66,p.ink,650);
 text(data.savedAt,1368,205,26,p.muted,400,'right',true);
 const img=new Image();img.src=shot.url;await img.decode();
 rect(72,250,1296,790,shot.background);c.drawImage(img,72,250,1296,790);
 // Keep the full world in view. Decorative corner ticks stay outside its crop.
 for(const [x,y,sx,sy] of [[72,250,1,1],[1368,250,-1,1],[72,1040,1,-1],[1368,1040,-1,-1]]){
  rect(x+(sx<0?-36:0),y+(sy<0?-3:0),36,3,p.muted);rect(x+(sx<0?-3:0),y+(sy<0?-36:0),3,36,p.muted);
 }
 const stats=[['绿宝石',data.money],['主世界土地',`${data.lands} 片`],['村民',`${data.residents} 位`],['前台游玩',data.play]];
 stats.forEach(([label,value],i)=>{const x=72+i*334;text(label,x,1098,24,p.muted);text(value,x,1150,i===0&&value.length>10?34:38,p.ink,600);if(i>0)rect(x-24,1076,2,83,p.line)});
 rule(1200);
 if(carrier==='pixels'){
  pixel(['111111110','100000001','101110101','101110101','100000001','101111101','101000101','101000101','111111111'],72,1252,8,p.ink);
  text('下次，从这里继续。',178,1304,39,p.ink,600);
  text('保存原图 · 在设置中导入',1368,1300,27,p.muted,400,'right');
  data.pixelRows.forEach((row,y)=>row.forEach((n,x)=>rect(72+x*3,1380+y*3,3,3,`rgb(${24+n*11},${36+n*13},${24+n*9})`)));
  text('存档数据 · 请勿裁剪、截图或压缩',72,1380+data.pixelRows.length*3+60,24,p.muted);
 }else if(compact){
  pixel(['111111110','100000001','101110101','101110101','100000001','101111101','101000101','101000101','111111111'],72,1260,8,p.ink);
  text('世界装进一张卡',178,1310,36,p.ink,600);
  text('保存原图，下次从这里继续。',72,1398,30,p.muted);
  text('导入入口',72,1470,23,p.muted);text('设置 → 存档与读档',72,1515,29,p.ink,500);
  drawCode(data.matrices[0],928,1260,420);
 }else{
  text('存档数据',72,1260,29,p.ink,600);
  text('保存整张原图 · 保留完整数据区',1368,1260,24,p.muted,400,'right');
  data.matrices.forEach((matrix,i)=>{
   const x=72+(i%2)*666,y=1306+Math.floor(i/2)*608;
   drawCode(matrix,x,y,630);
  });
  text('下次从这里继续',72,2575,31,p.ink,600);
  text('设置 → 存档与读档 → 导入图片',1368,2575,26,p.muted,400,'right');
 }
 const footer=H-111;rule(footer);
 for(let i=0;i<6;i++)rect(72+i*26,footer+28,16,38,p.gold);
 text(`V${data.release}`,272,H-50,24,p.muted,400,'left',true);
 text(`存档编号 ${data.digest.slice(0,8).toUpperCase()}`,1368,H-50,24,p.muted,400,'right',true);
 function drawCode(matrix,x,y,width){
  const unit=Math.floor((width-30)/matrix.length),size=matrix.length*unit;
  const xx=x+Math.floor((width-size)/2),yy=y+12;
  rect(x,y,width,size+24,'#fffdf7');
  c.imageSmoothingEnabled=false;pixel(matrix,xx,yy,unit,p.code);
 }
 return canvas;
}
