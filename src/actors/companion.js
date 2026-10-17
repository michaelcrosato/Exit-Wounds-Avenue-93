import {metresToUnits,unitsToMetres} from '../engine/units.js';
import {setBodyEnabled} from '../engine/body-lifecycle.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const spatialDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const direction=(a,b)=>{const d=Math.max(.001,distance(a,b));return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};

/** Jun uses engine collision and a replan/recovery policy. Story survival is authoritative in GameState. */
export class CompanionActor {
  /** @param {{E:any,world:any,queries?:any,position?:{x:number,y:number,z?:number},footGraph?:any,cover?:any[],onStuck?:(data:any)=>void}} options */
  constructor({E,world,queries=null,position={x:333,y:88,z:0},footGraph=null,cover=[],onStuck=()=>{}}){
    this.world=world;this.queries=queries;this.graph=footGraph;this.cover=cover;this.onStuck=onStuck;
    this.actor=world.hero({x:metresToUnits(position.x),y:metresToUnits(position.y),z:metresToUnits(position.z||0),r:4.1,half:8.8,mass:70,look:'puppet',
      rig:new E.Humanoid({build:'heroic',size:.96,weapon:null,outfit:'shirt',sleeves:'long',hair:'short',colors:{skin:'#c79d7d',hair:'#1c2526',cloth:'#a0a69b',pants:'#3c4546',boot:'#2a2b28',belt:'#46504b'}})});
    this.actor.id='jun';this.actor.data.entityId='jun';
    this.mode='cover';this.vehicleId=null;this.seat=null;this.active=false;this.target=position;this.path=[];this.pathGoalNode=null;this.detour=null;this.detourVehicleId=null;this.replanIn=0;this.stuckFor=0;this.lastProgress=this.position;this.lastSafe=this.position;this.recoveryAttempts=0;this.vaultState=null;
  }
  get position(){return {x:unitsToMetres(this.actor.x),y:unitsToMetres(this.actor.y),z:unitsToMetres(this.actor.z)};}
  activate(){this.active=true;this.mode='follow';this.actor.visible=true;}
  takeCover(threat){
    if(this.vehicleId||!this.active)return;
    const p=this.position;
    const options=this.cover.filter(c=>distance(c,p)<28).sort((a,b)=>distance(a,p)-distance(b,p));
    const safe=options.find(c=>!threat||distance(c,threat)>distance(p,threat));
    if(safe){this.mode='cover';this.target=safe;this.path=this.route(p,safe);this.pathGoalNode=this.nearestNode(safe)?.id||null;}
  }
  follow(){if(this.active&&!this.vehicleId){this.mode='follow';this.path=[];this.pathGoalNode=null;this.detour=null;this.detourVehicleId=null;}}
  board(vehicleId,seat){
    this.cancelVault();
    this.vehicleId=vehicleId;this.seat=seat;this.mode='seated';this.path=[];this.pathGoalNode=null;this.detour=null;this.detourVehicleId=null;this.actor.vx=this.actor.vy=0;this.actor.visible=true;this.actor.setSolid(false);
  }
  exit(position){
    this.vehicleId=null;this.seat=null;this.mode='follow';this.actor.place(metresToUnits(position.x),metresToUnits(position.y),metresToUnits(position.z||0));this.actor.visible=true;this.actor.setSolid(true);this.path=[];this.pathGoalNode=null;this.detour=null;this.detourVehicleId=null;this.lastProgress=this.position;this.stuckFor=0;
  }
  /** @param {number} dt @param {{player?:{x:number,y:number,z?:number},vehicle?:{position:{x:number,y:number,z?:number}}|null,combat?:boolean,visibleToPlayer?:(p:any)=>boolean,validRegroup?:(p:any,target:any)=>any}} options */
  update(dt,{player,vehicle=null,combat=false,visibleToPlayer=()=>true,validRegroup=(_p,_target)=>null}={}){
    const a=this.actor;
    if(this.vaultState){this.updateVault(dt);return;}
    if(!this.active||this.vehicleId){a.vx=a.vy=0;a.anim={pose:'guard'};return;}
    const p=this.position;
    if(a.fell||p.z<-2){a.vx=a.vy=0;this.onStuck({reason:'fall',position:p,retryRequired:true});return;}
    let target=this.mode==='cover'?this.target:vehicle?.position||player;
    if(!target)target=this.target;
    if(this.mode==='follow')this.target=target;
    if(this.mode==='follow'&&Math.abs(p.y-88)<5&&Math.abs(target.y-88)<12&&Math.abs(p.x-400)<7&&Math.abs(target.x-400)>2&&Math.sign(p.x-400)!==Math.sign(target.x-400)){
      const landing=p.x<400?{x:405,y:88,z:0}:{x:396,y:88,z:0};
      if(this.startVault(landing)){this.updateVault(dt);return;}
    }
    const gap=spatialDistance(p,target);
    if(this.mode==='cover'&&gap<1.3){a.vx=a.vy=0;a.anim={crouch:true,pose:'guard'};return;}
    if(this.mode==='follow'&&gap<2.6){a.vx=a.vy=0;a.anim={crouch:combat,stance:'guard'};this.stuckFor=0;return;}
    const goalNode=this.nearestNode(target)?.id||null;
    if(!this.path.length||this.pathGoalNode!==goalNode||this.stuckFor>2){this.path=this.route(p,target);this.pathGoalNode=goalNode;this.stuckFor=0;}
    else this.path[this.path.length-1]=target;
    let next=this.path[0]||target;
    if(spatialDistance(p,next)<1.3&&this.path.length>1){this.path.shift();next=this.path[0];}
    if(this.detour&&distance(p,this.detour)<1.2){this.detour=null;this.detourVehicleId=null;}
    if(this.detour)next=this.detour;
    else if(this.queries){
      const hit=this.queries.raycast({x:p.x,y:p.y,z:p.z+1.15},{x:next.x,y:next.y,z:(next.z||0)+1.15},{ignore:[a]});
      if(hit?.entity?.tune&&hit.distance<distance(p,next)-.45){
        const alternate=this.vehicleDetour(p,next,hit.entity);
        if(alternate){this.detour=alternate;this.detourVehicleId=hit.entity.id;next=alternate;this.lastProgress=p;this.stuckFor=0;}
      }
    }
    const d=direction(p,next),speed=this.mode==='cover'?3.4:gap>9?4.3:3.1;
    a.vx=d.x*metresToUnits(speed);a.vy=d.y*metresToUnits(speed);a.facing=Math.atan2(d.y,d.x);
    a.anim={sprint:speed>4,crouch:combat&&this.mode==='cover',stance:combat?'guard':'ready'};
    if(spatialDistance(p,this.lastProgress)>.65&&spatialDistance(p,next)<spatialDistance(this.lastProgress,next)-.15){this.lastProgress=p;this.lastSafe=p;this.stuckFor=0;}
    else this.stuckFor+=dt;
    if(this.stuckFor>5)this.failOrRegroup(visibleToPlayer,validRegroup,'blocked');
  }
  startVault(to){
    const actor=this.actor,from=this.position;if(!actor.body)return false;
    if(this.queries&&!this.queries.capsuleClear({x:metresToUnits(to.x),y:metresToUnits(to.y),z:metresToUnits(to.z||0)},actor.r,actor.half,{ignore:[actor]}))return false;
    const body=actor.body;setBodyEnabled(body,false);actor.body=null;actor.vx=actor.vy=actor.vz=0;
    this.vaultState={from,to,body,t:0,duration:.85};actor.facing=Math.atan2(to.y-from.y,to.x-from.x);return true;
  }
  updateVault(dt){
    const v=this.vaultState;if(!v)return;v.t=Math.min(v.duration,v.t+dt);
    const u=v.t/v.duration,k=u*u*(3-2*u),a=this.actor;
    a.x=metresToUnits(v.from.x+(v.to.x-v.from.x)*k);a.y=metresToUnits(v.from.y+(v.to.y-v.from.y)*k);a.z=metresToUnits((v.from.z||0)+Math.sin(Math.PI*u)*1.25);a.anim={climb:true,pose:'interact',air:true};
    if(!a.data.animationManaged)a.rig?.update?.(dt,{...a,...a.anim});
    if(u>=1){a.body=v.body;setBodyEnabled(a.body,true);a.place(metresToUnits(v.to.x),metresToUnits(v.to.y),metresToUnits(v.to.z||0));this.vaultState=null;this.stuckFor=0;}
  }
  cancelVault(){const v=this.vaultState;if(!v)return;const a=this.actor;a.body=v.body;setBodyEnabled(a.body,true);a.place(metresToUnits(v.from.x),metresToUnits(v.from.y),metresToUnits(v.from.z||0));this.vaultState=null;}
  /** @param {(p:any)=>boolean} visibleToPlayer @param {(p:any,target:any)=>any} validRegroup @param {string} reason */
  failOrRegroup(visibleToPlayer,validRegroup,reason){
    const p=this.position,proposed=validRegroup(p,this.target);
    if(proposed&&!visibleToPlayer(p)&&!visibleToPlayer(proposed)&&this.recoveryAttempts<2){
      this.actor.place(metresToUnits(proposed.x),metresToUnits(proposed.y),metresToUnits(proposed.z||0));
      this.lastProgress=proposed;this.stuckFor=0;this.recoveryAttempts++;this.mode='follow';return;
    }
    this.recoveryAttempts++;
    this.actor.vx=this.actor.vy=0;this.stuckFor=0;this.onStuck({reason,position:p,retryRequired:this.recoveryAttempts>=2});
  }
  vehicleDetour(from,to,car){
    if(!this.queries)return null;
    const center=car.position,forward={x:Math.cos(car.yaw),y:Math.sin(car.yaw)},side={x:-Math.sin(car.yaw),y:Math.cos(car.yaw)};
    const lateral=(from.x-center.x)*side.x+(from.y-center.y)*side.y,sign=Math.sign(lateral)||1;
    const candidates=[];
    for(const end of [-1,1]){
      const x=center.x+forward.x*end*(car.tune.length/2+1.45)+side.x*sign*(car.tune.width/2+1.05);
      const y=center.y+forward.y*end*(car.tune.length/2+1.45)+side.y*sign*(car.tune.width/2+1.05);
      const floor=this.queries.floorAt(metresToUnits(x),metresToUnits(y),metresToUnits((from.z||0)+2),{ignore:[car]});
      const z=unitsToMetres(floor),candidate={x,y,z};
      if(!this.queries.capsuleClear({x:metresToUnits(x),y:metresToUnits(y),z:floor},this.actor.r,this.actor.half,{ignore:[this.actor]}))continue;
      if(!this.queries.lineOfSight({x:from.x,y:from.y,z:(from.z||0)+1.15},{x,y,z:z+1.15},{ignore:[this.actor],endpointTolerance:.55}))continue;
      candidates.push({point:candidate,cost:distance(from,candidate)+distance(candidate,to)+(this.queries.lineOfSight({x,y,z:z+1.15},{x:to.x,y:to.y,z:(to.z||0)+1.15},{ignore:[this.actor],endpointTolerance:.55})?0:8)});
    }
    candidates.sort((a,b)=>a.cost-b.cost);
    return candidates[0]?.point||null;
  }
  route(from,to){
    const graph=this.graph;if(!graph?.nodes?.length||!graph?.edges?.length)return [to];
    const nodes=graph.nodes,routeDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
    const nearest=p=>{
      // The office has ground and upper nodes with nearly identical X/Y. A
      // ground-floor follower must never select the upstairs landing as its
      // starting node merely because its plan position is horizontally close.
      const elevated=(p.z||0)>1.6,level=nodes.filter(n=>((n.z||0)>1.6)===elevated);
      return level.reduce((best,n)=>routeDistance(n,p)<routeDistance(best,p)?n:best,level[0]||nodes[0]);
    };
    const start=nearest(from),goal=nearest(to),adj=new Map(nodes.map(n=>[n.id,[]]));
    for(const e of graph.edges){const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);if(!a||!b)continue;adj.get(a.id).push({n:b,c:e.cost||routeDistance(a,b)});if(!e.oneWay)adj.get(b.id).push({n:a,c:e.cost||routeDistance(a,b)});}
    const open=new Set([start.id]),score=new Map([[start.id,0]]),prev=new Map();
    while(open.size){let id=[...open].reduce((best,n)=>score.get(n)+routeDistance(nodes.find(x=>x.id===n),goal)<score.get(best)+routeDistance(nodes.find(x=>x.id===best),goal)?n:best);open.delete(id);if(id===goal.id)break;
      for(const {n,c} of adj.get(id)||[]){const next=score.get(id)+c;if(next<(score.get(n.id)??Infinity)){score.set(n.id,next);prev.set(n.id,id);open.add(n.id);}}
    }
    if(!score.has(goal.id))return [to];
    const path=[];let id=goal.id;while(id&&id!==start.id){const n=nodes.find(x=>x.id===id);path.push(n);id=prev.get(id);}path.reverse();path.push(to);return path;
  }
  nearestNode(point){const nodes=this.graph?.nodes;if(!nodes?.length)return null;const elevated=(point.z||0)>1.6,level=nodes.filter(n=>((n.z||0)>1.6)===elevated);return level.reduce((best,n)=>Math.hypot(n.x-point.x,n.y-point.y,(n.z||0)-(point.z||0))<Math.hypot(best.x-point.x,best.y-point.y,(best.z||0)-(point.z||0))?n:best,level[0]||nodes[0]);}
  snapshot(){return {position:this.position,mode:this.mode,active:this.active,vehicleId:this.vehicleId,seat:this.seat,lastSafe:this.lastSafe,recoveryAttempts:this.recoveryAttempts};}
  restore(s){this.cancelVault();this.actor.place(metresToUnits(s.position.x),metresToUnits(s.position.y),metresToUnits(s.position.z||0));this.actor.setSolid(true);this.active=!!s.active;this.mode=s.mode||'cover';this.vehicleId=null;this.seat=null;this.target=s.target||s.position;this.path=[];this.pathGoalNode=null;this.detour=null;this.detourVehicleId=null;this.replanIn=0;this.stuckFor=0;this.lastProgress={x:s.position.x,y:s.position.y,z:s.position.z||0};const safe=s.lastSafe||s.position;this.lastSafe={x:safe.x,y:safe.y,z:safe.z||0};this.recoveryAttempts=s.recoveryAttempts||0;if(s.vehicleId)this.board(s.vehicleId,s.seat);}
}
