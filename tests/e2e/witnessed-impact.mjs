/** Physically collide a driven car near an officer and check evidence-backed heat. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_IMPACT_OUTPUT||'/tmp/ewa93-witnessed-impact';await mkdir(output,{recursive:true});
const carId=process.env.EWA93_IMPACT_VEHICLE||'mara-sedan';
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}});
await context.addInitScript(()=>{window.__qaPad={values:Array(17).fill(0)};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{index:0,id:'Impact witness standard pad',mapping:'standard',connected:true,timestamp:performance.now(),axes:[0,0,0,0],buttons:window.__qaPad.values.map(value=>({value,pressed:value>.5,touched:value>0}))}]});});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  const setup=await page.evaluate(carId=>{
    const a=window.__exitWounds.app,U=16,v=a.runtime.vehicles.get(carId),officer=a.police.officers[0],yaw=0;
    a.newGame();a.applySetting('quality','low');
    v.body.setTranslation({x:220*U,y:202*U,z:.8*U},true);v.body.setRotation({x:0,y:0,z:Math.sin(yaw/2),w:Math.cos(yaw/2)},true);
    v.body.setLinvel({x:0,y:0,z:0},true);v.body.setAngvel({x:0,y:0,z:0},true);a.runtime.vehicles.postStep(0);
    a.player.place({x:219,y:202,z:.1});officer.actor.place(246*U,208*U,.1*U);officer.post={x:246,y:208};
    a.runtime.world.box({x:255*U,y:202*U,z:0,w:1.2*U,d:7*U,h:4*U,fixed:true,color:'#8e948e'});
    const board=a.runtime.vehicles.enter(a.player.actor,v.id,'driver');a.runtime.game.advance(1.15);
    return {board:board.ok,car:v.position,officer:a.police.position(officer),occupied:a.runtime.vehicles.occupant(a.player.actor)?.vehicle.id};
  },carId);
  assert.equal(setup.board,true);assert.equal(setup.occupied,carId);
  let final;
  for(let i=0;i<130;i++){
    final=await page.evaluate(carId=>{
      const a=window.__exitWounds.app,v=a.runtime.vehicles.get(carId);window.__qaPad.values[7]=1;a.runtime.game.advance(.1);
      const collisions=a.state.crime.incidents.filter(c=>c.kind==='collision');
      return {elapsed:a.state.elapsed,car:v.position,speed:v.speed/16,health:v.health,collisions:collisions.map(c=>({id:c.id,position:c.position,vehicleId:c.vehicleId})),
        reports:a.state.crime.reports.filter(r=>collisions.some(c=>c.id===r.crimeId)).map(r=>({witness:r.witnessId,kind:r.witnessKind,person:r.observedPersonId,vehicle:r.observedVehicleId,status:r.status})),
        wanted:{tier:a.state.wanted.tier,status:a.state.wanted.status,vehicles:a.state.wanted.vehicleIds,visible:a.state.wanted.visible},
        officer:a.police.position(a.police.officers[0]),officerLOS:a.runtime.queries.lineOfSight({x:v.position.x,y:v.position.y,z:v.position.z+1.4},{x:a.police.position(a.police.officers[0]).x,y:a.police.position(a.police.officers[0]).y,z:1.5},{ignore:[v,a.police.officers[0].actor]})};
    },carId);
    if(final.collisions.length)break;
  }
  await page.screenshot({path:`${output}/impact.png`});
  const report={carId,setup,final,errors,physicalImpact:final.collisions.length>0,visibleOfficerDistance:Math.hypot(final.car.x-final.officer.x,final.car.y-final.officer.y)};
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  assert.ok(report.physicalImpact,'Car must produce a physical collision incident');
  assert.ok(report.visibleOfficerDistance<35);
  assert.ok(final.reports.some(r=>r.kind==='police'&&r.vehicle===carId),`Visible impact was not observed by police: ${JSON.stringify(final)}`);
  assert.ok(final.wanted.tier>0&&final.wanted.vehicles.includes(carId));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',collision:final.collisions.length,reports:final.reports,wanted:final.wanted,output}));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
