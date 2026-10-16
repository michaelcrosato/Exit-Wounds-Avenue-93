import {metresToUnits} from '../engine/units.js';

/** Persistent, visually distinct contacts at the two service hubs. */
export function createContacts(E,world){
  const specs=[
    {id:'eli',x:106,y:307,facing:Math.PI,colors:{skin:'#a98467',hair:'#2e3334',cloth:'#846e51',pants:'#333c3a',boot:'#272a29',belt:'#4a3c32'},hat:'cap',outfit:'jacket'},
    {id:'bea',x:113,y:216,facing:Math.PI/2,colors:{skin:'#ae775c',hair:'#161d21',cloth:'#8b5149',pants:'#34363a',boot:'#222325',belt:'#422c2a'},hat:null,outfit:'shirt'}
  ];
  return specs.map(s=>{
    const actor=world.hero({x:metresToUnits(s.x),y:metresToUnits(s.y),z:0,r:4.2,half:8.8,mass:75,facing:s.facing,look:'puppet',
      rig:new E.Humanoid({build:'heroic',size:1,weapon:null,hat:s.hat,outfit:s.outfit,sleeves:'long',colors:s.colors})});
    actor.id=s.id;actor.data.entityId=s.id;actor.anim={pose:'hips'};
    return actor;
  });
}
