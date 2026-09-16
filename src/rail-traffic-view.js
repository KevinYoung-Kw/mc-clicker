import { box, group } from './models.js';
import { upgradeLevel } from './upgrades.js';
import { RailTraffic } from './rail-traffic.js';

export function createRailTrafficView(parent, paths, state, animations) {
  const traffic=new RailTraffic(paths,{
    wagons:upgradeLevel(state,'rail-wagons'),
    dispatch:upgradeLevel(state,'rail-dispatch'),
  });
  const views=traffic.trains.map(train=>({train,cars:Array.from({length:train.cars},(_,i)=>{
    const cart=group(parent);cart.name='freight-minecart';
    Object.assign(cart.userData,{dynamic:true,railCar:true,edge:train.id,carIndex:i});
    cart.visible=false;
    box(cart,'#596760',0,.035,0,.34,.11,.36);
    for(const x of [-.155,.155]) box(cart,'#89948b',x,.13,0,.035,.17,.36);
    for(const z of [-.165,.165]) box(cart,'#758379',0,.13,z,.28,.17,.035);
    for(const x of [-.105,.105]) for(const z of [-.115,.115])
      box(cart,'#343e3b',x,-.055,z,.075,.075,.075);
    box(cart,state.counts.E6?'#ab96b3':'#b8a577',0,.18,0,.2,.2,.22);
    return cart;
  })}));
  animations.push(()=>{
    traffic.update(state.play,state.transport?.edges);
    for(const {train,cars} of views) traffic.poses(train).forEach((pose,i)=>{
      const cart=cars[i];cart.visible=pose.visible;
      if(!pose.visible) return;
      cart.position.set(pose.x,.32,pose.z);cart.rotation.y=pose.heading;
      cart.scale.setScalar(pose.scale);
    });
  });
  return traffic;
}
