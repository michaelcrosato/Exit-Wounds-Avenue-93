import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, webkit, firefox } from 'playwright';
import { m, metres, rotateLocal, threeQuaternion } from '../../src/engine/units.js';

let server, browser, page, origin;
before(async () => {
  const port=await new Promise(resolve=>{const probe=createServer();probe.listen(0,'127.0.0.1',()=>{const value=probe.address().port;probe.close(()=>resolve(value));});});
  origin=`http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['tools/serve.mjs', '--port', String(port)], { stdio: 'pipe' });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin + '/tests/integration/engine-harness.html')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  await page.goto(origin + '/tests/integration/engine-harness.html');
  await page.waitForFunction(() => !!window.engineTest, null, { timeout: 60000 });
});
after(async () => { await browser?.close(); server?.kill(); });

test('unit conversion and handedness retain physical scale', () => {
  assert.equal(m(1.8), 28.8); assert.equal(metres(72), 4.5);
  assert.deepEqual(rotateLocal({ x: 16, y: 0, z: 3 }, 0, { x: 2, y: 5, z: 1 }), { x: 18, y: 5, z: 4 });
  assert.deepEqual(threeQuaternion({ x: 0, y: 0, z: 1, w: 0 }), { x: -0, y: -1, z: -0, w: 0 });
});

test('raw controller poll retains partial triggers, remapping, disconnect and input edges', async () => {
  const result = await page.evaluate(() => {
    const {game,input}=window.engineTest;
    let pad={index:0,id:'DualSense test fixture',connected:true,mapping:'standard',axes:[.08,0,.55,-.2],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    pad.buttons[7]={pressed:false,value:.37};pad.buttons[6]={pressed:false,value:.21};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad?[pad]:[]});
    game.input.tick(1/120);const first=input.serialize(input.poll(1));
    pad.buttons[15]={pressed:true,value:1};game.input.tick(1/120);const radioDpad=input.serialize(input.poll(2));
    pad.buttons[15]={pressed:false,value:0};game.input.tick(1/120);input.poll(2);
    pad.buttons[12]={pressed:true,value:1};game.input.tick(1/120);const phoneDpad=input.serialize(input.poll(2));
    pad.buttons[12]={pressed:false,value:0};game.input.tick(1/120);input.poll(2);
    pad.buttons[3]={pressed:true,value:1};game.input.tick(1/120);const edge=input.serialize(input.poll(2));
    game.input.tick(1/120);const held=input.serialize(input.poll(3));
    input.clear();game.input.tick(1/120);const cleared=input.serialize(input.poll(4));
    pad.buttons[7].value=0;pad.buttons[6].value=0;game.input.tick(1/120);input.poll(4);
    const reboundResult=input.rebind('throttle','controller','Pad8');
    pad.buttons[8]={pressed:false,value:.62};game.input.tick(1/120);const rebound=input.serialize(input.poll(4));
    game.input.resetBindings();
    const exchanged=input.rebind('fire','keyboard','Mouse2'),exchangeMaps={fire:game.input.map.fire.slice(),aim:game.input.map.aim.slice()};game.input.resetBindings();
    pad=null;game.input.tick(1/120);const disconnected=input.serialize(input.poll(5));
    return {first,radioDpad,phoneDpad,edge,held,cleared,rebound,reboundResult,exchanged,exchangeMaps,disconnected};
  });
  assert.equal(result.first.throttle,.37); assert.equal(result.first.brake,.21); assert.equal(result.first.moveX,0);
  assert.equal(result.first.device,'gamepad'); assert.ok(result.first.lookX>0);
  assert.equal(result.radioDpad.moveX,0);assert.ok(result.radioDpad.pressed.includes('radio'));
  assert.equal(result.phoneDpad.moveY,0);assert.ok(result.phoneDpad.pressed.includes('phone'));
  assert.ok(result.edge.pressed.includes('interact')); assert.ok(!result.held.pressed.includes('interact'));
  assert.ok(!result.cleared.pressed.includes('interact')); assert.equal(result.cleared.throttle,0); assert.equal(result.reboundResult,null); assert.equal(result.rebound.throttle,.62);assert.equal(result.exchanged,'aim');assert.ok(result.exchangeMaps.fire.includes('Mouse2'));assert.ok(result.exchangeMaps.aim.includes('Mouse0')); assert.equal(result.disconnected.throttle,0); assert.equal(result.disconnected.connected,false);
});

test('real Rapier raycast vehicle drives forward and brake/reverse are distinct', async () => {
  const result=await page.evaluate(()=>{
    const {vehicles,world}=window.engineTest;
    const v=vehicles.create({id:'drive-test',kind:'sedan',x:20,y:10,yaw:0,visual:{}});
    const step=(n,c)=>{vehicles.setControl(v,c);for(let i=0;i<n;i++){vehicles.preStep(1/120);world.step(1/120);vehicles.postStep(1/120);}};
    step(120,{throttle:0});const start=v.position;
    step(600,{throttle:.65});const driven=v.position,fast=v.speed/16;
    step(180,{brake:.7});const braked=v.speed/16;
    step(180,{brake:.7,reverse:true});const reversed=v.speed/16;
    const parked=vehicles.create({id:'parked-cruiser',kind:'cruiser',x:20,y:30,yaw:0,visual:{}});
    step(120,{});const parkedStart=parked.position;
    vehicles.setControl(parked,{brake:.7});step(360,{});const parkedEnd=parked.position;
    const axes={up:v.controller.indexUpAxis,forward:v.controller.indexForwardAxis,wheels:v.controller.numWheels()};
    vehicles.setControl(v,{});return{start,driven,fast,braked,reversed,parkedStart,parkedEnd,axes,health:v.health};
  });
  assert.deepEqual(result.axes,{up:2,forward:0,wheels:4});
  assert.ok(result.driven.x > result.start.x + 5,JSON.stringify(result));
  assert.ok(result.fast>2,JSON.stringify(result)); assert.ok(result.braked<result.fast,JSON.stringify(result));
  assert.ok(result.reversed<0,JSON.stringify(result));
  assert.ok(Math.hypot(result.parkedEnd.x-result.parkedStart.x,result.parkedEnd.y-result.parkedStart.y)<.3,JSON.stringify(result));
  assert.ok(Math.abs(result.driven.z-result.start.z)<.5,JSON.stringify(result));
});

test('reverse input wakes a parked sleeping van and moves it out of a service bay',async()=>{
  const result=await page.evaluate(()=>{
    const {vehicles,world}=window.engineTest;
    const van=vehicles.create({id:'sleeping-reverse-van',kind:'van',x:60,y:10,yaw:0,visual:{}});
    const step=n=>{for(let i=0;i<n;i++){vehicles.preStep(1/120);world.step(1/120);vehicles.postStep(1/120);}};
    step(180);van.body.sleep();
    const start={...van.position},asleep=van.body.isSleeping();
    vehicles.setControl(van,{throttle:0,brake:1,reverse:true,handbrake:false});
    step(240);
    return{asleep,awake:!van.body.isSleeping(),start,end:van.position,speed:van.speed/16,disabled:van.disabled};
  });
  assert.equal(result.asleep,true,JSON.stringify(result));
  assert.equal(result.awake,true,JSON.stringify(result));
  assert.ok(result.end.x<result.start.x-.5,JSON.stringify(result));
  assert.ok(result.speed<0,JSON.stringify(result));
  assert.equal(result.disabled,false);
});

test('seat attachment disables collisions and validated exit restores original actor body', async()=>{
  const result=await page.evaluate(()=>{
    const {E,vehicles,world,queries,m}=window.engineTest;
    const v=vehicles.create({id:'seat-test',kind:'van',x:25,y:24,yaw:0,visual:{}});
    const actor=world.hero({x:m(25),y:m(22),z:0,r:m(.3),half:m(.6)});actor.id='seat-actor';queries.register(actor.body,actor);
    const original=actor.body;
    const step=n=>{for(let i=0;i<n;i++){vehicles.preStep(1/120);world.step(1/120);vehicles.postStep(1/120);}};
    step(60);const entered=vehicles.enter(actor,v,1);step(140);
    const seated={bodyNull:actor.body===null,disabled:!original.isEnabled(),vehicleId:actor.vehicleId,seat:v.seats[1]?.id};
    const exited=vehicles.exit(actor);step(140);
    return{entered:entered.ok,seated,exited:exited.ok,restored:actor.body===original,enabled:original.isEnabled(),clear:queries.capsuleClear({x:actor.x,y:actor.y,z:actor.z},actor.r,actor.half,{ignore:[actor]}),footZ:actor.z/16};
  });
  assert.equal(result.entered,true,JSON.stringify(result));assert.equal(result.seated.bodyNull,true);assert.equal(result.seated.disabled,true);
  assert.equal(result.seated.seat,'seat-actor');assert.equal(result.exited,true,JSON.stringify(result));assert.equal(result.restored,true);assert.equal(result.enabled,true);
  assert.ok(result.footZ>-.2&&result.footZ<.4,JSON.stringify(result));
});

test('dynamic occlusion, camera sweep and muzzle obstruction use the actual world',async()=>{
  const result=await page.evaluate(()=>{
    const {world,queries,camera,m}=window.engineTest;
    const obstacle=world.box({x:m(40),y:m(15),z:0,w:m(1),d:m(4),h:m(3),fixed:false,mass:.02});obstacle.id='occluder';queries.register(obstacle.body,obstacle);
    world.step(1/120);
    const blocked=queries.raycast({x:35,y:15,z:1.5},{x:45,y:15,z:1.5});
    const blockedSight=queries.lineOfSight({x:35,y:15,z:1.5},{x:45,y:15,z:1.5});
    const clear=queries.lineOfSight({x:35,y:20,z:1.5},{x:45,y:20,z:1.5});
    const target={x:m(43),y:m(15),z:0};camera.yaw=0;camera.pitch=0;
    camera.update(1/120,{},target);
    const nearDistance=camera.distance/16;
    const shot=queries.shot({x:m(38),y:m(19),z:m(2)},{x:m(45),y:m(19),z:m(1.5)},{x:m(38),y:m(15),z:m(1.4)});
    return{blocked:blocked?.entity?.id,blockedSight,clear,nearDistance,muzzleBlocked:!!shot.hit};
  });
  assert.equal(result.blocked,'occluder');assert.equal(result.blockedSight,false);assert.equal(result.clear,true);assert.ok(result.nearDistance<3,JSON.stringify(result));assert.equal(result.muzzleBlocked,true);
});

test('WebKit loads full engine and 3D module through WebGL2 fallback',async()=>{
  const safari=await webkit.launch({headless:true});
  try{
    const tab=await safari.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));
    await tab.goto(origin+'/tests/integration/engine-harness.html');await tab.waitForFunction(()=>!!window.engineTest,null,{timeout:60000});
    const result=await tab.evaluate(()=>({version:window.engineTest.E.version,backend:window.engineTest.metadata.backend}));
    assert.equal(result.version,'0.46.1');assert.equal(result.backend,'WebGL 2');assert.deepEqual(errors,[]);
  }finally{await safari.close();}
});

test('one engine physics step per fixed tick is independent of render cadence',async()=>{
  const result=await page.evaluate(()=>{
    const {vehicles,world,game,start}=window.engineTest;
    let active=null;
    start({update(dt){vehicles.preStep(dt);world.step(dt);vehicles.postStep(dt);}});
    const runs=[];
    for(const [rate,y] of [[30,1],[60,4],[144,7]]){
      active=vehicles.create({id:'cadence-'+rate,kind:'cruiser',x:3,y,yaw:0,visual:{}});
      vehicles.setControl(active,{throttle:.35});
      const before=world.n;
      for(let frame=0;frame<rate*10;frame++)game.advance(1/rate);
      runs.push({rate,steps:world.n-before,x:active.position.x,z:active.position.z,speed:active.speed/16});
      vehicles.setControl(active,{brake:1});
    }
    game.stop();return runs;
  });
  for(const run of result)assert.equal(run.steps,1200,JSON.stringify(result));
  assert.ok(Math.max(...result.map(r=>r.x))-Math.min(...result.map(r=>r.x))<.04,JSON.stringify(result));
  assert.ok(result[0].x>20,JSON.stringify(result));
});

test('real chassis contact produces damage and restored checkpoints release stale occupants',async()=>{
  const result=await page.evaluate(()=>{
    const {vehicles,world,queries,m}=window.engineTest;
    world.box({x:m(72),y:m(30),z:0,w:m(1),d:m(7),h:m(4),fixed:true,color:'#56666e'});
    const v=vehicles.create({id:'impact-test',kind:'sedan',x:55,y:30,yaw:0,visual:{}});
    let damage=0;vehicles.onEvent=e=>{if(e.type==='VehicleImpact'&&e.sourceId===v.id)damage+=e.payload.damage;};
    vehicles.setControl(v,{throttle:1});
    for(let i=0;i<600;i++){vehicles.preStep(1/120);world.step(1/120);vehicles.postStep(1/120);}
    vehicles.setControl(v,{});
    const van=vehicles.get('seat-test');van.body.setLinvel({x:0,y:0,z:0},true);van.speed=0;
    const actor=world.actors.find(a=>a.id==='seat-actor');actor.place(van.x,van.y-m(2),0);
    const baseline=vehicles.snapshot();
    const entry=vehicles.enter(actor,van,1);
    const pending=vehicles.transitions.has(actor);
    vehicles.restore(baseline,new Map([[actor.id,actor]]));
    return{damage,health:v.health,entry:entry.ok,pending,cleared:!vehicles.transitions.has(actor)&&!vehicles.occupant(actor),enabled:!!actor.body&&actor.body.isEnabled(),empty:van.seats[1]===null};
  });
  assert.ok(result.damage>0,JSON.stringify(result));assert.ok(result.health<100,JSON.stringify(result));
  assert.equal(result.entry,true,JSON.stringify(result));assert.equal(result.pending,true);assert.equal(result.cleared,true);assert.equal(result.enabled,true);assert.equal(result.empty,true);
});

test('an inverted or side-rolled chassis becomes disabled instead of remaining drivable',async()=>{
  const result=await page.evaluate(()=>{
    const{vehicles}=engineTest;
    const inverted=vehicles.create({id:'inverted-test',kind:'sedan',x:82,y:42,yaw:0,visual:{}});
    const side=vehicles.create({id:'side-roll-test',kind:'van',x:91,y:42,yaw:0,visual:{}});
    inverted.body.setRotation({x:1,y:0,z:0,w:0},true);
    side.body.setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},true);
    vehicles.postStep(0);
    return {inverted:inverted.disabled,side:side.disabled};
  });
  assert.deepEqual(result,{inverted:true,side:true});
});

test('positive steering turns eastbound vehicles south (keyboard right / controller right)',async()=>{
  const result=await page.evaluate(()=>{
    const{vehicles,world}=window.engineTest;
    const vehicle=vehicles.create({id:'steering-sign',kind:'sedan',x:8,y:19,yaw:0,visual:{}});
    vehicles.setControl(vehicle,{throttle:.6,steer:.6});
    for(let i=0;i<360;i++){vehicles.preStep(1/120);world.step(1/120);vehicles.postStep(1/120);}
    return{position:vehicle.position,yaw:vehicle.yaw};
  });
  assert.ok(result.position.y>20,JSON.stringify(result));assert.ok(result.yaw>0,JSON.stringify(result));
});


test('Firefox without WebGPU enums imports pinned Three and initializes native WebGL2 fallback',async()=>{
  const browser=await firefox.launch({headless:true});
  try{const tab=await browser.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));await tab.goto(origin+'/tests/integration/engine-harness.html?native=1');await tab.waitForFunction(()=>!!window.engineTest,null,{timeout:60000});const result=await tab.evaluate(()=>({version:engineTest.E.version,backend:engineTest.metadata.backend,patch:engineTest.metadata.patch}));assert.equal(result.version,'0.46.1');assert.equal(result.backend,'WebGL 2');assert.match(result.patch,/P2-three-stage-fallback/);assert.deepEqual(errors,[]);}
  finally{await browser.close();}
});

test('real mouse right-aim + left-fire chords retain independent presses and releases',async()=>{
  await page.mouse.move(420,280);await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});
  const both=await page.evaluate(()=>{const{game,input}=engineTest;game.input.tick(1/120);const f=input.poll(1);return [...f.held];});
  await page.mouse.up({button:'left'});
  const aimOnly=await page.evaluate(()=>{const{game,input}=engineTest;game.input.tick(1/120);const f=input.poll(2);return [...f.held];});
  await page.mouse.up({button:'right'});
  assert.ok(both.includes('aim')&&both.includes('fire'),JSON.stringify(both));assert.ok(aimOnly.includes('aim')&&!aimOnly.includes('fire'),JSON.stringify(aimOnly));
});

test('vehicle look-behind turns rearward while held and smoothly recovers on release',async()=>{
  const result=await page.evaluate(()=>{
    const{camera,m}=engineTest,target={x:m(120),y:m(15),z:0},vehicle={speed:0,yaw:0};camera.yaw=0;camera.pitch=-.2;
    for(let i=0;i<90;i++)camera.update(1/120,{held:new Set(['shoulder'])},target,{vehicle});
    const behind=camera.world.camera.pose.yaw;
    camera.update(1/120,{held:new Set()},target,{vehicle});const firstReleased=camera.world.camera.pose.yaw;
    for(let i=0;i<90;i++)camera.update(1/120,{held:new Set()},target,{vehicle});
    return{behind,firstReleased,restored:camera.world.camera.pose.yaw};
  });
  assert.ok(result.behind>3.1,JSON.stringify(result));assert.ok(result.firstReleased>2&&result.firstReleased<result.behind,JSON.stringify(result));assert.ok(Math.abs(result.restored)<.01,JSON.stringify(result));
});

test('engine session recording and replay preserve partial button values and unknown mapping',async()=>{
  const recorded=await browser.newPage();
  await recorded.addInitScript(()=>{const pad={index:0,id:'Unrecognized controller fixture',connected:true,mapping:'',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:false,value:i===7?.37:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});});
  await recorded.goto(origin+'/tests/integration/engine-harness.html?record=1');await recorded.waitForFunction(()=>!!window.engineTest,null,{polling:100,timeout:15000});
  const record=await recorded.evaluate(()=>{engineTest.game.input.tick(1/120);return engineTest.E.session.data;});
  assert.equal(record.pads.at(-1)[1][0][4][7][1],.37);assert.equal(record.pads.at(-1)[1][0][5],'');
  await recorded.close();
  const replayed=await browser.newPage();await replayed.addInitScript(record=>{window.__my3d2dgeReplay=record;},record);
  await replayed.goto(origin+'/tests/integration/engine-harness.html');await replayed.waitForFunction(()=>!!window.engineTest,null,{polling:100,timeout:15000});
  const result=await replayed.evaluate(()=>{const pad=navigator.getGamepads()[0];return{mapping:pad.mapping,value:pad.buttons[7].value,id:pad.id};});
  assert.equal(result.mapping,'');assert.equal(result.value,.37);assert.equal(result.id,'Unrecognized controller fixture');await replayed.close();
});
