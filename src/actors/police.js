import {metresToUnits,unitsToMetres} from '../engine/units.js';
import {findGraphPath,nearestGraphNode} from '../world/roads.js';

const POSTS=[
  {x:64,y:65},{x:56,y:69},{x:239,y:326},{x:246,y:329},{x:416,y:244},{x:408,y:245}
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Local officers search reported positions and only identify Mara from actual observations. */
export class PoliceActors {
  /** @param {{E:any,world:any,queries:any,wanted:any,footGraph?:any,vehicles?:any,onShot?:(shot:any)=>void,onArrest?:()=>void,onNotice?:(text:string)=>void}} options */
  constructor({E,world,queries,wanted,footGraph=null,vehicles=null,onShot=()=>{},onArrest=()=>{},onNotice=()=>{}}){
    this.world=world;this.queries=queries;this.wanted=wanted;this.footGraph=footGraph;this.vehicles=vehicles;this.onShot=onShot;this.onArrest=onArrest;this.onNotice=onNotice;
    this.time=0;this.safeSurrender=false;this.officers=POSTS.map((p,i)=>{
      const a=world.mob({x:metresToUnits(p.x),y:metresToUnits(p.y),z:0,r:4.7,half:9,look:'puppet',mass:1.2,
        rig:new E.Humanoid({build:'heroic',size:1.02,weapon:'gun',outfit:'shirt',sleeves:'long',hat:'cap',colors:{skin:i%2?'#c19a7a':'#8b6958',hair:'#20282c',cloth:'#253c49',pants:'#1c2d37',boot:'#111c22',belt:'#161e26',metal:'#a7b1b4'}})});
      a.col.setMass(86);a.mass=86;
      a.id=`officer-${i+1}`;a.data.entityId=a.id;queries?.register?.(a.body,a);
      return {id:`officer-${i+1}`,actor:a,post:p,mode:'patrol',health:100,nextShot:0,arrestTime:0,lookAt:0,lastProgress:p,stuck:0,nextPath:0,path:[],lastPathTarget:null};
    });
  }
  position(o){return {x:unitsToMetres(o.actor.x),y:unitsToMetres(o.actor.y),z:unitsToMetres(o.actor.z)};}
  /** A known suspect entering a car stays identifiable when an active officer can see the door. */
  seesVehicleEntry(player,vehicle){
    const tier=this.wanted.state.wanted.tier,limit=tier===1?2:tier===2?4:tier===3?6:0;
    return this.officers.slice(0,limit).some(o=>{
      if(o.health<=0)return false;
      const p=this.position(o);
      if(dist(p,player)>=45)return false;
      return this.queries?.lineOfSight?.(
        {x:p.x,y:p.y,z:p.z+1.65},
        {x:player.x,y:player.y,z:(player.z||0)+1.45},
        {ignore:[o.actor,vehicle],targetId:'mara'}
      )??true;
    });
  }
  handleHit(id,damage){
    const o=this.officers.find(value=>value.id===id);if(!o||o.health<=0)return {ok:false,reason:'officer-unavailable'};
    o.health=Math.max(0,o.health-damage);o.actor.flash=.22;
    if(!o.health){o.mode='down';o.actor.vx=o.actor.vy=0;o.actor.anim={pose:'die'};o.actor.setSolid(false);}
    return {ok:true,down:o.health===0};
  }
  /** @param {number} dt @param {{player?:{x:number,y:number,z?:number},vehicleId?:string|null,mission?:any,playerThreatening?:boolean}} options */
  update(dt,{player,vehicleId=null,mission,playerThreatening=false}={}){
    this.time+=dt;
    const w=this.wanted.state.wanted,tier=w.tier,limit=tier===1?2:tier===2?4:tier===3?6:0;
    let saw=false,nearSurrender=false;
    for(let i=0;i<this.officers.length;i++){
      const o=this.officers[i],a=o.actor,p=this.position(o),active=i<limit;
      if(o.health<=0){a.vx=a.vy=0;a.anim={pose:'die'};continue;}
      const seated=this.vehicles?.occupant?.(a);
      const suspectPos=w.lastKnown||player,objective=active?suspectPos:o.post,range=dist(p,player);
      let visible=false;
      if(active&&range<45) visible=this.queries?.lineOfSight?.({x:p.x,y:p.y,z:p.z+1.65},{x:player.x,y:player.y,z:player.z+1.45},{ignore:[a],targetId:vehicleId||'mara'})??true;
      if(visible){
        const seenOnFoot=!vehicleId;
        const hasEvidence=!!(seenOnFoot&&mission?.caseRecovered&&['EXTRACTION','EVASION'].includes(mission.phase)&&dist(player,{x:348,y:124})<22);
        const identified=!!(seenOnFoot&&w.personId==='mara'||vehicleId&&w.vehicleIds.includes(vehicleId));
        if(identified||hasEvidence){
          this.wanted.sight({position:player,personId:seenOnFoot?'mara':null,vehicleId,confirmedSuspect:hasEvidence});
          saw=true;o.mode='chase';
        }else o.mode='investigate';
      }else if(active)o.mode='search';
      else o.mode='patrol';
      const perimeterRadius=i<2?0:i<4?7:10,angle=i*Math.PI/3;
      const destination=o.mode==='chase'&&perimeterRadius?{x:player.x+Math.cos(angle)*perimeterRadius,y:player.y+Math.sin(angle)*perimeterRadius,z:player.z}:o.mode==='chase'?player:objective;
      const gap=dist(p,destination);
      if(seated){
        a.vx=a.vy=0;a.anim={pose:'sit',point:false};
        if(active&&gap<18&&Math.abs(seated.vehicle.speed)<metresToUnits(2))this.vehicles.exit(a);
        continue;
      }
      let waypoint=destination;
      if(active&&this.footGraph&&gap>3){
        if(!o.path.length||!o.lastPathTarget||dist(o.lastPathTarget,destination)>6){
          const start=nearestGraphNode(this.footGraph,p),goal=nearestGraphNode(this.footGraph,destination);
          o.path=start&&goal?findGraphPath(this.footGraph,start.id,goal.id).slice(1):[];
          o.nextPath=this.time+.6;o.lastPathTarget={...destination};
        }
        while(o.path.length&&dist(o.path[0],p)<2)o.path.shift();
        if(o.path.length){const next=o.path[0];
          const direct=this.queries?.lineOfSight?.({x:p.x,y:p.y,z:p.z+1.3},{x:destination.x,y:destination.y,z:(destination.z||0)+1.3},{ignore:[a],endpointTolerance:1})??false;
          waypoint=direct?destination:next;
        }
      }
      if(gap>2.3){const nx=(destination.x-p.x)/gap,ny=(destination.y-p.y)/gap;
        const routeGap=Math.max(.01,dist(p,waypoint));
        const routeX=(waypoint.x-p.x)/routeGap,routeY=(waypoint.y-p.y)/routeGap;
        const speed=o.mode==='chase'?4.0:o.mode==='search'?2.5:1.3;
        a.vx=routeX*metresToUnits(speed);a.vy=routeY*metresToUnits(speed);a.facing=Math.atan2(routeY,routeX);
      }else{a.vx*=.75;a.vy*=.75;if(visible)a.facing=Math.atan2(player.y-p.y,player.x-p.x);}
      if(o.mode==='chase'&&range<4&&!vehicleId){
        if(tier===1&&!playerThreatening)nearSurrender=true;
        o.arrestTime+=dt;
        if(o.arrestTime>=1.2&&!playerThreatening){o.arrestTime=0;this.onArrest();}
      }else o.arrestTime=0;
      if(o.mode==='chase'&&tier>=2&&playerThreatening&&range<26&&visible&&this.time>=o.nextShot){
        o.nextShot=this.time+.9+i*.07;
        this.onShot({source:o.id,role:'police',position:{x:p.x,y:p.y,z:p.z+1.5},target:{x:player.x,y:player.y,z:player.z+1.3},accuracy:.5});
      }
      a.anim={point:o.mode==='chase',stance:'ready'};
      const progress=dist(p,o.lastProgress);if(active&&gap>3&&progress<.07)o.stuck+=dt;else{o.stuck=0;o.lastProgress=p;}
      if(o.stuck>3){o.path=[];o.nextPath=0;o.stuck=0;this.onNotice('Police are taking another route.');}
    }
    this.safeSurrender=nearSurrender;
    if(tier&&w.visible&&!saw)this.wanted.loseSight();
  }
  snapshot(){return this.officers.map(o=>({id:o.id,position:this.position(o),mode:o.mode,health:o.health}));}
  restore(items=[]){this.time=0;this.safeSurrender=false;for(const [index,s] of items.entries()){const o=this.officers.find(x=>x.id===s.id);if(!o)continue;o.actor.place(metresToUnits(s.position.x),metresToUnits(s.position.y),metresToUnits(s.position.z||0));o.mode=s.mode;o.health=s.health??100;o.nextShot=.6+index*.08;o.arrestTime=0;o.lookAt=0;o.lastProgress={...s.position};o.stuck=0;o.nextPath=0;o.path=[];o.lastPathTarget=null;o.actor.vx=o.actor.vy=0;o.actor.anim=o.health>0?{}:{pose:'die'};o.actor.flash=0;o.actor.setSolid(o.health>0);}}
}
