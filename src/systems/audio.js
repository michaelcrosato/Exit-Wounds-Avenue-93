/** Original procedural sound design. Every voice is generated locally; playback needs one user gesture. */
export class CityAudio {
  constructor() {
    this.ctx=null;this.master=null;this.music=null;this.dialogue=null;this.effects=null;
    this.rain=null;this.traffic=null;this.engine=null;this.engineGain=null;this.engineFilter=null;this.engineHigh=null;this.engineHighGain=null;this.tireSource=null;this.tireGain=null;
    this.radioTimer=null;this.rainTimer=null;this.lastFootstep=0;
    this.settings={masterVolume:.82,musicVolume:.48,dialogueVolume:.9};
    this.radioOn=false;this.pressure=0;this.program='local-evening';this.onAnnouncement=null;
  }
  async unlock(){
    if(!this.ctx){
      const C=window.AudioContext||/** @type {any} */(window).webkitAudioContext;
      if(!C)return false;
      const c=this.ctx=new C();
      this.master=c.createGain();this.master.connect(c.destination);
      this.effects=c.createGain();this.effects.connect(this.master);
      this.music=c.createGain();this.music.connect(this.master);
      this.dialogue=c.createGain();this.dialogue.connect(this.master);
      this.setVolumes(this.settings);
      this.startCity();
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
    return this.ctx.state==='running';
  }
  setVolumes(values={}){
    Object.assign(this.settings,values);
    if(!this.ctx)return;
    const s=this.settings,t=this.ctx.currentTime;
    this.master.gain.setTargetAtTime(Number(s.masterVolume??.82),t,.04);
    this.effects.gain.setTargetAtTime(1,t,.04);
    this.music.gain.setTargetAtTime(Number(s.musicVolume??.48),t,.04);
    this.dialogue.gain.setTargetAtTime(Number(s.dialogueVolume??.9),t,.04);
  }
  noiseBuffer(duration=2){
    const c=this.ctx,b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    return b;
  }
  noise({duration=.2,volume=.1,lowpass=1000,highpass=0,attack=.004,release=.15,pan=0,bus='effects'}={}){
    if(!this.ctx)return;
    const c=this.ctx,t=c.currentTime,src=c.createBufferSource();src.buffer=this.noiseBuffer(Math.max(duration,.02));
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=lowpass;
    const gain=c.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+duration+release);
    src.connect(filter);
    let node=filter;
    if(highpass){const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=highpass;node.connect(hp);node=hp;}
    const panner=c.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));node.connect(panner);panner.connect(gain);gain.connect(this[bus]||this.effects);
    src.start(t);src.stop(t+duration+release+.02);
  }
  tone({frequency=440,endFrequency=frequency,type='sine',duration=.15,volume=.1,attack=.004,pan=0,bus='effects'}={}){
    if(!this.ctx)return;
    const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type=type;o.frequency.setValueAtTime(Math.max(1,frequency),t);o.frequency.exponentialRampToValueAtTime(Math.max(1,endFrequency),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    p.pan.value=pan;o.connect(p);p.connect(g);g.connect(this[bus]||this.effects);o.start(t);o.stop(t+duration+.02);
  }
  play(name,{pan=0,intensity=1,surface='asphalt'}={}){
    if(!this.ctx||this.ctx.state!=='running')return;
    const v=Math.max(.1,Math.min(2,intensity));
    switch(name){
      case 'select':this.tone({frequency:660,endFrequency:470,type:'triangle',duration:.08,volume:.055});break;
      case 'confirm':this.tone({frequency:350,endFrequency:520,type:'sine',duration:.18,volume:.08});break;
      case 'error':this.tone({frequency:170,endFrequency:112,type:'triangle',duration:.23,volume:.09});break;
      case 'step':
        if(surface==='wood'){
          this.noise({duration:.023,release:.065,volume:.048*v,lowpass:720,highpass:110,pan});
          this.tone({frequency:185,endFrequency:115,type:'triangle',duration:.075,volume:.026*v,pan});
        }else if(surface==='concrete'||surface==='interior'){
          this.noise({duration:.018,release:.055,volume:.063*v,lowpass:1700,highpass:300,pan});
        }else this.noise({duration:.03,release:.1,volume:.066*v,lowpass:510,pan});
        break;
      case 'vault':this.noise({duration:.15,release:.18,volume:.08*v,lowpass:650,pan});this.tone({frequency:120,endFrequency:65,duration:.18,volume:.04*v,pan});break;
      case 'door':this.noise({duration:.17,release:.1,volume:.1*v,lowpass:550,pan});this.tone({frequency:92,endFrequency:65,duration:.23,volume:.08*v,pan});break;
      case 'gunPistol':this.noise({duration:.06,release:.31,volume:.42*v,lowpass:4300,highpass:160,pan});this.tone({frequency:160,endFrequency:52,type:'triangle',duration:.23,volume:.2*v,pan});break;
      case 'gunSmg':this.noise({duration:.04,release:.2,volume:.26*v,lowpass:3600,highpass:200,pan});this.tone({frequency:190,endFrequency:70,type:'triangle',duration:.13,volume:.13*v,pan});break;
      case 'reload':this.noise({duration:.032,release:.07,volume:.12*v,lowpass:2400,pan});setTimeout(()=>this.tone({frequency:1100,endFrequency:680,duration:.045,volume:.05*v,pan}),260);break;
      case 'hit':this.noise({duration:.08,release:.15,volume:.18*v,lowpass:1100,pan});break;
      case 'ricochet':this.noise({duration:.025,release:.12,volume:.1*v,lowpass:5200,highpass:1200,pan});this.tone({frequency:1450,endFrequency:520,type:'triangle',duration:.15,volume:.045*v,pan});break;
      case 'carImpact':this.noise({duration:.14,release:.34,volume:.3*v,lowpass:900,pan});this.tone({frequency:100,endFrequency:32,duration:.28,volume:.16*v,pan});break;
      case 'skid':this.noise({duration:.19,release:.09,volume:.13*v,lowpass:3400,highpass:850,pan});break;
      case 'horn':this.tone({frequency:172,endFrequency:166,type:'sawtooth',duration:.36,volume:.095*v,pan});break;
      case 'siren':this.tone({frequency:700,endFrequency:440,type:'triangle',duration:.62,volume:.12*v,pan});break;
      case 'phone':this.tone({frequency:760,endFrequency:760,type:'sine',duration:.12,volume:.065});setTimeout(()=>this.tone({frequency:980,endFrequency:980,duration:.12,volume:.065}),180);break;
      case 'cash':this.tone({frequency:620,endFrequency:890,type:'sine',duration:.17,volume:.07});break;
      case 'rainSplash':this.noise({duration:.04,release:.14,volume:.03*v,lowpass:2000,highpass:450,pan});break;
      case 'voice':this.noise({duration:.15,release:.15,volume:.035,lowpass:540,highpass:90,bus:'dialogue'});this.tone({frequency:142,endFrequency:128,type:'triangle',duration:.18,volume:.012,bus:'dialogue'});break;
    }
  }
  startCity(){
    if(!this.ctx||this.rain)return;
    const c=this.ctx;
    const rain=c.createBufferSource();rain.buffer=this.noiseBuffer(2.5);rain.loop=true;
    const rf=c.createBiquadFilter();rf.type='lowpass';rf.frequency.value=5200;
    const rg=c.createGain();rg.gain.value=.042;rain.connect(rf);rf.connect(rg);rg.connect(this.effects);rain.start();this.rain={source:rain,gain:rg};
    const traffic=c.createBufferSource();traffic.buffer=this.noiseBuffer(3);traffic.loop=true;
    const tf=c.createBiquadFilter();tf.type='lowpass';tf.frequency.value=160;
    const tg=c.createGain();tg.gain.value=.02;traffic.connect(tf);tf.connect(tg);tg.connect(this.effects);traffic.start();this.traffic={source:traffic,gain:tg};
    this.rainTimer=setInterval(()=>{if(c.state==='running')this.play('rainSplash',{intensity:.4+Math.random()*.5,pan:Math.random()*2-1});},500);
  }
  updateVehicle({speed=0,throttle=0,inside=false}={}){
    if(!this.ctx)return;
    const c=this.ctx,t=c.currentTime;
    if(inside&&!this.engine){
      const o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
      o.type='sawtooth';o.frequency.value=55;f.type='lowpass';f.frequency.value=150;g.gain.value=0;
      o.connect(f);f.connect(g);g.connect(this.effects);o.start();this.engine=o;this.engineGain=g;this.engineFilter=f;
      const high=c.createOscillator(),hg=c.createGain(),hf=c.createBiquadFilter();
      high.type='triangle';high.frequency.value=115;hg.gain.value=0;hf.type='lowpass';hf.frequency.value=900;
      high.connect(hf);hf.connect(hg);hg.connect(this.effects);high.start();this.engineHigh=high;this.engineHighGain=hg;
      const tire=c.createBufferSource(),tf=c.createBiquadFilter(),tg=c.createGain();
      tire.buffer=this.noiseBuffer(2);tire.loop=true;tf.type='bandpass';tf.frequency.value=740;tf.Q.value=.55;tg.gain.value=0;
      tire.connect(tf);tf.connect(tg);tg.connect(this.effects);tire.start();this.tireSource=tire;this.tireGain=tg;
    }
    if(this.engine){
      const target=inside?.05+.07*Math.min(1,Math.abs(throttle)) : 0;
      this.engineGain.gain.setTargetAtTime(target,t,.08);
      this.engine.frequency.setTargetAtTime(52+Math.min(95,Math.abs(speed)*1.4)+Math.abs(throttle)*42,t,.08);
      this.engineFilter.frequency.setTargetAtTime(125+Math.min(650,Math.abs(speed)*6)+Math.abs(throttle)*280,t,.1);
      this.engineHigh.frequency.setTargetAtTime(105+Math.min(260,Math.abs(speed)*3.2)+Math.abs(throttle)*110,t,.1);
      this.engineHighGain.gain.setTargetAtTime(inside?(.012+Math.abs(throttle)*.04):0,t,.08);
      this.tireGain.gain.setTargetAtTime(inside?Math.min(.035,Math.abs(speed)*.0006):0,t,.12);
    }
  }
  setEnvironment({inside=false,heat=0}={}){
    if(!this.ctx)return;
    const t=this.ctx.currentTime;
    this.rain?.gain.gain.setTargetAtTime(inside?.011:.042,t,.35);
    this.traffic?.gain.gain.setTargetAtTime(inside?.008:.02,t,.35);
    this.pressure=Math.max(0,Math.min(3,heat));
  }
  setProgram(program){this.program=program||'local-evening';}
  announcement(){
    return ({'payroll-investigation':'An inquiry has opened into withheld Morrow Ward wages. Workers are asking who approved the transfers.','contractor-expansion':'Northline has taken a new market lease. Several stalls will close before the next shift.','local-evening':'Rain is moving across Calder Bay. Ferry service is on time; take care under the old line.'})[this.program]||'Stay with Morrow Ward radio for the evening service.';
  }
  startRadio(){
    if(this.radioTimer||!this.ctx)return;
    this.radioOn=true;
    const scale=[0,3,5,7,10],base=[130.81,146.83,164.81,146.83];let beat=0;
    this.radioTimer=setInterval(()=>{
      if(!this.radioOn||this.ctx?.state!=='running')return;
      const chord=base[Math.floor(beat/16)%base.length],note=scale[[0,2,1,3,0,4,2,1][beat%8]];
      const hz=chord*Math.pow(2,note/12);
      this.tone({frequency:hz,endFrequency:hz,type:'triangle',duration:.3,volume:.045,bus:'music'});
      if(beat%4===0)this.tone({frequency:55,endFrequency:42,type:'sine',duration:.35,volume:.08,bus:'music'});
      if(beat%2===0)this.noise({duration:.025,release:.08,volume:.019,lowpass:1500,bus:'music'});
      if(this.pressure>0&&beat%4===2)this.tone({frequency:65,endFrequency:48,type:'triangle',duration:.22,volume:.025*this.pressure,bus:'music'});
      if(beat>0&&beat%64===0){this.tone({frequency:520,endFrequency:750,type:'sine',duration:.28,volume:.045,bus:'music'});this.onAnnouncement?.(this.announcement());}
      beat++;
    },330);
  }
  stopRadio(){this.radioOn=false;clearInterval(this.radioTimer);this.radioTimer=null;}
  footstep(now,speed,surface='asphalt'){if(now<this.lastFootstep)this.lastFootstep=-1000;if(now-this.lastFootstep<(speed>3.5?.27:.42))return;this.lastFootstep=now;this.play('step',{surface,intensity:Math.min(1.3,.6+speed*.12)});}
  dispose(){this.stopRadio();clearInterval(this.rainTimer);this.ctx?.close();this.ctx=null;}
}
