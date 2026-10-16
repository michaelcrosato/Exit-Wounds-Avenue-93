/** Live opening-call accept, miss, interrupt, resume and garage fallback. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_CALL_OUTPUT||'/tmp/ewa93-incoming-call';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const origin=process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',results=[],errors=[];
async function setup(){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="newGame"]').click();await page.locator('.hud').waitFor();
  return {context,page};
}
const read=page=>page.evaluate(()=>{const a=window.__exitWounds.app;return{screen:a.ui.screen,phase:a.state.mission.phase,call:a.eliCall.snapshot(),messages:a.state.mission.messages,jobEvents:a.state.mission.processedEvents.filter(id=>id.endsWith(':eli-accepted')),lastDialogueId:a.lastDialogueId,queue:a.dialogue.map(line=>[line.dialogueId,line.lineIndex])};});
try{
  {
    const {context,page}=await setup();
    assert.equal((await read(page)).call.status,'ringing');
    await page.keyboard.press('KeyT');await page.locator('[data-action="answerEliCall"]').waitFor({state:'visible'});
    await page.keyboard.press('Enter');
    let state=await read(page);assert.equal(state.phase,'COLLECTION');assert.equal(state.call.status,'active');assert.equal(state.jobEvents.length,1);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__exitWounds.app.ui.screen==='pause');state=await read(page);assert.equal(state.call.status,'interrupted');
    await page.locator('[data-action="resume"]').click();await page.keyboard.press('KeyT');await page.locator('[data-action="returnEliCall"]').waitFor({state:'visible'});
    await page.locator('[data-action="returnEliCall"]').click();state=await read(page);
    assert.equal(state.phase,'COLLECTION');assert.equal(state.jobEvents.length,1);assert.equal(state.call.status,'active');
    results.push({case:'answer-interrupt-resume',state});await page.screenshot({path:`${output}/answer-resume.png`});
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="continue"]').waitFor({state:'visible',timeout:90000});await page.locator('[data-action="continue"]').click();
    state=await read(page);assert.equal(state.phase,'COLLECTION');assert.equal(state.jobEvents.length,1);assert.ok(['active','interrupted'].includes(state.call.status));
    results.push({case:'reload-active-call',state});await context.close();
  }
  {
    const {context,page}=await setup();
    await page.evaluate(()=>window.__exitWounds.runtime.game.advance(14.2));let state=await read(page);
    assert.equal(state.call.status,'missed');assert.equal(state.phase,'INTRO');assert.ok(state.messages.includes('eli-missed'));
    await page.keyboard.press('KeyT');await page.locator('[data-action="returnEliCall"]').waitFor({state:'visible'});
    await page.locator('[data-action="returnEliCall"]').click();state=await read(page);
    assert.equal(state.phase,'COLLECTION');assert.equal(state.jobEvents.length,1);results.push({case:'miss-return',state});await context.close();
  }
  {
    const {context,page}=await setup();
    await page.keyboard.press('KeyT');await page.locator('[data-action="declineEliCall"]').waitFor({state:'visible'});
    await page.locator('[data-action="declineEliCall"]').click();let state=await read(page);
    assert.equal(state.call.status,'declined');assert.equal(state.phase,'INTRO');
    await page.evaluate(()=>window.__exitWounds.app.player.place({x:104.5,y:307.5,z:0}));
    await page.keyboard.down('KeyE');await page.waitForTimeout(80);await page.keyboard.up('KeyE');
    await page.waitForFunction(()=>window.__exitWounds.app.state.mission.phase==='COLLECTION');state=await read(page);
    assert.equal(state.call.status,'superseded');assert.equal(state.jobEvents.length,1);results.push({case:'decline-in-person',state});await context.close();
  }
  {
    const {context,page}=await setup();
    const staged=await page.evaluate(()=>{
      const a=window.__exitWounds.app,car=a.runtime.vehicles.get('mara-sedan');
      a.player.place({x:94,y:322,z:0});const entered=a.runtime.vehicles.enter(a.player.actor,car.id,'driver');a.runtime.game.advance(1.1);
      a.crime.remoteAlarm({x:94,y:322,z:0},`${a.state.runId}:call-test-alarm`);
      a.runtime.game.advance(14.2);
      return {entered:entered.ok,call:a.eliCall.status,liveVehicle:a.state.player.vehicleId,liveTier:a.state.wanted.tier,
        checkpointVehicle:a.checkpoints.snapshot.player.vehicleId,checkpointTier:a.checkpoints.snapshot.wanted.tier,
        savedVehicle:a.saveStore.load().state.player.vehicleId,savedTier:a.saveStore.load().state.wanted.tier,pending:a.state.mission.pendingCheckpoint};
    });
    assert.equal(staged.entered,true);assert.equal(staged.call,'missed');assert.equal(staged.liveVehicle,'mara-sedan');assert.equal(staged.liveTier,2);
    assert.equal(staged.checkpointVehicle,null);assert.equal(staged.checkpointTier,0);assert.equal(staged.savedVehicle,null);assert.equal(staged.savedTier,0);assert.equal(staged.pending,false);
    results.push({case:'miss-during-pursuit-keeps-safe-checkpoint',staged});await context.close();
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',results,errors},null,2));
  console.log(JSON.stringify({status:'passed',cases:results.map(x=>x.case),output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,results,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await browser.close();}
