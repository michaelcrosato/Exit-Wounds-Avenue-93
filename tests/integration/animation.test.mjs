import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { chooseAnimationState } from '../../src/actors/animation.js';
let server,browser,page;
const origin='http://127.0.0.1:5188';
before(async()=>{
  server=spawn(process.execPath,['tools/serve.mjs','--port','5188'],{stdio:'pipe'});
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/tests/integration/engine-harness.html')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();await page.goto(origin+'/tests/integration/engine-harness.html');await page.waitForFunction(()=>!!window.engineTest);
});
after(async()=>{await browser?.close();server?.kill();});

test('animation priorities preserve exclusive death, seats, vault and lower-body intent',()=>{
  const actor={grounded:true,vx:48,vy:0,anim:{point:true}};
  assert.equal(chooseAnimationState(actor,{health:100}).base,'Jog_Fwd_Loop');
  assert.equal(chooseAnimationState(actor,{health:100,reloading:true}).upper,'Pistol_Reload');
  assert.equal(chooseAnimationState(actor,{health:0,seated:true}).base,'Death01');
  assert.equal(chooseAnimationState(actor,{transition:true,seated:true}).exclusive,'seat');
  assert.equal(chooseAnimationState(actor,{seated:true,vault:true}).base,'Driving_Loop');
});

test('selected mocap runtime loads in order and poses each managed rig exactly once after physics',async()=>{
  const requested=[];page.on('request',r=>{if(/mocap\/(readable|mocap)\.js|animation\/(urban|bridge)\.js/.test(r.url()))requested.push(r.url().split('/').slice(-2).join('/'));});
  const result=await page.evaluate(async()=>{
    const {AnimationSystem}=await import('/src/actors/animation.js');
    const {E,world,m}=window.engineTest,animations=await AnimationSystem.load({E,world});
    const actor=world.hero({x:m(10),y:m(12),z:0,r:m(.3),half:m(.6),rig:new E.Humanoid({build:'heroic',weapon:'gun'})});actor.id='animated';
    const state={health:100,armed:true,aiming:false};animations.register(actor,{role:'mara',getState:()=>state});
    let updates=0,physicsMoved=false,animationMoved=false;const original=actor.rig.update;actor.rig.update=function(dt,s){updates++;return original.call(this,dt,s);};
    const samples=[];actor.vx=m(3);
    for(let i=0;i<120;i++){world.step(1/120);const x=actor.x;animations.update(1/120);if(actor.x!==x)animationMoved=true;if(i%30===0)samples.push(actor.rig.J.footL.slice());}
    physicsMoved=actor.x>m(12);
    const lower=animations.lib.sample(animations.lib.clip('Walk_Loop'),.2),upper=animations.lib.sample(animations.lib.clip('Pistol_Aim_Neutral'),.2),layered=animations.layerUpper(lower,upper,1),ankle=animations.lib.idx.ankleL*3;
    const keepsFeet=lower[ankle]===layered[ankle]&&lower[ankle+1]===layered[ankle+1]&&lower[ankle+2]===layered[ankle+2];
    window.animationTest={actor,state,animations};
    return{updates,physicsMoved,animationMoved,managed:actor.data.animationManaged,nativePose:actor.pose,clip:actor.data.animation.base,samples,keepsFeet,clipCount:animations.lib.names.length,sourceCount:Object.keys(animations.lib.set.sources).length};
  });
  assert.deepEqual(requested,['mocap/readable.js','mocap/mocap.js','animation/urban.js','animation/bridge.js']);
  assert.equal(result.updates,120);assert.equal(result.physicsMoved,true);assert.equal(result.animationMoved,false);assert.equal(result.managed,true);assert.equal(result.nativePose,false);
  assert.equal(result.clip,'Jog_Fwd_Loop');assert.equal(result.keepsFeet,true);assert.equal(result.clipCount,30);assert.ok(result.sourceCount>=3);
  assert.notDeepEqual(result.samples[0],result.samples[1]);
});

test('capture layers, seat pose and death advance visually while gameplay transforms remain authoritative',async()=>{
  const result=await page.evaluate(()=>{
    const{actor,state,animations}=window.animationTest;
    actor.vx=actor.vy=0;actor.grounded=true;state.aiming=true;animations.update(.2);const aimed=actor.rig.J.handR.slice();
    state.reloading=true;animations.update(.4);const reload=actor.rig.J.handR.slice(),reloadClip=actor.data.animation.upper;
    state.reloading=false;state.seated=true;animations.update(.2);const seated=actor.data.animation.base;
    state.health=0;animations.update(.1);animations.update(4);const dead1=actor.rig.J.head.slice();animations.update(1);const dead2=actor.rig.J.head.slice();
    const death=actor.data.animation.base,position={x:actor.x,y:actor.y,z:actor.z};
    animations.reset(actor);state.health=100;state.dead=false;state.seated=false;animations.update(.1);
    return{aimed,reload,reloadClip,seated,death,dead1,dead2,position,after:{x:actor.x,y:actor.y,z:actor.z},resetClip:actor.data.animation.base};
  });
  assert.notDeepEqual(result.aimed,result.reload);assert.equal(result.reloadClip,'Pistol_Reload');assert.equal(result.seated,'Driving_Loop');assert.equal(result.death,'Death01');assert.deepEqual(result.dead1,result.dead2);assert.deepEqual(result.position,result.after);assert.equal(result.resetClip,'Idle_Loop');
});
