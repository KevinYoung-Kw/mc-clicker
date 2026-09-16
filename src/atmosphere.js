import {transportTopology} from './routing.js';
import * as T from 'three';
import {environmentEnabled,environmentPhase,environmentWeather,nightAmount} from './environment.js';
import {updateWindow} from './weather-window.js';
const rand=i=>{const x=Math.sin(i*71.13+42.7)*43758.54;return x-Math.floor(x)};
const smooth=(x,a,b)=>T.MathUtils.smoothstep(x,a,b);
export function windowGlowMatrix(mesh) {
 // Window front is local +Z; keep the building's rotation and scale.
 return mesh.matrixWorld.clone().multiply(new T.Matrix4().makeTranslation(0,0,.62)).multiply(new T.Matrix4().makeScale(1,1,.12));
}
export function environmentLight(phase) {
 const night=nightAmount(phase),angle=phase*Math.PI*2-Math.PI/2;
 const sunY=Math.sin(angle),moon=sunY<0,azimuth=angle+(moon?Math.PI:0);
 const horizon=smooth(Math.abs(sunY),0,.3);
 return {night,x:Math.cos(azimuth)*20,y:2+Math.abs(sunY)*24,z:12,
   sun:(3.2*(1-night)+.85*night)*horizon,hemi:1.8-.55*night,
   warmth:(1-night)*Math.pow(1-Math.abs(sunY),2)};
}
export class AtmosphereView {
 constructor(scene) {
  this.group=new T.Group();this.group.name='environment-effects';scene.add(this.group);
  this.geometry=new T.BoxGeometry(1,1,1);this.dummy=new T.Object3D();this.color=new T.Color();this.target=new T.Color();this.sunColor=new T.Color();
  this.meshes=[];this.phase=.5;this.rain=0;this.snow=0;this.cloud=0;this.lastTime=null;this.signature='';this.ambience={rain:0,indoor:false};
  this.rainMesh=this.pool('rain',192,'#adccd2',.52);this.snowMesh=this.pool('snow',128,'#f1f4e9',.9);
  this.ripples=this.pool('rain-ripples',96,'#c1d6ca',.35);this.wet=this.pool('wet-ground',32,'#354b46',.12);
  this.snowPatches=this.pool('snow-patches',180,'#ecf0e5',.86);this.stars=this.pool('stars',100,'#e9eee1',.8);
  this.glows=this.pool('fireflies',24,'#e7e49a',.8);this.meteors=this.pool('meteors',8,'#e4d7f0',.9);
  this.windows=this.pool('home-windows',256,'#f4c881',.65);
  this.roofs=[];this.groundPoints=[];this.windowPoints=[];
 }
 pool(name,count,color,opacity) {const m=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});const mesh=new T.InstancedMesh(this.geometry,m,count);mesh.name='environment-'+name;mesh.frustumCulled=false;mesh.userData.nonSolid=true;mesh.raycast=()=>{};mesh.visible=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);this.meshes.push(mesh);return mesh;}
 place(mesh,i,x,y,z,w,h,d,rz=0,ry=0) {const o=this.dummy;o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.set(0,ry,rz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
 finish(mesh,count,alpha){mesh.visible=count>0&&alpha>.003;mesh.count=count;mesh.material.opacity=alpha;if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;}
 surfaces(w) {
  if(this.signature===w.signature)return;this.signature=w.signature;this.roofs=[];this.groundPoints=[];this.windowPoints=[];
  const box=new T.Box3();
  w.graph.traverse(o=>{
   if(!o.isMesh||(!o.userData.weatherSurface&&!o.userData.windowGlow))return;
   o.geometry.computeBoundingBox();box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
   if(o.userData.weatherSurface) this.roofs.push({x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,y:box.max.y+.012,w:box.max.x-box.min.x,d:box.max.z-box.min.z});
   if(o.userData.windowGlow)this.windowPoints.push(windowGlowMatrix(o));
  });
  const segments=w.state.counts.M16?transportTopology(w.state,'overworld').edges.flatMap(edge=>edge.points.slice(1).map((b,i)=>[edge.points[i],b])):[];
  const nearRail=(x,z)=>segments.some(([a,b])=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<.5;});
  for(const c of w.state.chunks.overworld)for(let i=0;i<8;i++){
   const x=c.x*5+(rand(i+c.x*19+c.z*37)-.5)*4.5,z=c.z*5+(rand(i+73+c.x*27+c.z*17)-.5)*4.5;
   if(nearRail(x,z))continue;
   if(Object.values(w.state.placements).some(p=>p.realm==='overworld'&&Math.hypot(p.x-x,p.z-z)<1.15))continue;
   this.groundPoints.push({x,z,y:.182,w:.2+rand(i+33)*.38,d:.2+rand(i+25)*.4});
  }
 }
 update(w) {
  const s=w.state;
  const e=s.environment;if(!e)return;
  const dt=this.lastTime===null?0:Math.max(0,Math.min(.06,w.time-this.lastTime));this.lastTime=w.time;
  const phase=environmentPhase(s);if(!this.initialized){this.phase=phase;const initial=environmentWeather(s);this.rain=Number(initial==='rain');this.snow=Number(initial==='snow');this.cloud=Number(initial!=='clear');this.initialized=true;}
  const gap=((phase-this.phase+1.5)%1)-.5;this.phase=(this.phase+gap*(1-Math.exp(-dt/.4))+1)%1;
  if(Math.abs(gap)>.002)w.renderer.shadowMap.needsUpdate=true;
  const weather=environmentWeather(s),blend=1-Math.exp(-dt/3.2);
  this.rain+=(Number(weather==='rain')-this.rain)*blend;this.snow+=(Number(weather==='snow')-this.snow)*blend;this.cloud+=(Number(weather!=='clear')-this.cloud)*blend;
  const light=environmentLight(this.phase),night=light.night;
  this.color.set('#e5eadc').lerp(this.target.set('#344b61'),night);
  if(light.warmth>.04)this.color.lerp(this.target.set('#e8bd91'),light.warmth*.5);
  const palette=e.palette;if(palette)this.color.lerp(this.target.set({'legacy-sky-0':'#bcd6c9','legacy-sky-1':'#dfbe91','legacy-sky-2':'#414a65'}[palette]),.65);
  this.color.lerp(this.target.set('#91a6aa'),this.cloud*.45);
  updateWindow({color:this.color,night,rain:this.rain,snow:this.snow,clock:e.clock,reduced:s.reducedMotion});
  this.ambience.rain=this.rain;this.ambience.indoor=w.interior;
  const outdoor=w.view==='overworld'&&!w.interior;
  this.group.visible=outdoor;
  if(!outdoor) {this.ambience.rain=w.interior?this.rain:0;w.sun.intensity=w.interior?2.55:3.2;w.hemi.intensity=w.interior?1.5:1.8;return;}
  w.scene.background.copy(this.color);
  w.sun.position.set(light.x,light.y,light.z);
  w.sun.intensity=light.sun*(1-this.cloud*.32);w.hemi.intensity=light.hemi;
  this.sunColor.set('#fff1d9').lerp(this.target.set('#efb17f'),light.warmth).lerp(this.target.set('#b0c8eb'),night);w.sun.color.copy(this.sunColor);
  w.fill.intensity=.65-.23*night;
  this.surfaces(w);
  const phone=w.renderer.domElement.clientWidth<760,reduced=s.reducedMotion,t=reduced?0:e.clock,
   extent=Math.max(5,Math.min(16,w.span||5)),cx=w.center?.x||0,cz=w.center?.z||0,height=Math.max(6,Math.min(10,(w.roofHeight||2)+4));
  const rainCount=reduced?0:phone?96:192,snowCount=reduced?0:phone?64:128;
  if(this.rain>.003)for(let i=0;i<rainCount;i++){
   const y=.25+((rand(i+95)*height-t*(4+rand(i+20)*2))%height+height)%height;
   this.place(this.rainMesh,i,cx+(rand(i)-.5)*extent+(height-y)*.13,y,cz+(rand(i+200)-.5)*extent,.012+rand(i+64)*.008,.15+rand(i+12)*.22,.014,-.12);
  }this.finish(this.rainMesh,rainCount,this.rain*.43);
  if(this.snow>.003)for(let i=0;i<snowCount;i++){
   const size=.028+rand(i+2)*.05,y=.23+((rand(i+195)*height-t*(.35+rand(i+78)*.35))%height+height)%height;
   this.place(this.snowMesh,i,cx+(rand(i)-.5)*extent+Math.sin(t*.3+i)*.17,y,cz+(rand(i+200)-.5)*extent,size,size,.016,Math.sin(t*.2+i)*.4);
  }this.finish(this.snowMesh,snowCount,this.snow*.88);
  const lands=s.counts.V1?s.chunks.overworld:[];
  lands.slice(0,32).forEach((c,i)=>this.place(this.wet,i,c.x*5,.169,c.z*5,4.98,.008,4.98));this.finish(this.wet,Math.min(32,lands.length),this.rain*.105);
  const patches=[...this.roofs,...this.groundPoints].slice(0,phone?96:180);
  if(this.snow>.003)patches.forEach((p,i)=>this.place(this.snowPatches,i,p.x,p.y,p.z,p.w*(.4+rand(i)*.3),.012+this.snow*.016,p.d*(.55+rand(i+45)*.28)));
  this.finish(this.snowPatches,patches.length,this.snow*.84);
  const rippleCount=reduced?0:Math.min(this.groundPoints.length,phone?12:24);
  if(this.rain>.003)for(let i=0;i<rippleCount;i++){
   const p=this.groundPoints[i],size=.07+((t*1.2+i*.36)%1)*.24;
   this.place(this.ripples,i*4,p.x,p.y+.004,p.z-size/2,size,.009,.012);this.place(this.ripples,i*4+1,p.x,p.y+.004,p.z+size/2,size,.009,.012);
   this.place(this.ripples,i*4+2,p.x-size/2,p.y+.004,p.z,.012,.009,size);this.place(this.ripples,i*4+3,p.x+size/2,p.y+.004,p.z,.012,.009,size);
  }this.finish(this.ripples,rippleCount*4,this.rain*.28);
  const starPower=environmentEnabled(s,'env-stars')&&e.enabled.stars!==false?night*(1-this.cloud*.85):0,starCount=phone?48:100;
  if(starPower>.003)for(let i=0;i<starCount;i++){const size=.018+rand(i+54)*.026;this.place(this.stars,i,cx+(rand(i)-.5)*extent*2.4,6+rand(i+119)*5,cz+(rand(i+191)-.5)*extent*2.4,size,size,size);}
  this.finish(this.stars,starCount,starPower*.75);
  const glow=environmentEnabled(s,'env-stars')&&e.enabled.fireflies?night:0;
  if(glow>.003)for(let i=0;i<24;i++){const c=s.chunks.overworld[i%s.chunks.overworld.length];this.place(this.glows,i,c.x*5+(rand(i)-.5)*4+Math.sin(t*.4+i)*.2,.4+rand(i+90)*1.1+Math.sin(t+i)*.1,c.z*5+(rand(i+80)-.5)*4,.035,.035,.035);}
  this.finish(this.glows,24,glow*.8);
  const age=e.clock-e.meteorAt,meteor=!reduced&&environmentEnabled(s,'env-stars')&&e.enabled.meteor&&night>.5&&e.meteorAt>0&&e.clock>0&&age>=0&&age<4;
  if(meteor)for(let i=0;i<8;i++)this.place(this.meteors,i,cx+extent*.6-age*1.8+i*.13,7.2-age*.14,cz-3+age*.6,.07+i*.05,.035,.035,.2,-.3);
  this.finish(this.meteors,meteor?8:0,Math.max(0,Math.sin(age/4*Math.PI))*.8);
  this.windowPoints.slice(0,256).forEach((matrix,i)=>this.windows.setMatrixAt(i,matrix));this.finish(this.windows,Math.min(256,this.windowPoints.length),night*.68);
 }
 dispose(){this.group.removeFromParent();for(const m of this.meshes){m.material.dispose();m.dispose();}this.geometry.dispose();}
}
