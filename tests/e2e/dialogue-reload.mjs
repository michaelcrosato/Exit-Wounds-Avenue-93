/** Full-runtime checkpoint dialogue continuity and pre-Jun replay regression. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_DIALOGUE_OUTPUT||'/tmp/ewa93-dialogue-reload';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
const origin=process.env.EWA93_BASE_URL||'http://127.0.0.1:5173';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="newGame"]').click();await page.locator('.hud').waitFor();
  const before=await page.evaluate(()=>{
    const a=window.__exitWounds.app;
    a.dialogue=[];a.dialogueCurrent=null;a.dialogueTimer=0;a.queueDialogue('intro');a.updateDialogue(0);a.updateDialogue(1);
    a.captureCheckpoint('new-run');
    return {saved:a.saveStore.load().state.district.dialogue,current:a.dialogueCurrent,remaining:a.dialogueTimer};
  });
  assert.equal(before.saved.current.dialogueId,'intro');assert.ok(before.saved.remaining>0);assert.equal(before.saved.queue.length,3);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="continue"]').waitFor({state:'visible',timeout:90000});await page.locator('[data-action="continue"]').click();
  const resumed=await page.evaluate(()=>{const a=window.__exitWounds.app;return {id:a.lastDialogueId,current:a.dialogueCurrent,remaining:a.dialogueTimer,queue:a.dialogue.length};});
  assert.equal(resumed.id,'intro');assert.equal(resumed.current.text,before.current.text);assert.ok(resumed.remaining>0);assert.equal(resumed.queue,3);
  // A RECOVERY-stage fixture before Jun is met must retain the actually heard
  // depot call, rather than synthesizing the future Jun conversation on load.
  const recovery=await page.evaluate(()=>{
    const a=window.__exitWounds.app;a.state.mission.phase='RECOVERY';a.state.mission.junReached=false;
    a.dialogue=[];a.dialogueCurrent=null;a.dialogueTimer=0;a.queueDialogue('depot-message');a.captureCheckpoint('recovery');
    return {saved:a.saveStore.load().state.district.dialogue,phase:a.state.mission.phase,junReached:a.state.mission.junReached};
  });
  assert.equal(recovery.saved.lastId,'depot-message');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="continue"]').waitFor({state:'visible',timeout:90000});await page.locator('[data-action="continue"]').click();
  const after=await page.evaluate(()=>{
    const a=window.__exitWounds.app;a.openPhone();a.action('phoneJob');
    return {phase:a.state.mission.phase,junReached:a.state.mission.junReached,lastId:a.lastDialogueId,detail:a.phoneDetail,replay:!!document.querySelector('[data-action="phoneReplay"]')};
  });
  assert.equal(after.phase,'RECOVERY');assert.equal(after.junReached,false);assert.equal(after.lastId,'depot-message');
  assert.equal(after.replay,true);assert.ok(after.detail.includes('Bea told me about Jun'));assert.ok(!after.detail.includes('You are not with their recovery crew'));
  assert.deepEqual(errors,[]);
  const report={status:'passed',fixtureBasedRecovery:true,before,resumed,recovery,after,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${output}/pre-jun-phone.png`});console.log(JSON.stringify({status:'passed',resumedId:resumed.id,preJunReplay:after.lastId,output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
