/** Diagnostic camera for seated actor/vehicle presentation, not an acceptance route. */
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const storageState=process.env.EWA93_SEAT_STORAGE;
if(!storageState)throw new Error('Set EWA93_SEAT_STORAGE to a post-mission storageState JSON');
const output=process.env.EWA93_SEAT_OUTPUT||'/tmp/ewa93-seated-visual';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},storageState}),page=await context.newPage();
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="continue"]').waitFor({state:'visible',timeout:90000});
  const data=await page.evaluate(()=>{
    const a=window.__exitWounds.app,v=a.runtime.vehicles.get('waterfront-sedan'),U=16;
    a.continueGame();
    a.player.place({x:v.position.x-1,y:v.position.y,z:.1});
    a.jun.actor.place((v.position.x+1)*U,v.position.y*U,.1*U);
    a.jun.activate();
    const driver=a.runtime.vehicles.enter(a.player.actor,v.id,'driver');
    const passenger=a.runtime.vehicles.enter(a.jun.actor,v.id,'passenger');
    a.runtime.game.advance(1.35);
    a.pause();document.querySelector('#interface').style.display='none';
    const eye={x:v.position.x+7,y:v.position.y,z:1.8},target={x:v.position.x,y:v.position.y,z:1.1};
    const dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z;
    a.runtime.world.camera.set('fixed');a.runtime.world.camera.fixed={x:eye.x*U,y:eye.y*U,z:eye.z*U,yaw:Math.atan2(dy,dx),pitch:Math.atan2(dz,Math.hypot(dx,dy)),fov:45};
    a.runtime.world.camera.update(0);
    return {driver:driver.ok,passenger:passenger.ok,car:v.position,carYaw:v.yaw,seatLocal:a.runtime.vehicles.seatLocal(v,0),mara:a.player.position,jun:a.jun.position};
  });
  await page.waitForTimeout(650);await page.screenshot({path:`${output}/side.png`});
  const visualOffset=Number(process.env.EWA93_SEAT_VISUAL_OFFSET||0);
  if(visualOffset){await page.evaluate(offset=>{const a=window.__exitWounds.app;a.player.actor.z+=offset*16;a.jun.actor.z+=offset*16;a.animations.update(0);},visualOffset);await page.waitForTimeout(250);await page.screenshot({path:`${output}/offset.png`});}
  await writeFile(`${output}/report.json`,JSON.stringify(data,null,2));console.log(JSON.stringify(data));
}finally{await context.close();await browser.close();}
