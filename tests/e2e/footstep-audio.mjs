/** Capture authored asphalt/concrete/wood footstep timbres with live Web Audio. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_FOOTSTEP_OUTPUT||'/tmp/ewa93-footsteps';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(()=>window.__exitWounds.app.audio.ctx?.state==='running');
  const recorded=await page.evaluate(async()=>{
    const app=window.__exitWounds.app,city=app.audio,c=city.ctx;app.pause();city.stopRadio();city.rain.gain.gain.setValueAtTime(0,c.currentTime);city.traffic.gain.gain.setValueAtTime(0,c.currentTime);
    const dest=c.createMediaStreamDestination(),analyser=c.createAnalyser();analyser.fftSize=2048;city.master.connect(dest);city.master.connect(analyser);
    const recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[],wave=new Float32Array(analyser.fftSize),freq=new Float32Array(analyser.frequencyBinCount),segments=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));recorder.start();
    for(const surface of ['asphalt','concrete','wood']){
      const samples=[];
      for(let i=0;i<5;i++){
        city.play('step',{surface,intensity:1});
        for(let j=0;j<4;j++){
          await wait(40);analyser.getFloatTimeDomainData(wave);analyser.getFloatFrequencyData(freq);
          const rms=Math.sqrt(wave.reduce((sum,x)=>sum+x*x,0)/wave.length);
          let total=0,weighted=0;for(let k=2;k<freq.length;k++){const power=10**(freq[k]/10);total+=power;weighted+=power*k*c.sampleRate/analyser.fftSize;}
          if(rms>.0004)samples.push({rms,centroidHz:total?weighted/total:0});
        }
      }
      segments.push({surface,maxRms:Math.max(...samples.map(x=>x.rms)),meanCentroidHz:samples.reduce((sum,x)=>sum+x.centroidHz,0)/samples.length,samples:samples.length});
      await wait(180);
    }
    recorder.stop();await new Promise(resolve=>recorder.onstop=resolve);city.master.disconnect(dest);city.master.disconnect(analyser);
    const blob=new Blob(chunks,{type:'audio/webm'}),dataURL=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
    return {segments,sampleRate:c.sampleRate,bytes:blob.size,mimeType:blob.type,dataURL};
  });
  const bytes=Buffer.from(recorded.dataURL.split(',')[1],'base64');delete recorded.dataURL;await writeFile(`${output}/footsteps.webm`,bytes);
  assert.ok(recorded.bytes>1000);assert.ok(recorded.segments.every(s=>s.maxRms>.001));
  assert.ok(recorded.segments[1].meanCentroidHz>recorded.segments[0].meanCentroidHz+80,'Concrete should be audibly brighter than asphalt');
  assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',browser:browser.version(),...recorded,errors},null,2));
  console.log(JSON.stringify({status:'passed',segments:recorded.segments,output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
