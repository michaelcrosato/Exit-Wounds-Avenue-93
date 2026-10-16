/** Reproduce the broker parked-van escort blocker with real collision/pathing. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_DETOUR_OUTPUT||'/tmp/ewa93-companion-detour';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  const setup=await page.evaluate(()=>{
    const a=window.__exitWounds.app,U=16,van=a.runtime.vehicles.get('yard-van'),yaw=1.3254;
    a.newGame();a.applySetting('quality','low');
    van.body.setTranslation({x:106.604*U,y:84.220*U,z:.8*U},true);
    van.body.setRotation({x:0,y:0,z:Math.sin(yaw/2),w:Math.cos(yaw/2)},true);
    van.body.setLinvel({x:0,y:0,z:0},true);van.body.setAngvel({x:0,y:0,z:0},true);a.runtime.vehicles.postStep(0);
    a.player.place({x:94.033,y:87.902,z:0});a.jun.activate();a.jun.exit({x:107.992,y:84.412,z:0});
    return {player:a.player.position,jun:a.jun.position,van:van.position,yaw:van.yaw};
  });
  await page.screenshot({path:`${output}/before.png`});const trail=[];
  for(let i=0;i<200;i++){
    const snap=await page.evaluate(()=>{
      const a=window.__exitWounds.app;a.runtime.game.advance(.1);const p=a.player.position,j=a.jun.position;
      return {elapsed:a.state.elapsed,player:p,jun:j,gap:Math.hypot(p.x-j.x,p.y-j.y),detour:a.jun.detour,path:a.jun.path.map(n=>n.id||'target'),stuck:a.jun.stuckFor,recoveries:a.jun.recoveryAttempts,failure:a.state.mission.failure};
    });
    if(i%5===0)trail.push(snap);
    if(snap.gap<3.5||snap.failure)break;
  }
  await page.screenshot({path:`${output}/after.png`});const final=trail.at(-1);
  const report={setup,final,trail,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  assert.equal(final.failure,null);assert.ok(final.gap<4,`Jun remained behind the van: ${JSON.stringify(final)}`);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',gap:final.gap,elapsed:final.elapsed,detourUsed:trail.some(t=>t.detour),output}));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
