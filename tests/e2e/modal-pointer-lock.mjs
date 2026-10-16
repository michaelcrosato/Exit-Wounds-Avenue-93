/** Verify modal UI releases captured mouse look without converting the modal to pause. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const output=process.env.EWA93_POINTER_OUTPUT||'/tmp/ewa93-modal-pointer-lock';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:600}});
const results=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="newGame"]').click();
  await page.locator('.hud').waitFor();
  for(const name of ['decision','retry','ending','title']){
    await page.locator('#screen').click({position:{x:480,y:300}});
    await page.waitForFunction(()=>document.pointerLockElement?.id==='screen');
    await page.evaluate(name=>window.__exitWounds.app.ui.show(name),name);
    await page.waitForFunction(()=>document.pointerLockElement===null);
    const state=await page.evaluate(()=>({screen:window.__exitWounds.app.ui.screen,locked:!!document.pointerLockElement}));
    assert.deepEqual(state,{screen:name,locked:false},`${name} preserved after pointer-lock release`);
    results.push({name,...state});
    await page.evaluate(()=>window.__exitWounds.app.ui.show('playing'));
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',results,errors},null,2));
  console.log(JSON.stringify({status:'passed',output,modals:results.map(row=>row.name)}));
}catch(error){
  await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,results,errors},null,2));
  console.error(error.stack);process.exitCode=1;
}finally{await browser.close();}
