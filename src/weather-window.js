import * as T from 'three';
import {cube,group} from './models.js';
const pixels=new Uint8Array(64*48*4);
const texture=new T.DataTexture(pixels,64,48,T.RGBAFormat);texture.magFilter=texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;
const paneGeometry=new T.PlaneGeometry(1,.72);
const material=new T.MeshBasicMaterial({map:texture,toneMapped:false});
let signature='';
export function studioWeatherWindow(parent) {
 const g=group(parent,1.99,1.49,-2.263);g.userData.weatherWindow=true;
 for(const x of [-.53,.53])cube(g,'#ac8657',x,0,.005,.07,.81,.09);
 for(const y of [-.39,.39])cube(g,'#bc966a',0,y,.005,1.12,.07,.09);
 const pane=new T.Mesh(paneGeometry,material);pane.userData.nonSolid=true;pane.position.z=.04;g.add(pane);
 cube(g,'#9d7b50',0,0,.07,.035,.74,.045);cube(g,'#9d7b50',0,0,.075,1.02,.035,.04);cube(g,'#bb9667',0,-.44,.14,1.18,.06,.28);
 return g;
}
export function updateWindow({color,night,rain,snow,clock,reduced}) {
 const stamp=[color.getHex(),Math.round(night*8),Math.round(rain*8),Math.round(snow*8),reduced?0:Math.floor(clock*5)].join(':');if(stamp===signature)return;signature=stamp;
 const r=Math.round(color.r*255),g=Math.round(color.g*255),b=Math.round(color.b*255);
 const put=(x,y,c)=>{if(x<0||x>=64||y<0||y>=48)return;const k=(y*64+x)*4;pixels[k]=c[0];pixels[k+1]=c[1];pixels[k+2]=c[2];pixels[k+3]=255};
 for(let y=0;y<48;y++)for(let x=0;x<64;x++)put(x,y,[r,g,b]);
 // Layered block silhouettes sit beyond the glass, never inside the room.
 for(let x=0;x<64;x++){const top=6+((Math.floor(x/8)*7)%6);for(let y=0;y<top;y++)put(x,y,night>.5?[43,61,63]:[115,146,117]);}
 if(night>.6)for(let i=0;i<13;i++)put((i*19+5)%64,20+(i*11)%25,[221,225,213]);
 const t=reduced?0:clock;
 for(let i=0;i<24;i++){const x=(i*19+Math.floor(t*3))%64,y=((i*13-Math.floor(t*(snow>rain?5:28)))%48+48)%48;if(rain>.1&&i<24*rain)for(let h=0;h<4;h++)put(x,y+h,[147,183,190]);if(snow>.1&&i<24*snow){put(x,y,[240,243,237]);put(x+1,y,[240,243,237]);}}
 texture.needsUpdate=true;
}
