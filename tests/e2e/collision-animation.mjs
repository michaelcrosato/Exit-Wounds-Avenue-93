/** Full-game Rapier ramp/soft-prop and seated animation diagnostic. Fixture staging is explicit. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const output=process.env.EWA93_COLLISION_OUTPUT||'/tmp/ewa93-collision-animation';await mkdir(output,{recursive:true});
const carId=process.env.EWA93_COLLISION_VEHICLE||'mara-sedan';
const cdpURL=process.env.EWA93_CDP_URL;
const browser=cdpURL?await chromium.connectOverCDP(cdpURL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}});
await context.addInitScript(()=>{
  window.__qaPad={axes:[0,0,0,0],values:Array(17).fill(0)};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{index:0,id:'Collision diagnostic standard pad',mapping:'standard',connected:true,timestamp:performance.now(),axes:window.__qaPad.axes,buttons:window.__qaPad.values.map(value=>({value,pressed:value>.5,touched:value>0}))}]});
});
const page=await context.newPage(),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  const setup=await page.evaluate(carId=>{
    const a=window.__exitWounds.app,U=16,v=a.runtime.vehicles.get(carId),yaw=-Math.PI/2;
    a.newGame();a.applySetting('quality','low');
    v.body.setTranslation({x:120*U,y:327*U,z:.8*U},true);
    v.body.setRotation({x:0,y:0,z:Math.sin(yaw/2),w:Math.cos(yaw/2)},true);
    v.body.setLinvel({x:0,y:0,z:0},true);v.body.setAngvel({x:0,y:0,z:0},true);a.runtime.vehicles.postStep(0);
    a.player.place({x:118,y:327,z:.1});
    const entry=a.runtime.vehicles.enter(a.player.actor,v.id,'driver');
    a.runtime.game.advance(1.15);
    return {entry:entry.ok,occupied:a.runtime.vehicles.occupant(a.player.actor)?.vehicle.id,car:v.position,ramp:a.district.features.inspectionRamp,props:a.district.features.softProps.map(p=>({id:p.id,position:p.body.translation()}))};
  },carId);
  assert.equal(setup.entry,true);assert.equal(setup.occupied,carId);
  await page.screenshot({path:`${output}/00-start.png`});
  let rampCaptured=false;
  for(let i=0;i<90;i++){
    const snap=await page.evaluate(carId=>{
      window.__qaPad.values[7]=.72;
      const a=window.__exitWounds.app,v=a.runtime.vehicles.get(carId);a.runtime.game.advance(.1);
      return {elapsed:a.state.elapsed,position:v.position,speed:v.speed/16,health:v.health,disabled:v.disabled,
        occupant:a.runtime.vehicles.occupant(a.player.actor)?.vehicle.id,
        animation:a.player.actor.data.animation?.base,
        props:a.district.features.softProps.map(p=>({id:p.id,position:{x:p.body.translation().x/16,y:p.body.translation().y/16,z:p.body.translation().z/16}}))};
    },carId);
    if(i%3===0)samples.push(snap);
    if(!rampCaptured&&snap.position.y<308){await page.screenshot({path:`${output}/01-ramp.png`});rampCaptured=true;}
    if(snap.position.y<287||snap.disabled)break;
  }
  await page.screenshot({path:`${output}/02-finish.png`});
  const high=Math.max(...samples.map(s=>s.position.z)),first=samples[0],last=samples.at(-1),propMotion=Math.max(...last.props.map((p,i)=>Math.hypot(p.position.x-setup.props[i].position.x/16,p.position.y-setup.props[i].position.y/16)));
  assert.ok(high>.95,`Car never rose onto the 0.65 m inspection ramp: max z=${high}`);
  assert.ok(last.position.y<304,`Car did not traverse the ramp: final y=${last.position.y}`);
  assert.equal(last.occupant,carId);assert.equal(last.animation,'Driving_Loop');
  assert.deepEqual(errors,[]);
  const report={status:'passed',fixtureStaged:true,carId,setup,first,last,maxCarZ:high,propMotion,peakSpeed:Math.max(...samples.map(s=>s.speed)),secondsToExit:last.elapsed-first.elapsed,samples,errors};
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',maxCarZ:high,finalY:last.position.y,propMotion,output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,samples,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
