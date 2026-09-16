import * as T from 'three';
import { eggById } from './easter-eggs.js';
// Detached from terrain caches: never participates in collisions or auto collection.
export class EasterEggWorld {
  constructor(scene){this.root=new T.Group();scene.add(this.root);this.key='';this.targets=[];}
  clear(){for(const c of [...this.root.children]){c.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.root.remove(c);}this.targets=[];}
  sync(s,view,interior){
    const entries=Object.entries(s.easterEggs?.entries||{}).filter(([id,e])=>eggById(id)&&e.status==='seeking'&&e.point?.realm===view&&!interior);
    const key=JSON.stringify(entries.map(([id,e])=>[id,e.point]));if(key===this.key)return;this.key=key;this.clear();
    for(const [id,e] of entries){
      const g=new T.Group();g.position.set(e.point.x,.17,e.point.z);g.userData={action:'easter-egg',eggId:id};this.root.add(g);
      const box=(color,x,y,z,w,h,d)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);};
      for(const part of eggById(id).boxes)box(...part);
      // Forgiving transparent hit volume, while still depth-tested against world objects.
      const hit=new T.Mesh(new T.BoxGeometry(.66,.5,.66),new T.MeshBasicMaterial({visible:false}));hit.position.y=.25;g.add(hit);
      this.targets.push(g);
    }
  }
  dispose(){this.clear();this.root.removeFromParent();}
}
