import {bootEngine} from './engine/world.js';
import {ACTION_MAP} from './engine/input.js';
import {m,metres,yawQuaternion} from './engine/units.js';
import {createDistrict} from './world/district.js';
import {nearbyInteractions,SPAWN_POINTS} from './world/interactions.js';
import {TrafficSystem} from './world/traffic.js';
import {PedestrianSystem} from './world/pedestrians.js';
import {PlayerActor} from './actors/player.js';
import {CompanionActor} from './actors/companion.js';
import {CoverController} from './actors/cover.js';
import {AnimationSystem} from './actors/animation.js';
import {CrewSystem} from './actors/crew.js';
import {PoliceActors} from './actors/police.js';
import {createContacts} from './actors/contacts.js';
import {GameInterface} from './ui/interface.js';
import {CityAudio} from './systems/audio.js';
import {createGameState,restoreGameState,createReplayState} from './game/state.js';
import {createEvent} from './game/events.js';
import {SeededRng} from './game/rng.js';
import {SaveStore,SettingsStore} from './game/save.js';
import {CheckpointManager} from './mission/checkpoints.js';
import {MissionDirector} from './mission/director.js';
import {PHASES} from './mission/definition.js';
import {DIALOGUE,MESSAGES,contactResponse} from './mission/dialogue.js';
import {CombatSystem,WEAPONS,selectAimAssistTarget} from './systems/combat.js';
import {CrimeSystem} from './systems/crime.js';
import {WantedSystem} from './systems/wanted.js';
import {EconomySystem} from './systems/economy.js';

const DEFAULT_SETTINGS={quality:'high',brightness:1,hudScale:1,subtitleScale:1,sensitivity:1,invertY:'false',aimMode:'hold',sprintMode:'hold',shake:.5,masterVolume:.82,musicVolume:.48,dialogueVolume:.9};
const VEHICLE_SEATS=['driver','passenger','rearLeft','rearRight'];
const PHASE_DESTINATIONS={INTRO:{x:106,y:307},COLLECTION:{x:113,y:216},APPROACH:{x:348,y:164},RECOVERY:{x:324,y:83},EXTRACTION:{x:348,y:164},DECISION:{x:272,y:354},AFTERMATH:{x:94,y:306}};
const bool=v=>v===true||v==='true';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const held=(frame,key)=>frame?.held?.has(key)||false;
const pressed=(frame,key)=>frame?.pressed?.has(key)||false;

function storageOrMemory(){
  try{const storage=window.localStorage;const test='ewa93.storage.test';storage.setItem(test,'1');storage.removeItem(test);return {storage,persistent:true};}
  catch{const data=new Map();return {storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},persistent:false};}
}

class ExitWoundsGame {
  constructor(){
    this.ui=new GameInterface(document.getElementById('interface'),(action,payload)=>this.action(action,payload));
    this.audio=new CityAudio();
    this.audio.onAnnouncement=text=>{if(this.state&&this.ui.screen==='playing'&&!this.dialogue.length&&!this.dialogueCurrent)this.queueLine('Morrow Radio',text,6.2);};
    const {storage,persistent}=storageOrMemory();this.persistentStorage=persistent;
    this.saveStore=new SaveStore(storage);this.settingsStore=new SettingsStore(storage);
    this.settings={...DEFAULT_SETTINGS,...(this.settingsStore.load().settings||{})};
    this.audio.setVolumes(this.settings);
    document.documentElement.style.setProperty('--picture-brightness',String(this.settings.brightness));
    this.runtime=null;this.state=null;this.director=null;this.checkpoints=null;this.wanted=null;this.crime=null;this.combat=null;this.economy=null;
    this.dialogue=[];this.dialogueTimer=0;this.dialogueCurrent=null;this.lastDialogueId=null;this.eventSequence=0;this.lastHUD=0;this.lastShot=0;this.lastSkidAt=-1000;this.lastFiredTick=-1000;this.fireBurstCount=0;this.lastGunfireReportTick=-1000;this.wheelOpen=false;this.pendingConfirmation=null;
    this.settingsFrom='title';this.creditsFrom='title';this.phoneDetail='';this.pointerLockedOnce=false;this.wasConnected=false;this.unknownPadWarned=false;this.toggledAim=false;this.toggledSprint=false;this.currentRebindDevice='keyboard';this.waitingBinding=null;this.previousRawButtons=new Set();
    this.error=null;this.started=false;this.interaction=null;this.initialVehicleSnapshots=[];this.initialCrewSnapshots=[];this.initialPoliceSnapshots=[];this.titleTime=0;this.policeDriverAssigned=new Set();this.roadblockSet=false;this.surrenderHeld=0;this.dodgeUntil=0;this.dodgeDirection=null;this.vaultState=null;this.lastDisabledPromptCar=null;this.junCoverUntil=0;this.wheelVector={x:0,y:0};
    this.sessionEnvironment=`${navigator.userAgent} · ${navigator.platform||'browser'}`;
    this.attachBrowserEvents();
  }
  async boot(){
    try{
      this.ui.show('loading',{message:'Warming the city'});
      const runtime=this.runtime=await bootEngine({canvas3d:'view',canvasHud:'screen',settings:this.settings});
      const {E,world,queries,vehicles}=runtime;
      this.district=createDistrict({E,world});
      this.player=new PlayerActor({E,world,position:SPAWN_POINTS.player});queries.register(this.player.actor.body,this.player.actor);
      this.cover=new CoverController({covers:this.district.cover,queries,onMessage:message=>this.ui.announce(message)});
      this.jun=new CompanionActor({E,world,queries,position:SPAWN_POINTS.jun,footGraph:this.district.footGraph,cover:this.district.cover,onStuck:data=>this.onJunStuck(data)});queries.register(this.jun.actor.body,this.jun.actor);
      this.contacts=createContacts(E,world);for(const actor of this.contacts)queries.register(actor.body,actor);
      this.crew=new CrewSystem({E,world,queries,footGraph:this.district.footGraph,cover:this.district.cover,onShot:shot=>this.hostileShot(shot),onDown:id=>this.crewDown(id),onBark:line=>this.queueLine('Crew',line)});
      this.police=new PoliceActors({E,world,queries,footGraph:this.district.footGraph,vehicles,wanted:{state:{wanted:{tier:0}}},onShot:shot=>this.hostileShot(shot),onArrest:()=>this.arrest(),onNotice:message=>this.ui.announce(message)});
      this.makeVehicles();
      this.pedestrians=new PedestrianSystem({E,world,footGraph:this.district.footGraph,queries,count:24});
      this.traffic=new TrafficSystem({E,world,roadGraph:this.district.roadGraph,vehicles,queries,count:12,onCrime:event=>this.onTrafficCrime(event)});
      this.animations=await AnimationSystem.load({E,world});this.registerAnimations();
      this.initialVehicleSnapshots=vehicles.snapshot();this.initialCrewSnapshots=this.crew.snapshot();this.initialPoliceSnapshots=this.police.snapshot();
      vehicles.onEvent=event=>this.onVehicleEvent(event);
      await runtime.prepare();
      runtime.start({update:dt=>this.update(dt),draw:()=>{},onError:error=>this.handleError(error)});
      this.started=true;this.showTitle();
    }catch(error){this.handleError(error);}
  }
  makeVehicles(){
    const v=this.runtime.vehicles;
    v.create({id:'mara-sedan',kind:'sedan',...SPAWN_POINTS.sedan});
    v.create({id:'yard-van',kind:'van',...SPAWN_POINTS.van});
    v.create({id:'waterfront-sedan',kind:'sedan',...SPAWN_POINTS.alternateCar});
    SPAWN_POINTS.patrols.forEach((p,i)=>v.create({id:`patrol-${i+1}`,kind:'cruiser',...p,locked:false}));
  }
  registerAnimations(){
    const animations=this.animations,vehicles=this.runtime.vehicles;
    animations.register(this.player.actor,{role:'mara',getState:()=>({health:this.state?.player.health??100,dead:(this.state?.player.health??100)<=0,crouched:this.player.crouched||!!(this.cover.active?.low&&!this.cover.canFire),inCover:this.player.inCover,peekSide:this.cover.peekSide,aiming:this.player.aiming&&(!this.cover.active||this.cover.canFire),aimPitch:this.runtime.camera.pitch,armed:this.player.weapon!=='unarmed',weapon:this.player.weapon,reloading:!!(this.state&&this.state.player.inventory.weapons[this.player.weapon]?.reloadEndTick>this.state.tick),seated:!!vehicles.occupant(this.player.actor),transition:vehicles.transitions.get(this.player.actor),exiting:vehicles.transitions.get(this.player.actor)?.kind==='exit',vault:!!this.vaultState,blocking:this.state?.player.combat.blocking,dodging:!!(this.state&&this.state.player.combat.dodgingUntilTick>this.state.tick),dodgeX:this.dodgeDirection?.x||0})});
    animations.register(this.jun.actor,{role:'jun',getState:()=>({health:this.state?.actors.jun.health??100,dead:false,seated:!!vehicles.occupant(this.jun.actor),transition:vehicles.transitions.get(this.jun.actor),exiting:vehicles.transitions.get(this.jun.actor)?.kind==='exit',vault:!!this.jun.vaultState,talking:this.dialogueCurrent?.speaker==='Jun'})});
    for(const enemy of this.crew.enemies)animations.register(enemy.actor,{role:'crew',getState:()=>({health:enemy.health,dead:enemy.health<=0,aiming:enemy.visible,armed:true,weapon:'pistol',inCover:!!enemy.coverId})});
    for(const officer of this.police.officers)animations.register(officer.actor,{role:'police',getState:()=>({health:this.state?.actors[officer.id]?.health??100,dead:(this.state?.actors[officer.id]?.health??100)<=0,aiming:officer.mode==='chase',armed:true,weapon:'pistol',seated:!!vehicles.occupant(officer.actor),transition:vehicles.transitions.get(officer.actor)})});
    for(const contact of this.contacts)animations.register(contact,{role:contact.id,getState:()=>({talking:this.dialogueCurrent?.speaker===(contact.id==='eli'?'Eli':'Bea')})});
    for(const pedestrian of this.pedestrians.actors)animations.register(pedestrian,{role:'resident'});
    for(const driver of this.traffic.actors)animations.register(driver,{role:'driver',getState:()=>({seated:!!vehicles.occupant(driver),transition:vehicles.transitions.get(driver)})});
  }
  sourceInfo(){
    const meta=/** @type {any} */(this.runtime?.metadata||{});
    return `Initial date: 2026-10-16 (first prompt known in this thread)\nSOURCE: Grand Theft Auto IV — Xbox 360, PlayStation 3 and PC\nGAME ENGINE: my-3d2dge ${meta.version||'0.46.1'}, build ${meta.build||'dev-build'}, commit ${meta.commit||'cfa866aa45474868350cad1a7fc015e612f9305f'}\nEnvironment: Ubuntu 26.04.1 LTS under WSL2; Chromium, Firefox and WebKit opening checks, with broader QA in progress\nModel and effort: GPT-6.1-Sol with Ultra for delegated implementation; root session model/effort not verified`;
  }
  attachBrowserEvents(){
    addEventListener('blur',()=>{this.runtime?.input.clear();if(this.ui.screen==='playing')this.pause('Window lost focus.');else if(this.ui.screen==='wheel'){this.ui.show('pause');this.ui.announce('Window lost focus.');}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.runtime?.input.clear();if(this.ui.screen==='playing')this.pause('Game paused while the tab is hidden.');else if(this.ui.screen==='wheel'){this.ui.show('pause');this.ui.announce('Game paused while the tab is hidden.');}}});
    document.addEventListener('pointerlockchange',()=>{
      if(document.pointerLockElement)this.pointerLockedOnce=true;
      else if(this.pointerLockedOnce&&this.ui.screen==='playing'){this.runtime?.input.clear();this.pause('Mouse look released.');}
      else if(this.pointerLockedOnce&&this.ui.screen==='wheel'){this.runtime?.input.clear();this.ui.show('pause');this.ui.announce('Mouse look released.');}
    });
    document.getElementById('stage').addEventListener('click',e=>{
      if(this.ui.screen!=='playing'||(e.target instanceof Element&&e.target.closest('button')))return;
      if(e.pointerType==='mouse'&&document.pointerLockElement!==document.getElementById('screen'))document.getElementById('screen').requestPointerLock?.();
      this.audio.unlock();
    });
  }
  showTitle(){
    const loaded=this.saveStore.load();
    this.ui.show('title',{canContinue:loaded.ok||loaded.backupAvailable,recoverBackup:!loaded.ok&&loaded.backupAvailable,storageWarning:this.persistentStorage?'':'Browser storage is unavailable. Progress lasts only this session.'});
    this.runtime?.input.clear();
    this.audio.stopRadio();
  }
  action(name,payload){
    try{
      if(name!=='settingChanged'&&name!=='resume')this.audio.unlock().catch(()=>{});
      if(!name.startsWith('rebind:'))this.audio.play('select');
      switch(name){
        case 'continue':this.continueGame();break;
        case 'newGame':{
          if(this.hasSavedData()){this.confirm('Start a new game?','This replaces existing saved data, including any recoverable backup.',()=>this.newGame());}
          else this.newGame();break;
        }
        case 'confirmYes':{const action=this.pendingConfirmation;this.pendingConfirmation=null;action?.();break;}
        case 'confirmNo':{this.pendingConfirmation=null;this.returnFromConfirm();break;}
        case 'resume':this.resume();break;
        case 'pause':this.pause();break;
        case 'openSettings':this.settingsFrom=this.ui.screen;this.ui.show('settings',{settings:this.settings});break;
        case 'settingsBack':this.settingsFrom==='title'?this.showTitle():this.ui.show(this.settingsFrom==='playing'?'pause':this.settingsFrom);break;
        case 'openControls':this.ui.show('controls');break;
        case 'controlsBack':this.ui.show('settings',{settings:this.settings});break;
        case 'openRebind':this.currentRebindDevice='keyboard';this.showRebind();break;
        case 'openControllerRebind':this.currentRebindDevice='controller';this.showRebind();break;
        case 'rebindKey':this.rebindKey(payload?.code);break;
        case 'rebindBack':this.ui.show('controls');break;
        case 'resetBindings':this.resetBindings();break;
        case 'openCredits':this.creditsFrom=this.ui.screen;this.ui.show('credits',{sourceInfo:this.sourceInfo()});break;
        case 'creditsBack':this.creditsFrom==='title'?this.showTitle():this.ui.show(this.creditsFrom==='playing'?'pause':this.creditsFrom);break;
        case 'openPhone':this.openPhone();break;
        case 'closePhone':this.resume();break;
        case 'phoneJob':{
          const transcript=(DIALOGUE[this.lastDialogueId]||[]).map(line=>`${line.speaker}: ${line.text}`).join('\n');
          this.phoneDetail=`${this.director?.objective||'Meet Eli in the garage.'}${transcript?'\n\nLast conversation:\n'+transcript:''}`;this.openPhone();break;
        }
        case 'phoneMessages':this.phoneDetail=(this.state?.mission.messages||[]).map(id=>`${MESSAGES[id]?.from||'Unknown'}: ${MESSAGES[id]?.text||id}`).join('\n')||'No new messages.';this.openPhone();break;
        case 'phoneEli':this.phoneDetail=this.state?contactResponse(this.state,'eli'):'Eli runs the garage.';this.openPhone();break;
        case 'phoneBea':this.phoneDetail=this.state?contactResponse(this.state,'bea'):'Bea has the collection address.';this.openPhone();break;
        case 'phoneReplay':if(this.lastDialogueId){this.dialogue=[];this.dialogueCurrent=null;this.dialogueTimer=0;this.queueDialogue(this.lastDialogueId);}this.resume();break;
        case 'openMap':this.openMap();break;
        case 'closeMap':this.resume();break;
        case 'chooseReporter':this.chooseEnding('reporter');break;
        case 'chooseBroker':this.chooseEnding('broker');break;
        case 'closeDecision':this.resume();break;
        case 'chooseWeapon':this.chooseWeapon('unarmed');break;
        case 'chooseWeaponPistol':this.chooseWeapon('pistol');break;
        case 'chooseWeaponSmg':this.chooseWeapon('smg');break;
        case 'closeWheel':this.resume();break;
        case 'restartCheckpoint':this.confirm('Restart checkpoint?','Progress since the last safe checkpoint will be lost.',()=>this.retryCheckpoint());break;
        case 'retryCheckpoint':this.retryCheckpoint();break;
        case 'restartMission':this.confirm('Restart mission?','This begins a fresh run in Eli’s garage.',()=>this.newGame());break;
        case 'quitToTitle':this.confirm('Return to title?','Your most recent checkpoint remains saved.',()=>this.showTitle());break;
        case 'replayMission':this.confirm('Replay the mission?','A new run starts with the original inventory and a new run ID.',()=>this.replayMission());break;
        case 'endingContinue':this.resume();break;
        case 'retryError':if(this.backupAvailable){this.backupAvailable=false;this.continueGame(true);}else window.location.reload();break;
        case 'errorBack':this.showTitle();break;
        case 'settingChanged':this.applySetting(payload?.name,payload?.value);break;
        default:if(name.startsWith('rebind:')){this.waitingBinding=name.slice(7);this.previousRawButtons=this.rawButtons();this.showRebind();}
      }
    }catch(error){this.handleError(error);}
  }
  confirm(title,message,callback){this.confirmFrom=this.ui.screen;this.confirmContext=this.ui.context;this.pendingConfirmation=callback;this.ui.show('confirm',{title,message});}
  returnFromConfirm(){if(this.confirmFrom==='title')this.showTitle();else this.ui.show(this.confirmFrom||'pause',this.confirmContext||{});}
  hasSavedData(){try{return this.saveStore.storage.getItem(this.saveStore.key)!==null||this.saveStore.storage.getItem(this.saveStore.backupKey)!==null;}catch{return true;}}
  applySetting(name,value){
    if(!name)return;this.settings[name]=value;
    const saved=this.settingsStore.save(this.settings);if(!saved.ok)this.ui.announce('Settings could not be saved.');
    if(this.runtime){
      this.runtime.camera.settings.sensitivity=Number(this.settings.sensitivity);
      this.runtime.camera.settings.invertY=bool(this.settings.invertY);
      this.runtime.camera.shakeStrength=Number(this.settings.shake);
      this.runtime.input.options.sensitivity=Number(this.settings.sensitivity);
      this.runtime.world.res=this.settings.quality==='low'?'balanced':'full';
      this.runtime.world.shadows=this.settings.quality!=='low';
    }
    this.audio.setVolumes(this.settings);
    document.documentElement.style.setProperty('--picture-brightness',String(this.settings.brightness));
    this.ui.setHUD({hudScale:Number(this.settings.hudScale),subtitleScale:Number(this.settings.subtitleScale)});
  }
  resetBindings(){this.runtime?.input.engine.resetBindings();this.runtime?.input.clear();this.ui.announce('Default bindings restored.');this.ui.show('controls');}
  bindingRows(){
    const actions=['up','down','left','right','sprint','jump','crouch','aim','fire','reload','cover','interact','wheel','shoulder','phone','map','throttle','brake','handbrake','horn','radio'];
    const map=this.runtime?.input.engine.map||ACTION_MAP;
    return Object.fromEntries(actions.map(action=>[action,(map[action]||ACTION_MAP[action]||[]).filter(code=>this.currentRebindDevice==='controller'?code.startsWith('Pad'):!code.startsWith('Pad')).join(' / ')||'Unbound']));
  }
  showRebind(){this.ui.show('rebind',{bindings:this.bindingRows(),device:this.currentRebindDevice,waiting:this.waitingBinding});}
  rawButtons(){const values=this.runtime?.input.engine.padValues||[];return new Set(values.map((value,index)=>value>.55?index:-1).filter(index=>index>=0));}
  rebindKey(code){
    if(!this.waitingBinding)return;
    if(code==='Escape'){this.waitingBinding=null;this.showRebind();return;}
    if(this.currentRebindDevice!=='keyboard')return;
    const result=this.runtime.input.rebind(this.waitingBinding,'keyboard',code);
    this.ui.announce(typeof result==='string'?`${code} was also used by ${result}; bindings were exchanged.`:`${this.waitingBinding} bound to ${code}.`);
    this.waitingBinding=null;this.showRebind();
  }
  newGame(existing=null){
    if(!this.runtime)return;
    const cleared=this.saveStore.clear({confirmed:true});
    if(!cleared.ok)this.ui.announce('Previous save could not be removed; this run may not persist.');
    this.state=existing||createGameState({seed:93,runId:`run-${Date.now().toString(36)}`});
    this.lastGunfireReportTick=-1000;this.lastFiredTick=-1000;this.fireBurstCount=0;this.lastDisabledPromptCar=null;
    this.state.player.position={x:SPAWN_POINTS.player.x,y:SPAWN_POINTS.player.y,z:SPAWN_POINTS.player.z||0};
    this.buildDomain();
    this.restoreVisualsToInitial();
    this.checkpoints=new CheckpointManager(this.state);
    this.syncState();this.captureCheckpoint('new-run');
    this.dialogue=[];this.dialogueCurrent=null;this.dialogueTimer=0;this.lastDialogueId=null;this.queueDialogue('intro');this.ui.show('playing');this.runtime.input.clear();this.audio.startRadio();this.audio.play('confirm');
    this.runtime.camera.reset(this.player.actor,-Math.PI/2);
  }
  buildDomain(){
    this.wanted=new WantedSystem(this.state);this.crime=new CrimeSystem(this.state,this.wanted);
    this.director=new MissionDirector(this.state,{crime:this.crime,depotPosition:{x:348,y:124,z:0}});
    this.combat=new CombatSystem(this.state);this.economy=new EconomySystem(this.state,this.wanted);
    this.police.wanted=this.wanted;
    this.pedestrians.crime=this.crime;
    this.audio.setProgram(this.state.district.radio);
    this.rng=new SeededRng(this.state.seed);this.rng.restore(this.state.rngState);
  }
  restoreVisualsToInitial(){
    this.cancelVault();this.player.place(SPAWN_POINTS.player);this.player.setVehicle(null);this.player.setWeapon('pistol');this.cover.leave(this.player);
    this.jun.restore({position:SPAWN_POINTS.jun,mode:'cover',active:false,vehicleId:null,seat:null});
    this.crew.restore(this.initialCrewSnapshots);this.crew.active=false;this.crew.alerted=false;this.crew.sharedLastKnown=null;
    this.police.restore(this.initialPoliceSnapshots);this.policeDriverAssigned.clear();this.roadblockSet=false;
    this.runtime.vehicles.restore(this.initialVehicleSnapshots,this.actorMap());
    for(let i=1;i<=3;i++){const patrol=this.runtime.vehicles.get(`patrol-${i}`);patrol.locked=false;patrol.siren=false;}
    this.traffic.reset?.();this.pedestrians.reset?.();
    this.animations.reset();
    this.district.setEnding?.(null);
    this.syncPickupVisuals();
    this.state.actors.jun.position={...SPAWN_POINTS.jun};
  }
  replayMission(){const previous=this.state;const next=createReplayState(previous,`run-${Date.now().toString(36)}-replay`,93);this.newGame(next);}
  continueGame(useBackup=false){
    const loaded=this.saveStore.load({useBackup});
    if(!loaded.ok){this.ui.show('error',{title:loaded.reason==='missing'?'No saved game':'Could not read the save',message:loaded.backupAvailable?'A previous good checkpoint is available. Choose Retry to load it.':(loaded.message||loaded.reason)});this.backupAvailable=loaded.backupAvailable;return;}
    if(useBackup){const restored=this.saveStore.save(loaded.state,{replaceCorrupt:true});if(!restored.ok)this.ui.announce(`Backup loaded for this session; saving failed: ${restored.reason}`);}
    this.state=loaded.state;this.buildDomain();this.checkpoints=new CheckpointManager(this.state);this.checkpoints.setSnapshot(this.state);
    this.lastGunfireReportTick=this.state.tick-1000;this.lastFiredTick=this.state.tick-1000;this.fireBurstCount=0;this.lastDisabledPromptCar=null;
    this.restoreRuntimeFromState();this.dialogue=[];this.dialogueCurrent=null;this.dialogueTimer=0;this.lastDialogueId=PHASES[this.state.mission.phase]?.dialogueId||null;this.ui.show('playing');this.audio.startRadio();
  }
  restoreRuntimeFromState(){
    const s=this.state,actorMap=this.actorMap();
    this.cancelVault();
    this.player.restore({position:s.player.position,facing:s.player.rotation,weapon:s.player.inventory.equipped,seatedIn:null});this.cover.leave(this.player);
    this.jun.restore({position:s.actors.jun.position,mode:s.actors.jun.state,active:s.mission.junReached,vehicleId:null,seat:null,recoveryAttempts:s.actors.jun.recoveryAttempts||0,lastSafe:s.actors.jun.lastSafe||s.actors.jun.position});
    this.crew.restore(this.crew.enemies.map(e=>({id:e.id,position:s.actors[e.id]?.position||this.crew.positionOf(e),health:s.actors[e.id]?.health??e.health,state:s.actors[e.id]?.state||e.state,lastKnown:s.actors[e.id]?.lastKnown||null})));
    this.crew.active=['RECOVERY','EXTRACTION','EVASION'].includes(s.mission.phase);this.crew.alerted=s.district.crewMeta?.alerted??(this.crew.active&&s.mission.route==='gate');this.crew.sharedLastKnown=s.district.crewMeta?.sharedLastKnown||null;
    this.police.restore(this.police.officers.map(o=>({id:o.id,position:s.actors[o.id]?.position||this.police.position(o),mode:s.actors[o.id]?.state||'patrol',health:s.actors[o.id]?.health??100})));
    const vStates=Object.entries(s.vehicles).map(([id,v])=>({id,kind:this.runtime.vehicles.get(id)?.kind||'sedan',position:v.position,rotation:yawQuaternion(v.rotation),velocity:{x:m(v.velocity.x),y:m(v.velocity.y),z:m(v.velocity.z)},angularVelocity:{x:0,y:0,z:0},health:v.health,color:v.color,appearance:v.appearance,disabled:v.disabled,seats:VEHICLE_SEATS.map(key=>v.seats[key]||null)}));
    this.runtime.vehicles.restore(vStates,actorMap);
    this.traffic.restore(s.district.traffic);this.pedestrians.restore(s.district.pedestrians);
    this.policeDriverAssigned.clear();for(let i=1;i<=3;i++){const patrol=this.runtime.vehicles.get(`patrol-${i}`);if(patrol?.seats[0]?.id?.startsWith('officer-'))this.policeDriverAssigned.add(i);patrol.siren=i<=s.wanted.tier;patrol.locked=!!patrol?.seats[0]?.id?.startsWith('officer-');}
    this.player.setVehicle(s.player.vehicleId);
    if(s.actors.jun.vehicleId)this.jun.board(s.actors.jun.vehicleId,s.actors.jun.seat);
    this.district.setEnding?.(s.mission.ending);
    this.syncPickupVisuals();
    this.runtime.camera.reset(this.player.actor,s.player.rotation||-Math.PI/2);
    this.animations.reset();
  }
  actorMap(){const result=new Map();result.set('mara',this.player.actor);result.set('jun',this.jun.actor);for(const actor of this.traffic?.actors||[])result.set(actor.id,actor);for(const officer of this.police?.officers||[])result.set(officer.id,officer.actor);return result;}
  syncPickupVisuals(){
    if(!this.state)return;
    const s=this.state;
    this.district.setPickupCollected?.('toolbox',s.mission.favor!=='available');
    this.district.setPickupCollected?.('case',s.mission.caseRecovered||s.mission.completed);
    this.district.setPickupCollected?.('depot-ammo',s.player.inventory.pickups.includes('depot-ammo'));
    this.district.setPickupCollected?.('depot-smg',s.player.inventory.pickups.includes('depot-smg'));
  }
  captureCheckpoint(id){
    if(!this.state||!this.checkpoints)return;
    this.syncState();
    this.state.district.traffic=this.traffic.snapshot();this.state.district.pedestrians=this.pedestrians.snapshot();
    this.state.district.crewMeta={alerted:this.crew.alerted,sharedLastKnown:this.crew.sharedLastKnown};
    const seatTransition=this.runtime.vehicles.transitions.size>0||!!this.vaultState||!!this.jun.vaultState;
    const result=this.checkpoints.capture(id,{seatTransition,commitInProgress:this.state.mission.phase==='HANDOFF'});
    if(!result.ok)return;
    const saved=this.saveStore.save(this.state,{seatTransition});
    if(!saved.ok&&saved.reason!=='corrupt-save-requires-choice')this.ui.announce(`Checkpoint unavailable: ${saved.reason}`);
    if(saved.reason==='corrupt-save-requires-choice')this.ui.show('error',{title:'Saved data is damaged',message:'A corrupt save will not be replaced without choosing New Game.'});
  }
  retryCheckpoint(){
    if(!this.checkpoints){this.showTitle();return;}
    this.checkpoints.retry();this.buildDomain();this.restoreRuntimeFromState();
    this.lastGunfireReportTick=this.state.tick-1000;this.lastFiredTick=this.state.tick-1000;this.fireBurstCount=0;this.lastDisabledPromptCar=null;
    this.dialogue=[];this.dialogueCurrent=null;this.dialogueTimer=0;this.lastDialogueId=PHASES[this.state.mission.phase]?.dialogueId||null;this.ui.show('playing');this.runtime.input.clear();this.audio.play('confirm');
  }
  pause(message=''){if(this.ui.screen!=='playing')return;document.exitPointerLock?.();this.runtime?.input.clear();this.ui.show('pause');if(message)this.ui.announce(message);}
  resume(){if(!this.state){this.showTitle();return;}this.runtime?.input.clear();this.ui.show('playing');}
  openPhone(){if(!this.state)return;this.runtime.input.clear();this.ui.show('phone',{job:this.director.objective,messagePreview:`${this.state.mission.messages.length} saved message(s)`,detail:this.phoneDetail,replayAvailable:!!this.lastDialogueId});this.audio.play('phone');}
  openMap(){if(!this.state)return;this.runtime.input.clear();this.ui.show('map',{objective:this.director.objective});requestAnimationFrame(()=>{const canvas=/** @type {HTMLCanvasElement|null} */(document.querySelector('#full-map'));if(canvas){canvas.width=900;canvas.height=550;this.ui.drawMap(canvas,{...this.ui.hudModel,position:this.player.position,destination:this.destination()});}});}
  queueLine(speaker,text,seconds=4.6){this.dialogue.push({speaker,text,seconds});}
  queueDialogue(id){this.lastDialogueId=id;for(const line of DIALOGUE[id]||[])this.queueLine(line.speaker,line.text,Math.max(3.3,Math.min(7.2,line.text.length/18)));}
  updateDialogue(dt){
    if(this.dialogueTimer>0){this.dialogueTimer-=dt;return;}
    this.dialogueCurrent=this.dialogue.shift()||null;
    this.dialogueTimer=this.dialogueCurrent?.seconds||0;
    if(this.dialogueCurrent)this.audio.play('voice');
  }
  dispatch(type,payload={},sourceId='mara',targetId=null,stableId=null){
    if(!this.director)return {ok:false,reason:'mission-unavailable'};
    const id=stableId||`${this.state.runId}:${type}:${this.state.tick}:${this.eventSequence++}`;
    const result=this.director.handle(createEvent(type,this.state.tick,sourceId,targetId,payload,id));
    if(result.ok){
      for(const event of result.events||[])if(event.type==='MissionPhaseChanged')this.onPhase(event.payload.phase); 
      if(['FavorStarted','FavorCompleted','CaseRecovered'].includes(type))this.syncPickupVisuals();
    }else this.ui.announce(this.humanReason(result.reason));
    return result;
  }
  onPhase(phase){
    const dialogueId={COLLECTION:'collection-drive',APPROACH:'depot-message',RECOVERY:null,EXTRACTION:'alarm',EVASION:'evasion',DECISION:'decision',AFTERMATH:'aftermath'}[phase];
    if(dialogueId)this.queueDialogue(dialogueId);
    if(phase==='RECOVERY')this.crew.start({route:this.state.mission.route,position:this.player.position});
    if(phase==='EXTRACTION'){this.audio.play('phone');this.ui.announce('Visible wired alarm: dispatch has the depot location.');}
    if(phase==='AFTERMATH')this.showEnding();
  }
  humanReason(code){return ({'not-at-collection-stage':'Meet Bea after accepting Eli’s job.','reach-jun-before-case':'Talk to Jun before opening the cabinet.','waiting-for-jun':'Wait for Jun to reach the car.','escape-not-clear':'Lose police sight and leave their search area.','wrong-handoff-location':'Take the case to the selected drop.','lose-police-before-handoff':'Lose the police before handing over the case.','insufficient-funds':'Not enough money.','police-can-see-vehicle':'Police can see this car. Lose sight first.','vehicle-unavailable':'That vehicle cannot be used.'})[code]||String(code||'Action unavailable.').replaceAll('-',' ');}
  destination(){
    const m=this.state?.mission;if(!m)return null;
    if(m.phase==='DECISION'&&m.choice)return m.choice==='broker'?{x:91,y:88}:{x:385,y:358};
    if(m.phase==='HANDOFF')return m.choice==='broker'?{x:91,y:88}:{x:385,y:358};
    return PHASE_DESTINATIONS[m.phase]||null;
  }
  chooseEnding(ending){
    if(this.director?.chooseEnding(ending).ok){this.ui.announce(ending==='broker'?'Broker drop marked · $1,200':'Reporter drop marked · $600');this.captureCheckpoint('decision');this.resume();}
  }
  chooseWeapon(name){
    const result=this.combat?.equip(name);if(result?.ok){this.player.setWeapon(name);this.ui.announce(`${name.toUpperCase()} equipped`);this.resume();}
    else this.ui.announce(this.humanReason(result?.reason));
  }
  showEnding(){
    const broker=this.state.mission.ending==='broker';
    this.district.setEnding?.(this.state.mission.ending);
    this.audio.setProgram(this.state.district.radio);
    this.queueDialogue(broker?'broker-handoff':'reporter-handoff');
    this.ui.show('ending',{title:broker?'The price of silence':'Names in print',summary:broker?'The contractor takes the market lease. Jun leaves alive, carrying the names with him.':'A wage investigation opens. Jun leaves alive, and the market has a reason to hope.',message:MESSAGES[broker?'broker-ending':'reporter-ending'].text,payment:broker?1200:600});
    this.audio.play('cash');
  }
  update(dt){
    const r=this.runtime;if(!r)return;
    const frame=r.input.poll(this.state?.tick||r.world.n,dt);
    if(frame.connected&&frame.device==='gamepad'&&frame.mapping!=='standard'&&!this.unknownPadWarned){this.unknownPadWarned=true;this.ui.announce('Controller mapping is unrecognized. Open Controls to remap buttons.');}
    if(!frame.connected)this.unknownPadWarned=false;
    if(this.wasConnected&&!frame.connected&&this.ui.screen==='playing'){r.input.clear();this.pause('Controller disconnected. Connect it or use keyboard and resume.');}
    this.wasConnected=frame.connected;
    if(this.ui.screen!=='playing'){
      if(this.ui.screen==='rebind'&&this.waitingBinding&&this.currentRebindDevice==='controller'){
        const raw=this.rawButtons(),newButton=[...raw].find(index=>!this.previousRawButtons.has(index));this.previousRawButtons=raw;
        if(newButton!==undefined){
          const action=this.waitingBinding,result=r.input.rebind(action,'controller',`Pad${newButton}`);
          this.waitingBinding=null;this.showRebind();this.ui.announce(typeof result==='string'?`Button ${newButton} was also used by ${result}; bindings were exchanged.`:`${action} bound to button ${newButton}.`);
        }
        r.input.consume(frame);return;
      }
      if(this.ui.screen==='wheel'){
        if(Math.hypot(frame.lookX,frame.lookY)>.45){
          const index=frame.lookY>.45?0:frame.lookX<-.35?1:2;
          this.ui.setFocus(index);
        }
        this.wheelVector.x+=frame.mouseX||0;this.wheelVector.y+=frame.mouseY||0;
        if(Math.hypot(this.wheelVector.x,this.wheelVector.y)>20){const index=this.wheelVector.y>25?0:this.wheelVector.x<0?1:2;this.ui.setFocus(index);}
        if(frame.released.has('wheel')){this.ui.activateFocused();r.input.consume(frame);return;}
      }
      this.ui.handleFrame(frame);r.input.consume(frame);
      if(this.ui.screen==='title'||this.ui.screen==='loading')this.titleCamera(dt);
      return;
    }
    if(!this.state)return;
    if(pressed(frame,'pause')||pressed(frame,'start')){this.pause();return;}
    if(pressed(frame,'phone')){this.openPhone();return;}
    if(pressed(frame,'map')){this.openMap();return;}
    if(pressed(frame,'wheel')){this.wheelVector={x:0,y:0};this.ui.show('wheel',{weapons:this.state.player.inventory.weapons});return;}
    this.applyToggleControls(frame);
    const s=this.state;s.tick++;s.elapsed+=dt;
    const occupant=r.vehicles.occupant(this.player.actor),vehicle=occupant?.vehicle||null;
    if(vehicle){
      r.vehicles.setControl(vehicle,{throttle:frame.throttle,brake:frame.brake,moveX:frame.moveX,handbrake:held(frame,'handbrake')});
      if(held(frame,'handbrake')&&Math.abs(vehicle.speed)>m(4)&&s.elapsed-this.lastSkidAt>.35){this.audio.play('skid',{intensity:Math.min(1.5,Math.abs(vehicle.speed)/m(12))});this.lastSkidAt=s.elapsed;}
      if(pressed(frame,'horn'))this.audio.play('horn');
      if(pressed(frame,'radio')){if(this.audio.radioOn)this.audio.stopRadio();else this.audio.startRadio();this.ui.announce(this.audio.radioOn?'Local radio on':'Radio off');}
      if(pressed(frame,'interact')){const exit=r.vehicles.exit(this.player.actor);if(!exit.ok)this.ui.announce(this.humanReason(exit.reason));}
    }else if(this.vaultState){
      this.updateVault(dt);
    }else{
      if(pressed(frame,'cover'))this.cover.toggle(this.player);
      this.player.update(frame,dt,{camera:r.camera,aimYaw:r.camera.yaw,aimPitch:r.camera.pitch});
      this.cover.update(this.player,frame);
      const surrenderAvailable=this.police.safeSurrender&&this.state.player.inventory.equipped==='unarmed';
      if(surrenderAvailable&&held(frame,'interact')){
        this.surrenderHeld+=dt;
        if(this.surrenderHeld>=1){this.wanted.surrender({safe:true,holstered:true,heldSeconds:this.surrenderHeld});this.surrenderHeld=0;}
      }else this.surrenderHeld=0;
      if(pressed(frame,'interact')&&!surrenderAvailable)this.interact();
      if(pressed(frame,'reload')){const reload=this.combat.reload();if(reload.ok){this.audio.play('reload');this.animations.trigger(this.player.actor,'reload');}else if(reload.reason==='unarmed'&&held(frame,'aim')){
        const dodge=this.combat.dodge({x:frame.moveX,y:frame.moveY});if(dodge.ok){this.dodgeUntil=this.state.tick+45;this.dodgeDirection=dodge.direction;this.audio.play('vault');}
      }}
      if(this.state.player.inventory.equipped==='unarmed'){
        this.combat.block(held(frame,'aim'));
        if(pressed(frame,'fire'))this.melee();
      }else if(held(frame,'fire')){if(!this.cover.active||this.cover.canFire)this.fire();else if(pressed(frame,'fire'))this.ui.announce('Aim from cover when there is headroom.');}
      if(this.dodgeDirection&&s.tick<this.dodgeUntil){this.player.actor.vx=m(this.dodgeDirection.x*6.2);this.player.actor.vy=m(this.dodgeDirection.y*6.2);this.player.actor.anim={...(this.player.actor.anim||{}),flip:1-(this.dodgeUntil-s.tick)/45};}
    }
    this.jun.update(dt,{player:this.player.position,vehicle:vehicle?{position:vehicle.position}:null,combat:this.crew.active,visibleToPlayer:p=>this.isVisibleToPlayer(p),validRegroup:()=>this.district.spawnPoints.recover.depot});
    if(this.jun.mode==='cover'&&s.elapsed>this.junCoverUntil&&s.mission.junReached)this.jun.follow();
    this.crew.update(dt,{player:this.player.position,phase:s.mission.phase});
    this.pedestrians.update(dt,{playerPosition:this.player.position,vehicles:r.vehicles.list});
    this.traffic.update(dt,{playerPosition:this.player.position,pedestrians:this.pedestrians.positions});
    this.updatePoliceVehicles(dt);
    r.vehicles.preStep(dt);
    r.world.step(dt);
    r.vehicles.postStep(dt);
    this.animations.update(dt);
    this.district.update?.(dt,/** @type {any} */(this.player.position),this.traffic.time);
    r.camera.update(dt,frame,vehicle||this.player.actor,{vehicle,aiming:this.player.aiming});
    this.syncState();
    this.postPhysics(dt,frame);
    this.updateDialogue(dt);
    this.audio.updateVehicle({speed:vehicle?metres(vehicle.speed):0,throttle:frame.throttle,inside:!!vehicle});
    const position=this.player.position,inside=this.district.interiorVolumes.some(volume=>position.x>=volume.minX&&position.x<=volume.maxX&&position.y>=volume.minY&&position.y<=volume.maxY);
    this.audio.setEnvironment({inside,heat:s.wanted.tier});
    if(!vehicle){const speed=Math.hypot(this.player.actor.vx,this.player.actor.vy)/16;if(speed>.5)this.audio.footstep(s.elapsed,speed,this.district.surfaceAt?.(this.player.position)||'asphalt');}
    this.lastHUD-=dt;if(this.lastHUD<=0){this.updateHUD();this.lastHUD=.08;}
    if(s.mission.pendingCheckpoint&&r.vehicles.transitions.size===0&&!this.vaultState&&!this.jun.vaultState)this.captureCheckpoint(s.mission.checkpointId);
    if(s.mission.failure){this.ui.show('retry',{reason:s.mission.failure.reason,title:'The job is not over'});r.input.clear();}
  }
  applyToggleControls(frame){
    if(this.settings.aimMode==='toggle'&&pressed(frame,'aim'))this.toggledAim=!this.toggledAim;
    if(this.settings.sprintMode==='toggle'&&pressed(frame,'sprint'))this.toggledSprint=!this.toggledSprint;
    if(this.settings.aimMode==='toggle'){if(this.toggledAim)frame.held.add('aim');else frame.held.delete('aim');}
    if(this.settings.sprintMode==='toggle'){if(this.toggledSprint)frame.held.add('sprint');else frame.held.delete('sprint');}
  }
  titleCamera(dt){
    const world=this.runtime.world,t=this.titleTime+=dt,view=this.district.signatureViews.garage;
    const eye={x:view.eye.x+Math.sin(t*.22)*1.5,y:view.eye.y+Math.cos(t*.22)*1.2,z:view.eye.z+.3};
    const target=view.target,dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z;
    world.camera.set('fixed');world.camera.fixed={x:m(eye.x),y:m(eye.y),z:m(eye.z),yaw:Math.atan2(dy,dx),pitch:Math.atan2(dz,Math.hypot(dx,dy)),fov:62};world.camera.update(0);
  }
  updatePoliceVehicles(dt){
    const tier=this.state.wanted.tier,vehicles=this.runtime.vehicles;
    for(let i=1;i<=3;i++){
      const patrol=vehicles.get(`patrol-${i}`),officer=this.police.officers[(i-1)*2];
      if(vehicles.occupant(this.player.actor)?.vehicle===patrol)continue;
      const active=i<=tier;
      patrol.siren=active;
      if(officer.health<=0){vehicles.setControl(patrol,{throttle:0,brake:1});continue;}
      if(!active){vehicles.setControl(patrol,{throttle:0,brake:.7});continue;}
      if(!this.policeDriverAssigned.has(i)){
        patrol.locked=false;
        const entered=vehicles.enter(officer.actor,patrol.id,'driver');
        if(entered.ok){this.policeDriverAssigned.add(i);patrol.locked=true;}
      }
      if(!this.policeDriverAssigned.has(i))continue;
      if(!vehicles.occupant(officer.actor)){vehicles.setControl(patrol,{throttle:0,brake:1,handbrake:true});continue;}
      const target=i===3?{x:240,y:202,z:0}:this.state.wanted.visible?this.player.position:this.state.wanted.lastKnown||{x:348,y:124,z:0};
      const carPos=patrol.position;
      if(i===3&&distance(carPos,target)<5){
        if(!this.roadblockSet){patrol.body.setRotation(yawQuaternion(Math.PI/2),true);this.roadblockSet=true;}
        vehicles.setControl(patrol,{throttle:0,brake:1,handbrake:true});continue;
      }
      const from=this.district.nearestNode('road',carPos),to=this.district.nearestNode('road',target);
      const route=this.district.path('road',from?.id,to?.id)||[];
      const waypoint=route.find(node=>distance(node,carPos)>8)||target;
      const desired=Math.atan2(waypoint.y-carPos.y,waypoint.x-carPos.x);
      const angle=Math.atan2(Math.sin(desired-patrol.yaw),Math.cos(desired-patrol.y));
      const speed=metres(patrol.speed),far=distance(carPos,waypoint);
      vehicles.setControl(patrol,{steer:Math.max(-1,Math.min(1,angle*1.35)),throttle:far>7&&Math.abs(angle)<1.8?.45:0,brake:far<7||Math.abs(angle)>1.8?.65:0});
      if(this.state.tick%330===i*20&&distance(carPos,this.player.position)<100)this.audio.play('siren',{intensity:.6});
    }
  }
  postPhysics(dt,frame){
    const s=this.state,p=this.player.position;
    if(this.jun.active&&!this.jun.vehicleId&&s.player.vehicleId&&!this.runtime.vehicles.transitions.has(this.jun.actor)){
      const car=this.runtime.vehicles.get(s.player.vehicleId);
      if(car&&Math.abs(car.speed)<m(1.2)&&distance(this.jun.position,car.position)<4.5){
        const freeSeat=car.seats.findIndex((actor,index)=>index>0&&!actor);
        if(freeSeat>0){const board=this.runtime.vehicles.enter(this.jun.actor,car.id,freeSeat);if(board.ok)this.audio.play('door');}
      }
    }
    this.combat.tick(dt);
    this.crime.tick(dt);
    this.police.update(dt,{player:p,vehicleId:s.player.vehicleId,mission:s.mission,playerThreatening:held(frame,'fire')||s.wanted.tier>=3});
    const clearance=this.wanted.tick(dt,p);
    if(clearance.cleared&&s.mission.phase==='EVASION')this.dispatch('WantedCleared',{},'dispatch');
    if(this.jun.vehicleId){const junCar=this.runtime.vehicles.get(this.jun.vehicleId);if(junCar?.disabled){
      if(s.player.vehicleId===junCar.id&&this.lastDisabledPromptCar!==junCar.id){this.ui.announce('Vehicle disabled. Stop, exit, and lead Jun to another route.');this.lastDisabledPromptCar=junCar.id;}
      else if(!this.runtime.vehicles.transitions.has(this.jun.actor)){
        const exit=this.runtime.vehicles.exit(this.jun.actor);
        if(!exit.ok)this.dispatch('ActorFailed',{actorId:'jun',reason:'Jun cannot leave the disabled vehicle. Retry checkpoint.'},'jun');
      }
    }}
    if(s.mission.phase==='EXTRACTION'&&s.mission.junReached&&!s.mission.junExtracted){
      if(this.jun.vehicleId)this.dispatch('VehicleEntered',{actorId:'jun',vehicleId:this.jun.vehicleId,seat:this.jun.seat},'jun');
      else if(distance(this.jun.position,{x:348,y:124})>55&&distance(p,this.jun.position)<12)this.dispatch('CompanionExtracted',{onFoot:true},'jun');
    }
    if(s.player.position.x<10||s.player.position.x>470||s.player.position.y<10||s.player.position.y>410||this.player.actor.fell){this.player.recover();this.ui.announce('Returned to a safe street.');}
  }
  syncState(){
    if(!this.state)return;
    const s=this.state,r=this.runtime;
    s.player.position=this.player.position;s.player.rotation=this.player.actor.facing;
    const playerSeat=r.vehicles.occupant(this.player.actor);
    s.player.vehicleId=playerSeat?.vehicle.id||null;s.player.seat=playerSeat?VEHICLE_SEATS[playerSeat.seat]:null;
    const junSeat=r.vehicles.occupant(this.jun.actor);
    s.actors.jun.position=this.jun.position;s.actors.jun.vehicleId=junSeat?.vehicle.id||null;s.actors.jun.seat=junSeat?VEHICLE_SEATS[junSeat.seat]:null;s.actors.jun.recoveryAttempts=this.jun.recoveryAttempts;s.actors.jun.lastSafe=this.jun.lastSafe;if(!s.mission.completed)s.actors.jun.state=this.jun.mode;
    for(const e of this.crew.enemies)s.actors[e.id]={id:e.id,position:this.crew.positionOf(e),health:e.health,state:e.state,lastKnown:e.lastKnown,vehicleId:null,seat:null};
    for(const o of this.police.officers){const seat=r.vehicles.occupant(o.actor);s.actors[o.id]={id:o.id,position:this.police.position(o),health:o.health,state:o.mode,vehicleId:seat?.vehicle.id||null,seat:seat?VEHICLE_SEATS[seat.seat]:null};}
    for(const snap of r.vehicles.snapshot()){
      const v=r.vehicles.get(snap.id),seats={};VEHICLE_SEATS.forEach((key,i)=>{if(i<v.seats.length)seats[key]=snap.seats[i]||null;});
      s.vehicles[snap.id]={position:snap.position,rotation:v.yaw,velocity:{x:metres(snap.velocity.x),y:metres(snap.velocity.y),z:metres(snap.velocity.z)},health:snap.health,color:snap.color,appearance:snap.appearance??s.vehicles[snap.id]?.appearance??0,disabled:snap.disabled,seats};
    }
  }
  updateHUD(){
    const s=this.state;if(!s)return;
    const i=s.player.inventory,w=i.weapons[i.equipped];
    const nearby=this.nearestInteraction();this.interaction=nearby;
    let prompt=nearby?`${this.runtime.input.engine.lastDevice==='gamepad'?'△':'E'} · ${nearby.name}`:this.cover.active?'R1 / Q · Leave cover':'';
    if(this.police.safeSurrender&&i.equipped==='unarmed')prompt='Hold △ / E to surrender';
    const destination=this.destination();
    this.ui.setHUD({objective:this.director.objective,detail:s.mission.phase==='EVASION'?`${s.wanted.status} · ${s.wanted.visible?'police have sight':'leave the search area'}`:'',position:s.player.position,destination,health:s.player.health,armor:s.player.armor,money:s.player.wallet,weapon:i.equipped==='unarmed'?'Unarmed':WEAPONS[i.equipped].name,ammo:w?`${w.magazine} / ${w.reserve}`:'',heat:s.wanted.tier,search:s.wanted.tier?`${s.wanted.status} · ${Math.round(s.wanted.radius)} m area`:'',searchCenter:s.wanted.lastKnown,searchRadius:s.wanted.radius,prompt,subtitle:this.dialogueCurrent?.text||'',speaker:this.dialogueCurrent?.speaker||'',hudScale:Number(this.settings.hudScale),subtitleScale:Number(this.settings.subtitleScale)});
  }
  nearestInteraction(){
    const p=this.player.position,s=this.state;
    if(s.player.vehicleId)return null;
    const entries=nearbyInteractions(p,this.district.interactables).filter(e=>{
      if(e.id==='toolbox'&&s.mission.favor!=='available')return false;
      if(e.id==='toolbox-return'&&s.mission.favor!=='carrying')return false;
      if(e.id==='case'&&s.mission.caseRecovered)return false;
      if(e.id==='jun'&&s.mission.junReached)return false;
      if(e.id==='depot-ammo'&&s.player.inventory.pickups.includes(e.id))return false;
      if(e.id==='depot-smg'&&s.player.inventory.pickups.includes(e.id))return false;
      if(e.kind==='handoff'&&s.mission.phase!=='DECISION')return false;
      return true;
    });
    const car=this.runtime.vehicles.nearest(this.player.actor,3.2);
    if(car&&(!entries[0]||distance(p,car.position)<distance(p,entries[0])))return {id:car.id,name:`Enter ${car.kind}`,action:'enter-car',car};
    return entries[0]||null;
  }
  interact(){
    const e=this.nearestInteraction();if(!e)return;
    const s=this.state,m=s.mission;
    if(e.action==='enter-car'){
      if(e.car.seats[0]&&e.car.seats[0]!==this.player.actor){
        const theft=this.traffic.attemptTake(e.car,this.player.actor);
        this.ui.announce(theft.ok?'Driver is exiting. Stay by the door.':this.humanReason(theft.reason));
        return;
      }
      const result=this.runtime.vehicles.enter(this.player.actor,e.car.id,'driver');
      if(!result.ok)this.ui.announce(this.humanReason(result.reason));else this.audio.play('door');
      return;
    }
    this.animations.trigger(this.player.actor,'interact');
    switch(e.action){
      case 'talk-eli':
        if(m.phase==='INTRO'){this.dispatch('JobAccepted',{},'mara','eli',`${s.runId}:eli-accepted`);this.queueLine('Eli','Bea is by the market. You have the sedan. Bring Jun out if the story is true.');}
        else this.queueLine('Eli',contactResponse(s,'eli'));
        break;
      case 'talk-bea':
        if(m.phase==='COLLECTION'){this.queueDialogue('collection');this.dispatch('CollectionCompleted',{},'bea','mara',`${s.runId}:collection`);}
        else this.queueLine('Bea',contactResponse(s,'bea'));
        break;
      case 'take-toolbox':this.dispatch('FavorStarted',{},'mara',e.id,`${s.runId}:toolbox`);this.ui.announce('Toolbox picked up. Return it to Eli’s bay.');break;
      case 'return-toolbox':this.dispatch('FavorCompleted',{},'mara','eli',`${s.runId}:favor-complete`);this.ui.announce('Free repair and respray earned.');break;
      case 'observe-depot':this.ui.announce('Street gate ahead. A low barrier leads in from the rear service lane.');break;
      case 'enter-depot-front':if(m.phase==='APPROACH')this.dispatch('ApproachCommitted',{route:'gate'},'mara',e.id,`${s.runId}:approach`);break;
      case 'vault':{
        const exiting=this.player.position.x<400,destination=exiting?{x:405,y:88,z:0}:{x:396,y:88,z:0};
        const vault=this.startVault({...e,destination});
        if(vault.ok){if(m.phase==='APPROACH')this.dispatch('ApproachCommitted',{route:'service'},'mara',e.id,`${s.runId}:approach`);this.audio.play('vault');}
        else this.ui.announce(this.humanReason(vault.reason));
        break;
      }
      case 'talk-jun':
        if(m.phase==='RECOVERY'){this.dispatch('JunReached',{},'mara','jun',`${s.runId}:jun-reached`);this.jun.activate();this.queueDialogue('jun-discovery');}
        else this.queueLine('Jun','Keep moving. I will stay close.');
        break;
      case 'recover-case':this.dispatch('CaseRecovered',{},'mara','case-cabinet',`${s.runId}:case-recovered`);break;
      case 'take-ammo':{
        const result=this.combat.pickup(e.id,'pistol',{reserve:e.amount,grantWeapon:false});if(result.ok){this.syncPickupVisuals();this.ui.announce('Pistol ammunition recovered.');this.captureCheckpoint(m.checkpointId);}break;
      }
      case 'take-smg':{
        const result=this.combat.pickup(e.id,'smg',{reserve:e.reserve});if(result.ok){this.syncPickupVisuals();this.combat.equip('smg');this.player.setWeapon('smg');this.ui.announce('Compact SMG recovered.');this.captureCheckpoint(m.checkpointId);}break;
      }
      case 'decision':if(m.phase==='DECISION')this.ui.show('decision');break;
      case 'handoff-broker':case 'handoff-reporter':{
        if(m.choice!==e.ending){this.ui.announce('Choose this destination at the quiet stop first.');break;}
        const request=this.dispatch('HandoffRequested',{locationId:e.ending==='broker'?'broker':'waterfront'},'mara',e.id,`${s.runId}:handoff-request`);
        if(request.ok)this.dispatch('HandoffCommitted',{},'mara',e.id,`${s.runId}:handoff-commit`);
        break;
      }
      case 'buy-food':case 'buy-armor':case 'repair':{
        const service=e.action==='buy-food'?'food':e.action==='buy-armor'?'armor':'repair';
        const vehicleId=service==='repair'?this.runtime.vehicles.nearest(this.player.actor,8)?.id:null;
        const result=this.economy.purchase(service,{transactionId:`${service}-${s.tick}`,vehicleId});
        if(result.ok){if(service==='repair')this.runtime.vehicles.repair(vehicleId);this.ui.announce(result.favorConsumed?'Favor used: vehicle repaired and resprayed.':`${service} purchased for $${result.price}.`);this.audio.play('cash');this.captureCheckpoint(m.checkpointId);}
        else this.ui.announce(this.humanReason(result.reason));
        break;
      }
    }
  }
  startVault(interaction){
    if(this.vaultState)return {ok:false,reason:'busy'};
    const actor=this.player.actor,from=this.player.position,to=interaction.destination;
    if(!to||!actor.body)return {ok:false,reason:'vault-unavailable'};
    const clear=this.runtime.queries.capsuleClear({x:m(to.x),y:m(to.y),z:m(to.z||0)},actor.r,actor.half,{ignore:[actor]});
    if(!clear)return {ok:false,reason:'landing-blocked'};
    this.cover.leave(this.player);
    const body=actor.body;body.setEnabled(false);actor.body=null;actor.vx=actor.vy=actor.vz=0;
    this.vaultState={from,to,body,t:0,duration:.72};
    this.animations.trigger(actor,'vault',{duration:.72});
    actor.facing=Math.atan2(to.y-from.y,to.x-from.x);
    return {ok:true};
  }
  updateVault(dt){
    const v=this.vaultState;if(!v)return;
    const actor=this.player.actor;v.t=Math.min(v.duration,v.t+dt);
    const u=v.t/v.duration,k=u*u*(3-2*u),lift=Math.sin(Math.PI*u)*1.3;
    actor.x=m(v.from.x+(v.to.x-v.from.x)*k);actor.y=m(v.from.y+(v.to.y-v.from.y)*k);actor.z=m((v.from.z||0)+((v.to.z||0)-(v.from.z||0))*k+lift);
    actor.anim={climb:true,pose:'interact',air:true};
    if(!actor.data.animationManaged)actor.rig?.update?.(dt,{...actor,...actor.anim});
    if(u>=1){actor.body=v.body;actor.body.setEnabled(true);actor.place(m(v.to.x),m(v.to.y),m(v.to.z||0));actor.anim={};this.vaultState=null;}
  }
  cancelVault(){
    const v=this.vaultState;if(!v)return;
    const actor=this.player.actor;actor.body=v.body;actor.body.setEnabled(true);actor.place(m(v.from.x),m(v.from.y),m(v.from.z||0));actor.anim={};this.vaultState=null;
  }
  onVehicleEvent(event){
    if(!this.state)return;
    const id=event.payload.actorId;
    if(event.type==='VehicleImpact'){
      const position=this.runtime.vehicles.get(event.sourceId)?.position||this.player.position;
      this.audio.play('carImpact',{intensity:Math.min(2,event.payload.damage/20)});this.runtime.camera.shake(Math.min(1,event.payload.damage/45));this.pedestrians.fear(position,28);
      if(event.payload.damage>8){for(const actor of [this.player.actor,this.jun.actor]){const transition=this.runtime.vehicles.transitions.get(actor);if(transition?.vehicle.id===event.sourceId)this.runtime.vehicles.cancelTransition(actor);}}
      if(this.state.player.vehicleId===event.sourceId&&event.payload.damage>8)this.reportCrime('collision',1,position,event.sourceId);
      if(event.payload.damage>42&&this.jun.vehicleId===event.sourceId)this.combat.resolveHit('jun',{damage:0,sourceId:event.sourceId,kind:'impact',severe:true});return;
    }
    if(event.type==='VehicleEntered'){
      if(id==='mara'){
        this.player.setVehicle(event.sourceId);const v=this.runtime.vehicles.get(event.sourceId);
        if(this.jun.active&&!this.jun.vehicleId&&distance(this.jun.position,v.position)<5){const board=this.runtime.vehicles.enter(this.jun.actor,v.id,'passenger');if(board.ok)this.audio.play('door');}
        this.wanted.changeVehicle(null,v.id,this.state.wanted.visible);
      }else if(id==='jun'){
        this.jun.board(event.sourceId,VEHICLE_SEATS[event.payload.seat]);
        if(this.state.mission.phase==='EXTRACTION')this.dispatch('VehicleEntered',{actorId:'jun',vehicleId:event.sourceId,seat:VEHICLE_SEATS[event.payload.seat]},'jun',event.sourceId,`${this.state.runId}:jun-extracted`);
      }
    }else if(event.type==='VehicleExited'){
      if(id==='mara'){
        this.player.setVehicle(null);this.wanted.changeVehicle(event.sourceId,null,this.state.wanted.visible);
        if(this.jun.vehicleId===event.sourceId){const leave=this.runtime.vehicles.exit(this.jun.actor);if(!leave.ok)this.ui.announce('Jun cannot leave by this door. Move the car to clear an exit.');}
      }
      else if(id==='jun')this.jun.exit(this.jun.position);
      else if(id?.startsWith?.('officer-'))this.runtime.vehicles.get(event.sourceId).locked=false;
    }
  }
  melee(){
    const strike=this.combat.meleeStrike();if(!strike.ok)return;
    this.audio.play('hit',{intensity:.6});const p=this.player.position,angle=this.player.actor.facing;
    const targets=this.crew.living.filter(e=>distance(p,this.crew.positionOf(e))<strike.range).sort((a,b)=>distance(p,this.crew.positionOf(a))-distance(p,this.crew.positionOf(b)));
    const e=targets.find(e=>{
      const q=this.crew.positionOf(e),toward=Math.atan2(q.y-p.y,q.x-p.x),delta=Math.atan2(Math.sin(toward-angle),Math.cos(toward-angle));
      return Math.abs(delta)<1.2&&this.runtime.queries.lineOfSight({x:p.x,y:p.y,z:p.z+1.1},{x:q.x,y:q.y,z:q.z+1.1},{ignore:[this.player.actor,e.actor],endpointTolerance:.2});
    });
    this.animations.trigger(this.player.actor,'melee');
    if(e){const result=this.combat.resolveHit(e.id,{damage:strike.damage,kind:'melee'});if(result.ok){this.crew.handleHit(e.id,strike.damage,p);this.animations.trigger(e.actor,'hit');}}
  }
  fire(){
    const i=this.state.player.inventory,weapon=i.equipped;
    if(weapon==='unarmed')return;
    const cadence=this.combat.fire({weaponId:weapon});if(!cadence.ok){if(cadence.reason==='empty'&&this.state.tick-this.lastShot>100){this.ui.announce('Out of ammunition. Reload or switch weapons.');this.lastShot=this.state.tick;}return;}
    const ray=this.runtime.camera.aimRay(m(cadence.range));
    let target=this.runtime.queries.ray(ray.from,ray.to,{ignore:[this.player.actor]})?.point||ray.to;
    const assist=this.aimAssist(ray,target);if(assist)target=assist;
    this.fireBurstCount=this.state.tick-this.lastFiredTick<20?this.fireBurstCount+1:0;this.lastFiredTick=this.state.tick;
    const spread=cadence.spread*(1+Math.min(1.5,this.fireBurstCount*.08));
    const dx=target.x-ray.from.x,dy=target.y-ray.from.y,dz=target.z-ray.from.z,length=Math.max(1,Math.hypot(dx,dy,dz));
    const yaw=Math.atan2(dy,dx)+(this.rng.next()*2-1)*spread;
    const pitch=Math.atan2(dz,Math.hypot(dx,dy))+(this.rng.next()*2-1)*spread;
    this.state.rngState=this.rng.snapshot();
    target={x:ray.from.x+Math.cos(pitch)*Math.cos(yaw)*length,y:ray.from.y+Math.cos(pitch)*Math.sin(yaw)*length,z:ray.from.z+Math.sin(pitch)*length};
    const muzzleRaw=this.player.actor.rig?.tip?.()||[this.player.actor.x,this.player.actor.y,this.player.actor.z+m(1.4)];
    const muzzle={x:muzzleRaw[0],y:muzzleRaw[1],z:muzzleRaw[2]};
    const hit=this.runtime.queries.ray(muzzle,target,{ignore:[this.player.actor]});
    const entity=hit?.entity,id=entity?.id||null;
    const blocked=!!hit&&!id;
    this.runtime.game.particles.impact(muzzle.x,muzzle.y,muzzle.z,3,'#f5ca7a');
    if(hit?.point){this.runtime.game.particles.impact(hit.point.x,hit.point.y,hit.point.z,blocked?7:4,blocked?'#e7cda7':'#d3a08d');if(blocked)this.audio.play('ricochet');}
    if(!blocked&&id){
      const result=this.combat.resolveHit(id,{damage:cadence.damage,sourceId:'mara',kind:'bullet'});
      if(result.ok&&this.crew.enemies.some(e=>e.id===id)){this.crew.handleHit(id,cadence.damage,this.player.position);this.animations.trigger(entity,'hit');}
      if(result.ok&&id.startsWith('officer-')){this.police.handleHit(id,cadence.damage);this.animations.trigger(entity,'hit');this.reportCrime('assault',3);}
      if(result.ok)this.audio.play('hit');
    }
    this.audio.play(weapon==='smg'?'gunSmg':'gunPistol');
    this.runtime.camera.shake(weapon==='smg'?.1:.18);
    this.animations.trigger(this.player.actor,'shot');
    this.crew.alert(this.player.position);
    this.reportCrime('gunfire',2);
  }
  aimAssist(ray,target){
    if(this.runtime.input.lastFrame?.device!=='gamepad')return null;
    const p=this.player.position,yaw=this.runtime.camera.yaw,candidates=this.crew.living.map(e=>{
      const q=this.crew.positionOf(e),a=Math.atan2(q.y-p.y,q.x-p.x),delta=Math.atan2(Math.sin(a-yaw),Math.cos(a-yaw));
      return {id:e.id,hostile:true,visible:this.runtime.queries.lineOfSight({x:p.x,y:p.y,z:p.z+1.4},{x:q.x,y:q.y,z:q.z+1.4},{ignore:[this.player.actor,e.actor]}),angle:delta,distance:distance(p,q),position:q};
    });
    const selected=selectAimAssistTarget(candidates);
    return selected?{x:m(selected.position.x),y:m(selected.position.y),z:m(selected.position.z+1.35)}:null;
  }
  hostileShot(shot){
    if(!this.state||this.state.mission.failure)return;
    const enemy=this.crew.enemies.find(e=>e.id===shot.source)?.actor||this.police.officers.find(o=>o.id===shot.source)?.actor;if(enemy)this.animations.trigger(enemy,'shot');
    this.audio.play('gunPistol',{intensity:.65});
    const chance=this.rng.next();this.state.rngState=this.rng.snapshot();if(chance>shot.accuracy)return;
    const obstruction=this.runtime.queries.raycast(shot.position,shot.target,{ignore:[enemy].filter(Boolean)});
    const hitId=obstruction?.entity?.id||null;
    const playerCar=this.state.player.vehicleId;
    if(hitId==='jun'){
      this.combat.resolveHit('jun',{damage:10,sourceId:shot.source,kind:'bullet'});this.jun.takeCover(shot.position);this.junCoverUntil=this.state.elapsed+4;this.animations.trigger(this.jun.actor,'hit');return;
    }
    if(obstruction&&hitId!==playerCar&&hitId!=='mara'&&distance(obstruction.point,shot.target)>.8){
      this.runtime.game.particles.impact(m(obstruction.point.x),m(obstruction.point.y),m(obstruction.point.z),5,'#e7cda7');
      return;
    }
    if(playerCar&&hitId===playerCar){const car=this.runtime.vehicles.get(playerCar);if(car){car.health=Math.max(0,car.health-7);this.audio.play('carImpact',{intensity:.35});}return;}
    let strayAtJun=false;
    if(this.jun.active&&!this.jun.vehicleId&&distance(this.jun.position,this.player.position)<9){strayAtJun=this.rng.next()<.18;this.state.rngState=this.rng.snapshot();}
    if(strayAtJun){
      const junPos=this.jun.position;
      if(this.runtime.queries.lineOfSight(shot.position,{x:junPos.x,y:junPos.y,z:junPos.z+1.2},{ignore:[this.jun.actor,enemy].filter(Boolean)})){
        this.combat.resolveHit('jun',{damage:10,sourceId:shot.source,kind:'bullet'});
        this.jun.takeCover(shot.position);this.junCoverUntil=this.state.elapsed+4;this.animations.trigger(this.jun.actor,'hit');return;
      }
    }
    const damage=shot.role==='rusher'?10:shot.role==='police'?8:12;
    const result=this.combat.resolveHit('mara',{damage,sourceId:shot.source,kind:'bullet'});
    if(result.ok){this.player.hurt();this.animations.trigger(this.player.actor,'hit');this.runtime.camera.shake(.3);}
  }
  crewDown(id){this.dispatch('EnemyDefeated',{enemyId:id},'mara',id,`${this.state.runId}:crew-down:${id}`);}
  onTrafficCrime(event){
    this.reportCrime('theft',1,event.position,event.vehicleId,event.witnessId);
  }
  reportCrime(kind,severity,position=null,vehicleId=null,witnessId=null){
    const s=this.state;if(!s)return;
    if(kind==='gunfire'){if(s.tick-this.lastGunfireReportTick<240)return;this.lastGunfireReportTick=s.tick;}
    const id=`${s.runId}:${kind}:${s.tick}:${this.eventSequence++}`,p=position||this.player.position;
    const incident={id,kind,position:p,severity,perpetratorId:'mara',vehicleId:vehicleId||s.player.vehicleId,tick:s.tick};
    this.crime.recordCrime(incident);
    this.pedestrians.witness(incident);
    if(witnessId)this.crime.observe({crimeId:id,witnessId,witnessKind:'civilian',hasLineOfSight:true,seesPerson:true,seesVehicle:true,reportDelay:2.8});
    for(const o of this.police.officers){
      if(o.health<=0)continue;
      const q=this.police.position(o);if(distance(p,q)<35&&this.runtime.queries.lineOfSight({x:p.x,y:p.y,z:p.z+1.5},{x:q.x,y:q.y,z:q.z+1.5},{ignore:[this.player.actor,o.actor]})){
        this.crime.observe({crimeId:id,witnessId:o.id,witnessKind:'police',hasLineOfSight:true,seesPerson:!s.player.vehicleId,seesVehicle:!!s.player.vehicleId});break;
      }
    }
  }
  arrest(){if(!this.state?.mission.failure){this.state.mission.failure={reason:'Arrested. Retry the last checkpoint.',tick:this.state.tick};this.audio.play('error');}}
  onJunStuck(data){if(!this.state)return;if(data.retryRequired)this.dispatch('ActorFailed',{actorId:'jun',reason:'Jun could not reach a safe route. Retry checkpoint.'},'jun');else this.ui.announce('Jun is blocked. Return to him or use the other exit.');}
  isVisibleToPlayer(point){return distance(point,this.player.position)<25&&this.runtime.queries.lineOfSight({x:this.player.position.x,y:this.player.position.y,z:this.player.position.z+1.6},{x:point.x,y:point.y,z:(point.z||0)+1.5},{ignore:[this.player.actor]});}
  handleError(error){
    console.error(error);this.error=error;
    this.runtime?.input.clear();
    this.ui.show('error',{title:'The city could not load',message:error?.message||String(error)});
  }
}

const app=new ExitWoundsGame();
// EWA93_DEBUG_START: removed from the packaged release by tools/build.mjs.
/** @type {any} */(window).__exitWounds={app,get state(){return app.state},get runtime(){return app.runtime}};
// EWA93_DEBUG_END
app.boot();
