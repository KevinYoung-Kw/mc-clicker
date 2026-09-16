import { SAVE_IMAGE, imageFormat, seededRandom } from './save-image-codec.js';

// Text and the outer frame may change with themes. The data square never moves.
const themes = {
  '': { name: '绿宝石卡带', pattern: 'terrain', paper: '#e5e7d7', ink: '#304e3b', muted: '#687b5c', edge: '#9ead8b', colors: [[66,89,68],[87,113,80],[119,145,96],[159,169,120],[193,196,152]] },
  'web-theme-oak': { name: '橡木档案', pattern: 'rings', paper: '#ebe0c7', ink: '#504431', muted: '#796a50', edge: '#b2a07d', colors: [[88,76,57],[114,96,70],[142,122,88],[171,152,112],[197,183,145]] },
  'web-theme-redstone': { name: '红石存储芯片', pattern: 'circuit', paper: '#374e50', ink: '#e0dfc2', muted: '#b0bca9', edge: '#82968e', colors: [[61,80,82],[82,105,105],[106,130,129],[141,158,146],[191,187,143]] },
  'web-theme-end': { name: '末地存储芯片', pattern: 'portal', paper: '#2d263a', ink: '#efe6f5', muted: '#c7b8d0', edge: '#987cab', colors: [[70,61,86],[92,79,112],[122,99,145],[154,136,172],[194,179,197]] },
  'web-theme-backpack': { name: '石质档案', pattern: 'stone', paper: '#d9ddce', ink: '#354136', muted: '#65715e', edge: '#9aa58f', colors: [[68,77,67],[92,103,86],[121,132,112],[151,161,140],[188,193,170]] },
  'web-theme-desktop95': { name: '桌面存储盘', pattern: 'circuit', paper: '#c8ccbf', ink: '#203d43', muted: '#4b645f', edge: '#7a8e82', colors: [[58,77,92],[75,101,112],[104,130,132],[141,158,153],[187,193,181]] },
  'web-theme-macintosh': { name: '麦金塔磁盘', pattern: 'stone', paper: '#e6e4d9', ink: '#393e36', muted: '#6b7062', edge: '#9c9f90', colors: [[64,65,61],[92,94,86],[122,125,112],[158,160,145],[194,195,181]] },
};
export const SAVE_IMAGE_THEMES = Object.keys(themes);
export const saveImageTheme = id => themes[id] || themes[''];
export function makeSaveTexture(seed, themeId = '', size = SAVE_IMAGE.size) {
  const t = saveImageTheme(themeId), rng = seededRandom(seed), noise = Array.from({ length: 81 }, rng), grid = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const xx=x/8, yy=y/8, a=Math.floor(xx), b=Math.floor(yy), u=(xx-a)**2*(3-2*(xx-a)), v=(yy-b)**2*(3-2*(yy-b));
    const n=(noise[b*9+a]*(1-u)+noise[b*9+a+1]*u)*(1-v)+(noise[(b+1)*9+a]*(1-u)+noise[(b+1)*9+a+1]*u)*v;
    const r = Math.hypot(x-31.5, y-31.5);
    const wave = value => { const phase = Math.floor(value) % 8; return Math.min(phase, 8 - phase); };
    grid[y*64+x] = t.pattern==='rings' ? wave(r/4+n) : t.pattern==='portal' ? wave(Math.max(Math.abs(x-31),Math.abs(y-31))/5+n) : Math.min(4,Math.floor(n*5));
  }
  const rect=(x,y,w,h,c)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&xx<64&&yy>=0&&yy<64)grid[yy*64+xx]=c;};
  for (const k of [1,3]) { rect(k,k,64-2*k,1,4);rect(k,63-k,64-2*k,1,4);rect(k,k,1,64-2*k,4);rect(63-k,k,1,64-2*k,4); }
  if(t.pattern==='circuit') for(let x=7;x<59;x+=5) { rect(x,5,1,15,4);rect(x,15,3,1,4);rect(x+2,15,1,7,4);rect(63-x,44,1,15,4); }
  if(t.pattern==='stone') for(let y=8;y<60;y+=8) { rect(5,y,54,1,1);for(let x=8+(y%16);x<60;x+=16)rect(x,y,1,8,1); }
  rect(21,20,23,25,4);
  const floppy=['111111110','100000001','101110101','101110101','100000001','101111101','101000101','101000101','111111111'];
  floppy.forEach((row,y)=>[...row].forEach((value,x)=>rect(23+x*2,23+y*2,2,2,value==='1'?0:4)));
  const n=imageFormat(size).size, pixels=new Uint8ClampedArray(n*n*4), unit=n/64;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) { const i=(y*n+x)*4,c=t.colors[grid[Math.floor(y/unit)*64+Math.floor(x/unit)]];pixels[i]=c[0];pixels[i+1]=c[1];pixels[i+2]=c[2];pixels[i+3]=255; }
  return pixels;
}
