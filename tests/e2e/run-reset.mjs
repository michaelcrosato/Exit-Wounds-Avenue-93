/** Actual-game clock/stance reset regression across New Game, retry and Continue. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_RESET_OUTPUT||'/tmp/ewa93-run-reset';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage(),results=[];
const poison=()=>page.evaluate(()=>{const a=window.__exitWounds.app;a.dodgeUntil=10000;a.dodgeDirection={x:1,y:0};a.lastSkidAt=1000;a.lastShot=10000;a.junCoverUntil=1000;a.surrenderHeld=.9;a.toggledAim=true;a.toggledSprint=true;a.player.crouched=true;a.audio.lastFootstep=1000;});
const read=()=>page.evaluate(()=>{const a=window.__exitWounds.app,s=a.state;return{tick:s.tick,elapsed:s.elapsed,dodgeUntil:a.dodgeUntil,dodgeDirection:a.dodgeDirection,lastSkidAt:a.lastSkidAt,lastShot:a.lastShot,junCoverUntil:a.junCoverUntil,surrenderHeld:a.surrenderHeld,toggledAim:a.toggledAim,toggledSprint:a.toggledSprint,crouched:a.player.crouched,lastFootstep:a.audio.lastFootstep,phase:s.mission.phase};});
const clean=value=>{assert.ok(value.dodgeUntil<=value.tick);assert.equal(value.dodgeDirection,null);assert.ok(value.lastSkidAt<=value.elapsed);assert.ok(value.lastShot<=value.tick);assert.ok(value.junCoverUntil<=value.elapsed);assert.equal(value.surrenderHeld,0);assert.equal(value.toggledAim,false);assert.equal(value.toggledSprint,false);assert.equal(value.crouched,false);assert.ok(value.lastFootstep<=value.elapsed);};
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="newGame"]').click();await page.locator('.hud').waitFor();
  await poison();await page.evaluate(()=>window.__exitWounds.app.newGame());const fresh=await read();clean(fresh);results.push({case:'new-game',...fresh});
  await poison();await page.evaluate(()=>window.__exitWounds.app.retryCheckpoint());const retried=await read();clean(retried);results.push({case:'checkpoint-retry',...retried});
  await poison();await page.evaluate(()=>window.__exitWounds.app.continueGame());const continued=await read();clean(continued);results.push({case:'continue',...continued});
  await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',results},null,2));console.log(JSON.stringify({status:'passed',cases:results.map(x=>x.case),output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,results},null,2));console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
