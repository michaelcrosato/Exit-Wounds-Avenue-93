/** Active gameplay/dialogue/failure layouts across engines and form factors. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const engines=(process.env.EWA93_LAYOUT_ENGINES||'firefox').split(',');
const origin=process.env.EWA93_BASE_URL||'http://127.0.0.1:5173';
const output=process.env.EWA93_LAYOUT_OUTPUT||'/tmp/ewa93-active-layouts';await mkdir(output,{recursive:true});
const sizes=[['phone',375,667],['landscape',756,352],['desktop',1280,720],['ultrawide',2560,1080]];
const states=['gameplay','phone','pause','decision','retry','ending','credits'];
const records=[];
for(const name of engines){
  const browser=await ({chromium,firefox,webkit})[name].launch({headless:true,args:name==='chromium'?['--enable-unsafe-swiftshader']:[]});
  const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],captures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
    await page.locator('[data-action="openSettings"]').click();await page.locator('#s-quality').selectOption('low');await page.locator('[data-action="settingsBack"]').click();
    await page.locator('[data-action="newGame"]').click();await page.locator('.hud').waitFor();
    for(const [size,width,height] of sizes){
      await page.setViewportSize({width,height});
      for(const state of states){
        await page.evaluate(state=>{
          const a=window.__exitWounds.app;a.ui.show('playing');
          if(state==='phone')a.openPhone();
          else if(state==='pause')a.pause();
          else if(state==='decision')a.ui.show('decision');
          else if(state==='retry')a.ui.show('retry',{title:'The job is not over',reason:'Mara is down. Retry the last checkpoint.'});
          else if(state==='ending')a.ui.show('ending',{title:'Names in print',summary:'A wage investigation opens. Jun leaves alive, and the market has a reason to hope.',lines:[{speaker:'Reporter',text:'Payroll, signatures, transfers. We can publish this. Six hundred is all the fund has.'},{speaker:'Jun',text:'Print the workers first. They have waited long enough.'},{speaker:'Mara',text:'Then let us give them something to read in the morning.'}],message:'I am safe. They opened an investigation. People at the market are saying our names.',payment:600});
          else if(state==='credits')a.action('openCredits');
        },state);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        const path=`${output}/${name}-${size}-${state}.png`;await page.screenshot({path,timeout:90000});
        const layout=await page.evaluate(()=>{
          const screen=document.querySelector('.screen'),focus=document.activeElement?.getBoundingClientRect(),visible=focus&&focus.width>0&&focus.height>0;
          return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,screenScroll:screen?screen.scrollHeight-screen.clientHeight:0,
            focus:visible?{top:focus.top,bottom:focus.bottom,left:focus.left,right:focus.right}:null};
        });
        assert.ok(layout.documentWidth<=width+1,`${name} ${size} ${state}: horizontal document overflow`);
        if(['phone','ending','credits'].includes(state))assert.ok(layout.screenScroll<=2,`${name} ${size} ${state}: outer overlay scroll`);
        if(layout.focus)assert.ok(layout.focus.left>=-1&&layout.focus.right<=width+1&&layout.focus.top>=-1&&layout.focus.bottom<=height+1,`${name} ${size} ${state}: focused control clipped`);
        captures.push({size,state,path,layout});
      }
    }
    assert.deepEqual(errors,[]);records.push({engine:name,version:browser.version(),status:'passed',captures,errors});
    console.log(JSON.stringify({engine:name,status:'passed',captures:captures.length}));
  }catch(error){records.push({engine:name,version:browser.version(),status:'failed',error:error.stack,captures,errors});console.error(error.stack);process.exitCode=1;}
  finally{await writeFile(`${output}/report.json`,JSON.stringify({origin,records},null,2));await context.close();await browser.close();}
}
