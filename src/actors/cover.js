import {m} from '../engine/units.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Physical cover ties the actor to an authored obstacle face; gunshots still use real muzzle rays. */
export class CoverController {
  /** @param {{covers:any[],queries:any,onMessage?:(message:string)=>void}} options */
  constructor({covers,queries,onMessage=()=>{}}){this.covers=covers;this.queries=queries;this.onMessage=onMessage;this.active=null;this.position=null;this.peekSide=0;this.canFire=true;}
  nearest(point,maxDistance=1.7){
    let choice=null,best=maxDistance;
    for(const cover of this.covers)for(const position of cover.positions||[]){const d=distance(point,position);if(d<best){choice=cover;best=d;this.nearestPosition=position;}}
    return choice;
  }
  toggle(player){
    if(this.active){this.leave(player);return {ok:true,entered:false};}
    const cover=this.nearest(player.position);
    if(!cover){this.onMessage('Move close to a barrier to use cover.');return {ok:false,reason:'no-cover'};}
    const pos=this.nearestPosition;
    if(!this.queries.capsuleClear({x:m(pos.x),y:m(pos.y),z:m(pos.z||0)},player.actor.r,player.actor.half,{ignore:[player.actor,cover.obstacle?.body]})){
      this.onMessage('The cover position is blocked.');return {ok:false,reason:'blocked'};
    }
    this.active=cover;this.position=pos;this.peekSide=0;player.inCover=true;
    player.actor.place(m(pos.x),m(pos.y),m(pos.z||0));
    player.actor.facing=Math.atan2(-cover.normalY,-cover.normalX);
    return {ok:true,entered:true};
  }
  leave(player){this.active=null;this.position=null;this.peekSide=0;this.canFire=true;player.inCover=false;player.actor.anim={...(player.actor.anim||{}),crouch:player.crouched};}
  update(player,frame){
    const cover=this.active;if(!cover)return;
    const actor=player.actor,p=player.position,t=cover.tangent||{x:Math.cos(cover.yaw),y:Math.sin(cover.y)};
    const along=(p.x-cover.x)*t.x+(p.y-cover.y)*t.y;
    const max=Math.max(.2,cover.w/2-.45);
    const v=actor.vx*t.x+actor.vy*t.y;
    const out=along>max&&v>0||along< -max&&v<0;
    actor.vx=out?0:v*t.x;actor.vy=out?0:v*t.y;
    const aim=frame.held.has('aim');
    const headroom=!cover.low||this.queries.capsuleClear({x:actor.x,y:actor.y,z:actor.z},actor.r,actor.half,{ignore:[actor,cover.obstacle?.body]});
    const effectiveAim=aim&&headroom;
    this.canFire=effectiveAim;
    this.peekSide=effectiveAim&&Math.abs(along)>=max-.5?(along>0?1:-1):0;
    actor.anim={...(actor.anim||{}),crouch:cover.low&&!effectiveAim||player.crouched,point:effectiveAim,stance:'guard'};
    // A low barrier is crossed by the existing contextual vault, which leaves cover first.
    if(frame.pressed.has('jump')||frame.pressed.has('vault'))this.leave(player);
  }
  snapshot(){return {coverId:this.active?.id||null,position:this.position,peekSide:this.peekSide};}
  restore(snapshot,player){this.leave(player);if(!snapshot?.coverId)return;const c=this.covers.find(value=>value.id===snapshot.coverId);if(c){this.active=c;this.position=snapshot.position;this.peekSide=snapshot.peekSide||0;player.inCover=true;}}
}
