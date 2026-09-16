import { railPoint } from './rail-path.js';

// A bounded presentation of real shipments. The production network and its
// capacity/distance counters are never modified by visual traffic reservations.
export const WAGON_GAP = 0.58;
export const TRAIN_LIMIT = 6;
export const CARRIAGE_LIMIT = 12;
const CLEARANCE = 0.54;
const sample = path => {
  const count = Math.max(1, Math.ceil(path.length / 0.18));
  return Array.from({length:count+1},(_,i)=>railPoint(path,path.length*i/count));
};
export class RailTraffic {
  constructor(paths, {wagons=0, dispatch=0}={}) {
    this.trains = [...paths].filter(([,path])=>path.length>=1).map(([id,path])=>({
      id,path,cars:1+Math.min(2,wagons,Math.max(0,Math.floor((path.length-1.2)/WAGON_GAP))),
      distance:0,active:false,pending:false,lastTotal:0,lastStarted:-Infinity,readyAt:0,
      conflicts:new Set(),
    }));
    this.speed = .85 + Math.min(3,dispatch)*.1;
    for(const train of this.trains) {
      // A tight U-turn can bring distant points on the same rail very close.
      // Use a single carriage there instead of folding trailers into the head.
      for(let gap=1;gap<train.cars;gap++) for(let d=gap*WAGON_GAP;d<train.path.length;d+=.08) {
        const a=railPoint(train.path,d),b=railPoint(train.path,d-gap*WAGON_GAP);
        if(Math.hypot(a.x-b.x,a.z-b.z)<.44){train.cars=1;break;}
      }
    }
    const samples = this.trains.map(t=>sample(t.path));
    for(let i=0;i<this.trains.length;i++) for(let j=i+1;j<this.trains.length;j++) {
      if(samples[i].some(a=>samples[j].some(b=>Math.hypot(a.x-b.x,a.z-b.z)<CLEARANCE))) {
        this.trains[i].conflicts.add(this.trains[j].id);
        this.trains[j].conflicts.add(this.trains[i].id);
      }
    }
  }
  update(play, flows={}) {
    const dt = this.lastPlay===undefined ? 0 : Math.max(0,Math.min(.1,play-this.lastPlay));
    this.lastPlay=play;
    for(const train of this.trains) {
      const flow=flows[train.id];
      if(flow?.total>train.lastTotal && flow.quantity>0 && Math.abs(play-flow.at)<1.1) train.pending=true;
      train.lastTotal=flow?.total||0;
      if(!train.active) continue;
      train.distance+=dt*this.speed;
      if(train.distance>train.path.length+(train.cars-1)*WAGON_GAP+.25) {
        train.active=false;train.readyAt=play+.45;
      }
    }
    const active=this.trains.filter(t=>t.active);
    let cars=active.reduce((n,t)=>n+t.cars,0);
    for(const train of this.trains.filter(t=>t.pending&&!t.active&&play>=t.readyAt).sort((a,b)=>a.lastStarted-b.lastStarted||a.id.localeCompare(b.id))) {
      if(active.length>=TRAIN_LIMIT || cars+train.cars>CARRIAGE_LIMIT) break;
      // Reserve shared/nearby tracks before leaving the station. Trains wait
      // offstage, rather than piling up or stopping nose-to-nose at a crossing.
      if(active.some(t=>train.conflicts.has(t.id))) continue;
      train.active=true;train.pending=false;train.distance=0;train.lastStarted=play;
      active.push(train);cars+=train.cars;
    }
  }
  poses(train) {
    return Array.from({length:train.cars},(_,i)=>{
      const distance=train.distance-i*WAGON_GAP;
      return {...railPoint(train.path,distance),distance,
        visible:train.active&&distance>=0&&distance<=train.path.length,
        scale:Math.max(0,Math.min(1,(distance+.08)/.28,(train.path.length-distance+.08)/.28))};
    });
  }
}
