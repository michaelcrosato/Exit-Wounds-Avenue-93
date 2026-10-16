import {metresToUnits,unitsToMetres} from '../engine/units.js';
import {findGraphPath,nearestGraphNode} from '../world/roads.js';

/** @type {Array<[string,string,number,number]>} */
const START=[
  ['crew-guard-gate','guard',339,150],['crew-guard-service','guard',391,91],
  ['crew-rusher-1','rusher',366,119],['crew-rusher-2','rusher',331,97],
  ['crew-flanker-1','flanker',313,110],['crew-flanker-2','flanker',382,131]
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const norm=(x,y)=>{const d=Math.max(.001,Math.hypot(x,y));return [x/d,y/d]};

/** Six persistent crew actors with shared perception, role tactics and one four-person pressure cap. */
export class CrewSystem {
  /** @param {{E:any,world:any,queries:any,footGraph?:any,cover?:any[],onShot?:(shot:any)=>void,onDown?:(id:string)=>void,onBark?:(text:string)=>void}} options */
  constructor({E,world,queries,footGraph=null,cover=[],onShot=()=>{},onDown=()=>{},onBark=()=>{}}){
    this.world=world;this.queries=queries;this.footGraph=footGraph;this.cover=cover;this.onShot=onShot;this.onDown=onDown;this.onBark=onBark;
    this.active=false;this.alerted=false;this.sharedLastKnown=null;this.time=0;this.enemies=START.map(([id,role,x,y],index)=>{
      const a=world.mob({x:metresToUnits(x),y:metresToUnits(y),z:0,r:4.7,half:8.7,look:'puppet',mass:1.2,
        rig:new E.Humanoid({build:'heroic',size:role==='rusher'?1.06:1,weapon:'gun',outfit:'shirt',sleeves:'long',hat:index%2?'cap':null,
          colors:{skin:['#a47a63','#d3ad88','#806352'][index%3],hair:'#24272a',cloth:role==='flanker'?'#675a50':'#625e54',pants:'#303033',boot:'#24272a',belt:'#2c2825'}})});
      a.col.setMass(role==='rusher'?88:78);a.mass=role==='rusher'?88:78;
      a.id=id;a.data.entityId=id;queries?.register?.(a.body,a);
      return {id,role,actor:a,health:role==='rusher'?75:65,state:'holding',lastKnown:null,shotAt:0,thinkAt:index*.12,spotAccum:0,stuck:0,lastPosition:{x,y},coverId:null,visible:false,pressure:false,bark:false,path:[],nextPath:0,lastPathTarget:null};
    });
  }
  get living(){return this.enemies.filter(e=>e.health>0);}
  start({route='gate',position=null}={}){this.active=true;this.alerted=route==='gate';this.sharedLastKnown=this.alerted&&position?{...position}:null;for(const e of this.enemies){e.state=this.alerted?'alert':'holding';e.lastKnown=this.sharedLastKnown&&{...this.sharedLastKnown};e.spotAccum=0;}if(this.alerted)this.onBark('They are in the yard!');}
  alert(position){const newlyAlerted=!this.alerted;this.alerted=true;this.sharedLastKnown={...position};for(const e of this.living){e.lastKnown={...position};if(e.state==='holding')e.state='investigate';}if(newlyAlerted)this.onBark('They saw us!');}
  handleHit(id,damage,from){
    const e=this.enemies.find(x=>x.id===id);if(!e||e.health<=0)return {ok:false,reason:'enemy-unavailable'};
    e.health=Math.max(0,e.health-damage);e.actor.flash=.22;
    if(from)e.actor.push((e.actor.x-metresToUnits(from.x))*.8,(e.actor.y-metresToUnits(from.y))*.8,damage>35?metresToUnits(1):0);
    if(e.health===0){e.state='down';e.actor.anim={pose:'die'};e.actor.setSolid(false);e.actor.vx=e.actor.vy=0;this.onDown(e.id);}
    else{e.state='suppressed';e.shotAt=this.time+.7;this.alert(from||this.positionOf(e));}
    return {ok:true,down:e.health===0};
  }
  positionOf(e){return {x:unitsToMetres(e.actor.x),y:unitsToMetres(e.actor.y),z:unitsToMetres(e.actor.z)};}
  /** @param {number} dt @param {{player?:{x:number,y:number,z?:number},phase?:string,noise?:boolean}} options */
  update(dt,{player,phase,noise=false}={}){
    this.time+=dt;
    if(!this.active||!['RECOVERY','EXTRACTION','EVASION'].includes(phase))return;
    const alive=this.living;
    const positioned=alive.map(e=>({e,d:dist(this.positionOf(e),player)})).sort((a,b)=>a.d-b.d);
    const pressure=new Set(positioned.slice(0,4).map(x=>x.e.id));
    for(const e of alive){
      const p=this.positionOf(e),a=e.actor,d=dist(p,player);
      e.pressure=pressure.has(e.id);
      if(this.time>=e.thinkAt){
        e.visible=d<45&&(this.queries?.lineOfSight?.({x:p.x,y:p.y,z:p.z+1.55},{x:player.x,y:player.y,z:player.z+1.35},{ignore:[e.actor]})??true);
        if(e.visible){e.spotAccum+=.12;if(this.alerted||e.spotAccum>=1.2)this.alert(player);}
        else e.spotAccum=0;
        e.thinkAt=this.time+.12+(e.role==='flanker'?.07:0);
      }
      if(noise&&d<55)this.alert(player);
      if(!this.alerted){a.vx=a.vy=0;a.anim={pose:'guard'};continue;}
      let target=e.lastKnown||this.sharedLastKnown;
      if(!target){a.vx=a.vy=0;a.anim={pose:'guard'};continue;}
      if(e.role==='guard'){
        const found=this.cover.find(c=>c.id===e.coverId)||this.cover.filter(c=>dist(c,p)<20).sort((x,y)=>dist(x,p)-dist(y,p))[0];
        if(found){e.coverId=found.id;if(!e.visible||d<9)target=found;}
      }else if(e.role==='flanker'&&e.visible){
        const sign=e.id==='crew-flanker-1'?1:-1,dx=player.x-p.x,dy=player.y-p.y;
        target={x:player.x-dx*.3-dy/Math.max(d,1)*9*sign,y:player.y-dy*.3+dx/Math.max(d,1)*9*sign,z:player.z};
      }
      if(e.state==='suppressed'&&this.time<e.shotAt){a.vx=a.vy=0;a.anim={crouch:true,hurt:true,stance:'guard'};continue;}
      const desired=e.role==='rusher'?6:e.role==='flanker'?9:13;
      const tdist=dist(p,target);
      const move=e.pressure&&(!e.visible||d>desired+2||tdist>4);
      if(move){
        let waypoint=target;
        if(this.footGraph&&!(this.queries?.lineOfSight?.({x:p.x,y:p.y,z:p.z+1.3},{x:target.x,y:target.y,z:(target.z||0)+1.3},{ignore:[a],endpointTolerance:1})??false)){
          if(!e.path.length||!e.lastPathTarget||dist(e.lastPathTarget,target)>5){
            const start=nearestGraphNode(this.footGraph,p),goal=nearestGraphNode(this.footGraph,target);
            e.path=start&&goal?findGraphPath(this.footGraph,start.id,goal.id).slice(1):[];
            e.nextPath=this.time+.6;e.lastPathTarget={...target};
          }
          while(e.path.length&&dist(e.path[0],p)<1.6)e.path.shift();
          waypoint=e.path[0]||target;
        }
        const [nx,ny]=norm(waypoint.x-p.x,waypoint.y-p.y),speed=e.role==='rusher'?3.8:2.8;
        a.vx=nx*metresToUnits(speed);a.vy=ny*metresToUnits(speed);a.facing=Math.atan2(ny,nx);
      }else{a.vx*=.6;a.vy*=.6;if(e.visible)a.facing=Math.atan2(player.y-p.y,player.x-p.x);}
      const canFire=e.pressure&&e.visible&&d<35&&d>2&&this.time>=e.shotAt;
      if(canFire){e.shotAt=this.time+(e.role==='rusher'?.48:e.role==='guard'?1.18:.82);this.onShot({source:e.id,role:e.role,position:{x:p.x,y:p.y,z:p.z+1.45},target:{x:player.x,y:player.y,z:player.z+1.2},accuracy:e.role==='guard'?.62:.48});}
      a.anim={point:e.visible,aim:0,stance:'ready',crouch:e.role==='guard'&&!!e.coverId&&d<14};
      const progress=dist(p,e.lastPosition);if(move&&progress<.09)e.stuck+=dt;else{e.stuck=0;e.lastPosition=p;}
      if(e.stuck>2){e.coverId=null;e.path=[];e.nextPath=0;e.stuck=0;}
    }
  }
  snapshot(){return this.enemies.map(e=>({id:e.id,position:this.positionOf(e),health:e.health,state:e.state,lastKnown:e.lastKnown}));}
  restore(items=[]){this.time=0;for(const [index,s] of items.entries()){const e=this.enemies.find(x=>x.id===s.id);if(!e)continue;e.actor.place(metresToUnits(s.position.x),metresToUnits(s.position.y),metresToUnits(s.position.z||0));e.health=s.health;e.state=s.state;e.lastKnown=s.lastKnown;e.shotAt=.6+index*.08;e.thinkAt=index*.12;e.spotAccum=0;e.stuck=0;e.lastPosition={...s.position};e.coverId=null;e.visible=false;e.pressure=false;e.bark=false;e.path=[];e.nextPath=0;e.lastPathTarget=null;e.actor.vx=e.actor.vy=0;e.actor.anim=e.health>0?{}:{pose:'die'};e.actor.setSolid(e.health>0);e.actor.flash=0;}}
}
