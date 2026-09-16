import * as T from 'three';

// Four open, square faces: a column of light, not a lit opaque pole or a cone.
const geometry=new T.BufferGeometry();
const positions=[],uvs=[];
for(const [a,b] of [[[-.5,-.5],[.5,-.5]],[[.5,-.5],[.5,.5]],[[.5,.5],[-.5,.5]],[[-.5,.5],[-.5,-.5]]]) {
  for(const [p,y,u] of [[a,0,0],[b,0,1],[b,1,1],[a,0,0],[b,1,1],[a,1,0]]) {
    positions.push(p[0],y,p[1]);uvs.push(u,y);
  }
}
geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
const data=new Uint8Array(4*64*4);
for(let y=0;y<64;y++) for(let x=0;x<4;x++) {
  const i=(y*4+x)*4,t=y/63;
  data[i]=data[i+1]=data[i+2]=255;
  data[i+3]=Math.round(255*Math.min(1,(1-t)/.38));
}
const fade=new T.DataTexture(data,4,64);
fade.magFilter=fade.minFilter=T.NearestFilter;fade.needsUpdate=true;
const materials=[['#effffc',.8],['#b2f1e8',.18],['#a2e5df',.045]].map(([color,opacity])=>new T.MeshBasicMaterial({
  color,opacity,map:fade,transparent:true,depthWrite:false,depthTest:true,
  blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,
}));
export function beaconLight(parent, animations=[]) {
  const beam=new T.Group();beam.name='beacon-light-column';beam.position.y=.72;
  beam.userData.power=1;beam.userData.dynamic=true;parent.add(beam);
  for(const [i,width] of [.13,.34,.52].entries()) {
    const mesh=new T.Mesh(geometry,materials[i].clone());
    mesh.name=i===0?'beacon-beam':'beacon-halo';
    mesh.userData.facilityPart=mesh.name;mesh.userData.nonSolid=true;
    mesh.userData.ignorePick=true;mesh.raycast=()=>{};
    mesh.scale.set(width,8.5,width);mesh.castShadow=mesh.receiveShadow=false;
    beam.add(mesh);
  }
  let power=1;
  animations.push(t=>{
    power+=(Math.max(0,Math.min(1,beam.userData.power))-power)*.16;
    beam.visible=power>.015;
    const pulse=1+Math.sin(t*1.4)*.018;
    beam.scale.set(pulse*Math.sqrt(power),.35+.65*power,pulse*Math.sqrt(power));
  });
  return beam;
}

export const BEACON_COLORS={overworld:'#8de7a2',nether:'#ff9369',end:'#c391ff'};
export function setBeaconRealm(beam,realm){
 if(!beam || beam.userData.realm===realm)return;
 beam.userData.realm=realm;
 const color=new T.Color(BEACON_COLORS[realm]||BEACON_COLORS.overworld);
 beam.children.forEach((mesh,i)=>mesh.material.color.copy(color).lerp(new T.Color('#ffffff'),i===0?.45:0));
}
