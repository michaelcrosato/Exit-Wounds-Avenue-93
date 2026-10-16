/** Inspect ending/credits scroll containment across couch and compact viewports. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const storageState=process.env.EWA93_ENDING_STORAGE;
if(!storageState)throw new Error('Set EWA93_ENDING_STORAGE to a completed-handoff storageState JSON');
const output=process.env.EWA93_ENDING_OUTPUT||'/tmp/ewa93-ending-layout';
await mkdir(output,{recursive:true});
const cdpURL=process.env.EWA93_CDP_URL;
const browser=cdpURL?await chromium.connectOverCDP(cdpURL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({storageState,viewport:{width:1280,height:720}});
const page=await context.newPage(),results=[];
const origin=process.env.EWA93_BASE_URL||'http://127.0.0.1:5173';
try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="continue"]').waitFor({state:'visible',timeout:90000});
  await page.evaluate(()=>window.__exitWounds.app.continueGame());
  assert.equal(await page.evaluate(()=>window.__exitWounds.app.state.mission.completed),true);
  for(const [label,width,height] of [['desktop',1280,720],['phone',375,667],['landscape',756,352],['tablet',768,1024],['ultrawide',2560,1080]]){
    await page.setViewportSize({width,height});
    for(const screen of ['ending','credits']){
      await page.evaluate(screen=>{const a=window.__exitWounds.app;if(screen==='ending')a.showEnding();else a.action('openCredits');},screen);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      const metrics=await page.evaluate(()=>{
        const s=document.querySelector('.screen'),panel=s.querySelector('.panel-scroll'),inner=s.querySelector('.screen__inner');
        const menu=s.querySelector('.menu'),body=document.body,html=document.documentElement;
        const rect=el=>{const r=el?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right}:null;};
        return {screen:s.className,screenScroll:s.scrollHeight-s.clientHeight,documentScroll:Math.max(body.scrollHeight,html.scrollHeight)-innerHeight,
          panelScroll:panel?.scrollHeight-panel?.clientHeight,inner:rect(inner),menu:rect(menu),viewport:{width:innerWidth,height:innerHeight}};
      });
      results.push({label,screen,...metrics});
      assert.ok(metrics.screenScroll<=2,`${label} ${screen}: outer overlay scroll ${metrics.screenScroll}px`);
      assert.ok(metrics.documentScroll<=2,`${label} ${screen}: document overflow ${metrics.documentScroll}px`);
      if(screen==='ending')assert.ok(metrics.menu.top>=0&&metrics.menu.bottom<=height+2,`${label}: ending action is outside viewport`);
      await page.screenshot({path:`${output}/${label}-${screen}.png`});
      if(metrics.panelScroll>3){
        const before=await page.locator('.panel-scroll').evaluate(el=>el.scrollTop);
        await page.keyboard.press(screen==='credits'?'ArrowDown':'PageDown');
        const after=await page.locator('.panel-scroll').evaluate(el=>el.scrollTop);
        assert.ok(after>before,`${label} ${screen}: keyboard could not scroll long text`);
      }
    }
  }
  console.log(JSON.stringify({status:'passed',screens:results.length,output}));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(results,null,2));await context.close();await browser.close();}
