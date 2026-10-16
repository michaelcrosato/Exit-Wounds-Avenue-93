/** Web Audio mix capture and persisted mute check; not a subjective listening test. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.EWA93_AUDIO_OUTPUT||'/tmp/ewa93-audio-mix';await mkdir(output,{recursive:true});
const browser=process.env.EWA93_CDP_URL?await chromium.connectOverCDP(process.env.EWA93_CDP_URL):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(process.env.EWA93_BASE_URL||'http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(()=>window.__exitWounds.app.audio.ctx?.state==='running');
  const capture=await page.evaluate(async()=>{
    const a=window.__exitWounds.app,city=a.audio,c=city.ctx;
    const dest=c.createMediaStreamDestination(),analyser=c.createAnalyser();analyser.fftSize=2048;city.master.connect(dest);city.master.connect(analyser);
    const recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[],segments=[];
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    const sample=new Float32Array(analyser.fftSize),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const measure=async(label,ms,trigger)=>{
      trigger();const readings=[];
      for(let elapsed=0;elapsed<ms;elapsed+=100){await wait(100);analyser.getFloatTimeDomainData(sample);let energy=0,peak=0;for(const x of sample){energy+=x*x;peak=Math.max(peak,Math.abs(x));}readings.push({rms:Math.sqrt(energy/sample.length),peak});}
      segments.push({label,maxRms:Math.max(...readings.map(x=>x.rms)),meanRms:readings.reduce((sum,x)=>sum+x.rms,0)/readings.length,maxPeak:Math.max(...readings.map(x=>x.peak))});
    };
    recorder.start();
    city.setVolumes({masterVolume:.82,musicVolume:.48,dialogueVolume:.9});
    await measure('rain-traffic-radio',1500,()=>{city.setEnvironment({inside:false,heat:0});city.startRadio();});
    await measure('engine-inside',1500,()=>{city.setEnvironment({inside:true,heat:0});city.updateVehicle({inside:true,speed:18,throttle:.8});});
    await measure('gun-pursuit-dialogue',1500,()=>{city.setEnvironment({inside:false,heat:3});city.play('gunPistol');city.play('siren');city.play('voice');});
    await measure('master-muted',900,()=>{a.applySetting('masterVolume',0);a.applySetting('musicVolume',.33);a.applySetting('dialogueVolume',.85);city.updateVehicle({inside:false,speed:0,throttle:0});city.play('gunPistol');});
    recorder.stop();await new Promise(resolve=>recorder.onstop=resolve);
    city.master.disconnect(dest);city.master.disconnect(analyser);
    const blob=new Blob(chunks,{type:'audio/webm'}),dataURL=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
    return {state:c.state,sampleRate:c.sampleRate,mimeType:blob.type,bytes:blob.size,segments,reporterAnnouncement:(city.setProgram('payroll-investigation'),city.announcement()),brokerAnnouncement:(city.setProgram('contractor-expansion'),city.announcement()),dataURL};
  });
  const audioBytes=Buffer.from(capture.dataURL.split(',')[1],'base64');delete capture.dataURL;
  await writeFile(`${output}/mix.webm`,audioBytes);
  assert.equal(capture.state,'running');assert.ok(capture.bytes>1000);assert.ok(capture.segments[2].maxRms>capture.segments[3].maxRms*5,'Master mute should reduce audible output');
  assert.notEqual(capture.reporterAnnouncement,capture.brokerAnnouncement);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="newGame"]').waitFor({state:'visible',timeout:90000});
  const persisted=await page.evaluate(()=>({master:window.__exitWounds.app.settings.masterVolume,music:window.__exitWounds.app.settings.musicVolume,dialogue:window.__exitWounds.app.settings.dialogueVolume}));
  assert.deepEqual(persisted,{master:0,music:.33,dialogue:.85});assert.deepEqual(errors,[]);
  const report={status:'passed',browser:browser.version(),capture,persisted,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:'passed',bytes:capture.bytes,segments:capture.segments,persisted,output}));
}catch(error){await writeFile(`${output}/report.json`,JSON.stringify({status:'failed',error:error.stack,errors},null,2));console.error(error.stack);process.exitCode=1;}
finally{await context.close();await browser.close();}
