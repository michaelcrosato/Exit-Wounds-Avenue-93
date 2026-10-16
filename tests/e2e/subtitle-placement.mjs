/** Long radio subtitle placement while aiming at representative viewports. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const engine=process.env.EWA93_SUBTITLE_ENGINE||'chromium',output=process.env.EWA93_SUBTITLE_OUTPUT||'/tmp/ewa93-subtitle-placement';await mkdir(output,{recursive:true});
const browser=await ({chromium,webkit})[engine].launch({headless:true,args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]});
const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),records=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="openSettings"]').click();await page.locator('#s-quality').selectOption('low');await page.locator('[data-action="settingsBack"]').click();await page.locator('[data-action="newGame"]').click();
  await page.locator('.hud').waitFor();
  for(const [name,width,height] of [['desktop',1280,720],['phone',375,667],['landscape',756,352]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{const a=window.__exitWounds.app;a.dialogue=[];a.dialogueCurrent=null;a.dialogueTimer=0;a.queueLine('Morrow Radio','Rain is moving across Calder Bay. Ferry service is on time; take care under the old line.',30);a.updateDialogue(0);a.updateHUD();});
    await page.waitForTimeout(100);await page.screenshot({path:`${output}/${engine}-${name}.png`,timeout:90000});
    const row=await page.evaluate(()=>{const rect=selector=>{const element=document.querySelector(selector);if(!element||getComputedStyle(element).display==='none')return null;const r=element.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return{width:innerWidth,height:innerHeight,subtitle:rect('.hud__subtitle'),meters:rect('.meters'),minimap:rect('.minimap'),right:rect('.hud__right'),prompt:rect('.hud__prompt'),toast:rect('.hud__toast')};});
    const overlaps=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4;
    assert.ok(!overlaps(row.subtitle,row.meters)&&!overlaps(row.subtitle,row.minimap)&&!overlaps(row.subtitle,row.right),`${name}: subtitle overlaps bottom HUD`);
    for(const key of ['subtitle','meters','minimap','right','prompt','toast'])if(row[key])assert.ok(row[key].left>=-1&&row[key].right<=width+1&&row[key].top>=-1&&row[key].bottom<=height+1,`${name}: ${key} is outside viewport: ${JSON.stringify(row[key])}`);
    assert.ok(!overlaps(row.prompt,row.toast),`${name}: call prompt overlaps toast`);
    if(name==='desktop')assert.ok(row.subtitle.top>height*.55,`Desktop subtitle still blocks the central aim line: ${JSON.stringify(row.subtitle)}`);
    records.push({name,...row});
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',engine,records,errors},null,2));console.log(JSON.stringify({status:'passed',engine,output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',engine,error:error.stack,records,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await browser.close();}
