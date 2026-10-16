/** Actual boot with malformed local settings and user-visible reserved remap recovery. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {SETTINGS_KEY} from '../../src/game/save.js';

const output=process.env.EWA93_SETTINGS_OUTPUT||'/tmp/ewa93-settings-remap-recovery';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:600}});
await context.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:1,settings:{quality:'low',sensitivity:'not-a-number',masterVolume:'bad'}})),SETTINGS_KEY);
const page=await context.newPage(),errors=[],observations={};
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  assert.match(await page.locator('.help--warning').innerText(),/Saved settings were invalid; defaults restored/);
  await page.locator('[data-action="newGame"]').click();await page.locator('.hud').waitFor();
  observations.boot=await page.evaluate(async()=>{const a=window.__exitWounds.app;await a.audio.unlock();return{sensitivity:a.runtime.camera.settings.sensitivity,masterVolume:a.audio.settings.masterVolume,quality:a.settings.quality,audioContext:a.audio.ctx?.state};});
  assert.equal(observations.boot.sensitivity,1);
  assert.equal(observations.boot.masterVolume,.82);
  assert.equal(observations.boot.quality,'high');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="openSettings"]').click();
  await page.locator('[data-action="openControls"]').click();
  await page.locator('[data-action="openRebind"]').click();
  await page.locator('[data-action="rebind:fire"]').click();
  const initialKeyboard=await page.evaluate(()=>[...window.__exitWounds.app.runtime.input.engine.map.fire]);
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#screen-notice').innerText(),/reserved for menu controls/);
  observations.reservedKeyboard=await page.evaluate(()=>({waiting:window.__exitWounds.app.waitingBinding,mapping:[...window.__exitWounds.app.runtime.input.engine.map.fire]}));
  assert.equal(observations.reservedKeyboard.waiting,'fire');
  assert.deepEqual(observations.reservedKeyboard.mapping,initialKeyboard);
  await page.keyboard.press('KeyG');
  observations.validKeyboard=await page.evaluate(()=>({waiting:window.__exitWounds.app.waitingBinding,mapping:[...window.__exitWounds.app.runtime.input.engine.map.fire]}));
  assert.equal(observations.validKeyboard.waiting,null);
  assert.ok(observations.validKeyboard.mapping.includes('KeyG'));
  await page.locator('[data-action="rebindBack"]').click();
  await page.locator('[data-action="openControllerRebind"]').click();
  await page.locator('[data-action="rebind:fire"]').click();
  observations.reservedController=await page.evaluate(()=>{const a=window.__exitWounds.app,before=[...a.runtime.input.engine.map.fire],original=a.rawButtons;a.rawButtons=()=>new Set([9]);a.previousRawButtons=new Set();try{a.update(1/120);}finally{a.rawButtons=original;}return{waiting:a.waitingBinding,before,mapping:[...a.runtime.input.engine.map.fire],notice:document.querySelector('#screen-notice')?.textContent};});
  assert.equal(observations.reservedController.waiting,'fire');
  assert.deepEqual(observations.reservedController.mapping,observations.reservedController.before);
  assert.match(observations.reservedController.notice,/reserved for menu controls/);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',observations,errors},null,2));
  console.log(JSON.stringify({status:'passed',output}));
}catch(error){
  await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,observations,errors},null,2));
  console.error(error.stack);process.exitCode=1;
}finally{await context.close();await browser.close();}
