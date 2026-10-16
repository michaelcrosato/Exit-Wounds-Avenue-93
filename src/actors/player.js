import {metresToUnits, unitsToMetres} from '../engine/units.js';

const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
const approach = (n,target,delta) => n < target ? Math.min(target,n+delta) : Math.max(target,n-delta);
const down = (frame,key) => frame?.held?.has(key) || frame?.down?.(key) || false;
const pressed = (frame,key) => frame?.pressed?.has(key) || frame?.wasPressed?.(key) || false;

/** Engine-owned kinematic actor with metre-facing controls and no independent physics step. */
export class PlayerActor {
  constructor({E,world,position={x:94,y:306,z:0}}) {
    this.E=E;this.world=world;
    this.actor=world.hero({
      x:metresToUnits(position.x),y:metresToUnits(position.y),z:metresToUnits(position.z||0),
      r:4.3,half:9.1,mass:80,look:'puppet',snap:4,step:4,
      rig:new E.Humanoid({build:'heroic',size:1.02,weapon:'gun',outfit:'shirt',sleeves:'long',hair:'short',
        colors:{skin:'#b68265',hair:'#20262a',cloth:'#526568',clothDk:'#293e44',pants:'#202a31',boot:'#171e20',belt:'#444b4a',metal:'#283b42',hilt:'#20262a'}})
    });
    this.actor.id='mara';this.actor.data.entityId='mara';
    this.actor.facing=-Math.PI/2;
    this.crouched=false;this.inCover=false;this.coverSide=0;this.aiming=false;
    this.weapon='pistol';this.seatedIn=null;this.transition=0;this.vault=0;this.damageFlash=0;
    this.lastSafe={...position};
  }
  get position(){return {x:unitsToMetres(this.actor.x),y:unitsToMetres(this.actor.y),z:unitsToMetres(this.actor.z)};}
  place(position){this.actor.place(metresToUnits(position.x),metresToUnits(position.y),metresToUnits(position.z||0));this.lastSafe={...position};}
  setVehicle(vehicleId){this.seatedIn=vehicleId||null;this.actor.visible=true;this.actor.setSolid(!vehicleId);}
  setWeapon(name){this.weapon=name;this.actor.rig.o.weapon=name==='unarmed'?null:'gun';}
  update(frame,dt,opts={}) {
    const a=this.actor;
    this.damageFlash=Math.max(0,this.damageFlash-dt);
    if(this.seatedIn){a.vx=a.vy=0;a.anim={pose:'guard'};return;}
    if(pressed(frame,'crouch'))this.crouched=!this.crouched;
    this.aiming=down(frame,'aim');
    if(pressed(frame,'jump')||pressed(frame,'vault')){
      if(a.grounded){a.jump(metresToUnits(this.inCover?3.6:4.1));this.vault=.35;this.inCover=false;}
    }
    this.vault=Math.max(0,this.vault-dt);
    const move=[Number(frame?.moveX||0),Number(frame?.moveY||0)];
    const cameraGround=opts.camera?.ground?.(frame);
    const ground=cameraGround ? [cameraGround.x,cameraGround.y] : this.world.camera?.ground?.(move,[])||move;
    const length=Math.hypot(ground[0]||0,ground[1]||0);
    const nx=length>1?ground[0]/length:ground[0]||0,ny=length>1?ground[1]/length:ground[1]||0;
    const sprint=down(frame,'sprint')&&!this.crouched&&!this.aiming&&!this.inCover;
    const speed=this.inCover?1.25:this.crouched?1.45:this.aiming?1.85:sprint?5.15:length>.5?3.05:2.3;
    const acceleration=metresToUnits(a.grounded?13:5)*dt;
    a.vx=approach(a.vx,nx*metresToUnits(speed),acceleration);
    a.vy=approach(a.vy,ny*metresToUnits(speed),acceleration);
    if(length>.16&&!this.aiming) a.facing=approachAngle(a.facing,Math.atan2(ny,nx),dt*(this.inCover?6:10));
    else if(this.aiming&&Number.isFinite(opts.aimYaw))a.facing=approachAngle(a.facing,opts.aimYaw,dt*12);
    a.anim={crouch:this.crouched,sprint,dash:this.vault>0,point:this.aiming,aim:opts.aimPitch||0,stance:this.inCover?'guard':'ready',hurt:this.damageFlash>0};
    if(a.grounded&&!a.fell){const p=this.position;if(p.x>=22&&p.x<=456&&p.y>=24&&p.y<=396)this.lastSafe=p;}
  }
  hurt(){this.damageFlash=.25;this.actor.flash=.25;}
  recover(){this.place(this.lastSafe);this.inCover=false;this.vault=0;}
  snapshot(){return {position:this.position,facing:this.actor.facing,crouched:this.crouched,inCover:this.inCover,weapon:this.weapon,seatedIn:this.seatedIn};}
  restore(s){this.place(s.position);this.actor.facing=s.facing||0;this.crouched=!!s.crouched;this.inCover=!!s.inCover;this.setWeapon(s.weapon||'pistol');this.setVehicle(s.seatedIn||null);}
}

function approachAngle(a,b,k){let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+clamp(d,-k,k);}
