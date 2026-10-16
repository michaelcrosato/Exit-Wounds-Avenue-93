const SCREEN_LABELS = {
  title: 'Main menu', pause: 'Paused', settings: 'Settings', phone: 'Phone', confirm: 'Confirm choice', wheel: 'Weapon wheel',
  map: 'Map and objective', decision: 'Choose a destination', retry: 'Retry',
  credits: 'Credits', loading: 'Loading', error: 'Error', ending: 'The Last Collection'
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label, action, key = '', disabled = false) => `<button class="menu__button" data-action="${escape(action)}" ${disabled ? 'disabled' : ''}><span>${escape(label)}</span><span class="menu__key">${escape(key)}</span></button>`;
const menu = (items, help = '') => `<div class="menu">${items.map(item => button(...item)).join('')}</div>${help ? `<p class="help">${help}</p>` : ''}`;
const shell = (name, content, wide = false) => `<section class="screen screen--${name}" role="dialog" aria-modal="true" aria-label="${SCREEN_LABELS[name] || name}"><div class="screen__inner ${wide ? 'screen__inner--wide' : ''}">${content}</div><span class="screen__corner">Morrow Ward · Calder Bay</span></section>`;

export class GameInterface {
  constructor(root, onAction) {
    this.root = root;
    this.onAction = onAction;
    this.screen = 'loading';
    this.context = {};
    this.focusIndex = 0;
    this.toastTimer = 0;
    this.hudModel = {};
    this.mapModel = null;
    this.currentSettings = {};
    root.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target || target.disabled) return;
      this.activate(target.dataset.action, target.dataset.value);
    });
    root.addEventListener('input', e => {
      const target = e.target.closest('[data-setting]');
      if (!target) return;
      const value = target.type === 'checkbox' ? target.checked : target.type === 'range' ? Number(target.value) : target.value;
      this.currentSettings[target.dataset.setting] = value;
      this.onAction('settingChanged', {name: target.dataset.setting, value});
      const output = target.parentElement.querySelector('output');
      if (output) output.textContent = typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value);
    });
    this.lastPointerPoint=null;
    root.addEventListener('pointermove', e => {
      if(e.pointerType!=='mouse')return;
      if(this.lastPointerPoint&&this.lastPointerPoint.x===e.clientX&&this.lastPointerPoint.y===e.clientY)return;
      this.lastPointerPoint={x:e.clientX,y:e.clientY};
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const index = this.focusables().indexOf(target);
      if (index >= 0) this.setFocus(index, false);
    });
    addEventListener('keydown', e => {
      if (this.screen === 'playing') return;
      if(this.screen==='rebind'&&this.context.waiting){e.preventDefault();e.stopImmediatePropagation();this.onAction('rebindKey',{code:e.code});return;}
      if(['credits','ending'].includes(this.screen)&&['PageUp','PageDown'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();this.scrollPanel(e.code==='PageUp'?-260:260);return;}
      if(this.screen==='credits'&&['ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();this.scrollPanel(['ArrowUp','KeyW'].includes(e.code)?-110:110);return;}
      if (['ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); this.moveFocus(-1); }
      else if (['ArrowDown','KeyS'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); this.moveFocus(1); }
      else if (['ArrowLeft','KeyA'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); this.adjustOrMove(-1); }
      else if (['ArrowRight','KeyD'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); this.adjustOrMove(1); }
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); this.activateFocused(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.back(); }
    }, {capture:true});
    this.show('loading', {message:'Warming the city'});
  }

  activate(action, value) { this.onAction(action, value === undefined ? undefined : {value}); }
  focusables() { return [...this.root.querySelectorAll('.screen [data-action]:not(:disabled),.screen [data-setting]:not(:disabled)')]; }
  setFocus(index, moveDOM = true) {
    const list = this.focusables();
    if (!list.length) return;
    this.focusIndex = ((index % list.length) + list.length) % list.length;
    list.forEach((el,i) => el.dataset.focused = String(i === this.focusIndex));
    if (moveDOM) { list[this.focusIndex].focus({preventScroll:true});list[this.focusIndex].scrollIntoView({block:'nearest',inline:'nearest'}); }
  }
  moveFocus(delta) { this.setFocus(this.focusIndex + delta); }
  adjustOrMove(delta) {
    const el=this.focusables()[this.focusIndex];
    if(!el?.dataset.setting){this.moveFocus(delta);return;}
    if(el.tagName==='SELECT')el.selectedIndex=Math.max(0,Math.min(el.options.length-1,el.selectedIndex+delta));
    else if(el.type==='range')el.value=String(Math.max(Number(el.min),Math.min(Number(el.max),Number(el.value)+Number(el.step||.05)*delta)));
    el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  scrollPanel(delta){const panel=this.root.querySelector('.screen .panel-scroll');if(panel)panel.scrollTop+=delta;}
  activateFocused() {
    const list = this.focusables();
    const el = list[this.focusIndex];
    if (el?.dataset.action) this.activate(el.dataset.action, el.dataset.value);
    else if(el?.dataset.setting)this.adjustOrMove(1);
  }
  back() {
    const action = ({pause:'resume',settings:'settingsBack',phone:'closePhone',map:'closeMap',decision:'closeDecision',credits:'creditsBack',retry:'quitToTitle',error:'errorBack',ending:'endingContinue',confirm:'confirmNo',wheel:'closeWheel',controls:'controlsBack',rebind:'rebindBack'})[this.screen];
    if (action) this.activate(action);
  }
  handleFrame(frame) {
    if (this.screen === 'playing' || !frame) return false;
    const pressed = frame.pressed instanceof Set ? frame.pressed : new Set(frame.pressed || []);
    if(this.screen==='pause'&&(pressed.has('pause')||pressed.has('start'))){this.back();return true;}
    if(['ending','credits'].includes(this.screen)&&Math.abs(frame.lookY)>.2)this.scrollPanel(frame.lookY*620*(frame.dt||1/120));
    if(this.screen==='credits'){
      if(['menuUp','up','dpadUp'].some(k=>pressed.has(k)))this.scrollPanel(-110);
      if(['menuDown','down','dpadDown'].some(k=>pressed.has(k)))this.scrollPanel(110);
      if(['confirm','menuConfirm'].some(k=>pressed.has(k)))this.activateFocused();
      if(['back','menuBack'].some(k=>pressed.has(k)))this.back();
      return true;
    }
    if (['menuUp','up','dpadUp'].some(k => pressed.has(k))) this.moveFocus(-1);
    if (['menuDown','down','dpadDown'].some(k => pressed.has(k))) this.moveFocus(1);
    if (['menuLeft','left','dpadLeft'].some(k => pressed.has(k))) this.adjustOrMove(-1);
    if (['menuRight','right','dpadRight'].some(k => pressed.has(k))) this.adjustOrMove(1);
    if (['confirm','menuConfirm'].some(k => pressed.has(k))) this.activateFocused();
    if (['back','menuBack'].some(k => pressed.has(k))) this.back();
    return true;
  }

  show(name, context = {}) {
    this.screen = name;
    this.context = context;
    if (name !== 'playing' && name !== 'wheel' && document.pointerLockElement) document.exitPointerLock?.();
    this.root.innerHTML = name === 'playing' ? this.hudMarkup() : this.screenMarkup(name,context);
    this.focusIndex = 0;
    if (name !== 'playing') requestAnimationFrame(() => { if (this.screen === name) this.setFocus(0); });
    else this.setHUD(this.hudModel);
  }

  screenMarkup(name, c) {
    switch(name) {
      case 'loading': return shell(name, `<p class="eyebrow">Exit Wounds Avenue-93</p><h1 class="title title--small">${escape(c.message || 'Loading')}</h1><p class="lead">The rain will pass.</p><div class="loading-line" aria-label="Loading"></div>`);
      case 'title': return shell(name, `<p class="eyebrow">An original story · One city night</p><h1 class="title">Exit Wounds <span>Avenue-93</span></h1><p class="lead">A case. A witness. Two ways to make it disappear.</p><p class="meta">The Last Collection · Morrow Ward</p>${menu([[c.recoverBackup?'Recover save':'Continue','continue','',!c.canContinue],['New Game','newGame',''],['Settings','openSettings',''],['Credits','openCredits','']],'<strong>Controller:</strong> D-pad to select · Cross to confirm &nbsp;&nbsp; <strong>Keyboard:</strong> arrows and Enter')}${c.storageWarning?`<p class="help help--warning">${escape(c.storageWarning)}</p>`:''}`);
      case 'pause': return shell(name, `<p class="eyebrow">The Last Collection</p><h1 class="title title--small">Paused</h1>${menu([['Resume','resume','Cross / Enter'],['Map & objective','openMap',''],['Phone','openPhone',''],['Restart checkpoint','restartCheckpoint',''],...(c.completed?[['Replay mission','replayMission','']]:[]),['Settings','openSettings',''],['Credits','openCredits',''],['Quit to title','quitToTitle','']],'<strong>Options / Escape</strong> resumes play.')}`);
      case 'settings': return shell(name, `<p class="eyebrow">Make the city yours</p><h1 class="title title--small">Settings</h1><div class="panel-scroll"><div class="settings-grid">${this.settingsMarkup(c.settings || {})}</div>${menu([['Controls & remapping','openControls',''],['Back','settingsBack','Circle / Esc']])}</div>`,true);
      case 'controls': return shell(name, `<p class="eyebrow">Controller & keyboard</p><h1 class="title title--small">Controls</h1><div class="panel-scroll"><p class="paragraph">Defaults: move with left stick or WASD. Look with right stick or mouse. R2 / left click attacks; L2 / right click aims. Triangle / E interacts. L1 / Tab opens the weapon wheel. Options / Escape pauses. Remapped actions appear in prompts and the binding lists below.</p><p class="paragraph">On foot: Cross / Shift sprints, Square / Space vaults, R1 / Q enters cover, Circle / R reloads. Unarmed, hold L2 / right mouse to block and press Circle / R with a direction to dodge. At a safe tier-1 police stop, holster and hold Triangle / E for one second to surrender.</p><p class="paragraph">In a car: R2 accelerates, L2 brakes, R1 / Space uses the handbrake; hold R3 / V to look behind. D-pad Up / T opens the phone; Circle / Escape closes it.</p>${menu([['Change keyboard bindings','openRebind',''],['Change controller bindings','openControllerRebind',''],['Back','controlsBack','Circle / Esc']])}</div>`,true);
      case 'rebind': return shell(name, `<p class="eyebrow">${escape(c.device==='controller'?'Controller':'Keyboard')} bindings</p><h1 class="title title--small">Remap controls</h1><p class="paragraph">Select an action, then press the new ${c.device==='controller'?'controller button':'key'}. Escape cancels keyboard capture. Changes are saved.</p><div class="panel-scroll"><div class="menu">${Object.entries(c.bindings || {}).map(([action,key]) => button(action,'rebind:'+action,key)).join('')}</div><p class="help">${escape(c.waiting ? `Press a ${c.device==='controller'?'button':'key'} for ${c.waiting}` : '')}</p>${menu([['Reset defaults','resetBindings',''],['Back','rebindBack','Circle / Esc']])}</div>`,true);
      case 'phone': {
        const call=c.call||{},ringing=call.status==='ringing',returnable=['missed','declined','interrupted'].includes(call.status);
        if(ringing)return shell(name,`<p class="eyebrow">Mara's phone · Eli Serrano</p><h1 class="title title--small">Incoming call</h1><div class="panel-scroll"><p class="lead">Eli has the collection details. ${Math.ceil(call.remaining||0)} seconds to answer. You can meet him in the garage if you miss it.</p>${menu([['Answer Eli','answerEliCall','Cross / Enter'],['Decline call','declineEliCall',''],['Close phone','closePhone','Circle / Esc']])}</div>`,true);
        return shell(name,`<p class="eyebrow">Mara's phone · ${escape(c.time || '19:42')}</p><h1 class="title title--small">Contacts</h1><div class="panel-scroll">${returnable?`<div class="phone-call"><p class="paragraph">${call.status==='interrupted'?'Eli’s call was interrupted. Resume the unheard lines.':'Missed call from Eli. Return it for the collection details, or meet him at the garage.'}</p>${menu([['Return Eli’s call','returnEliCall','Cross / Enter']])}</div>`:''}<div class="phone-list"><button class="phone-item" data-action="phoneJob"><strong>Job</strong>${escape(c.job || 'The Last Collection')}</button><button class="phone-item" data-action="phoneMessages"><strong>Messages</strong>${escape(c.messagePreview || 'View recent messages')}</button><button class="phone-item" data-action="phoneEli"><strong>Eli Serrano</strong>Garage · repair and advice</button><button class="phone-item" data-action="phoneBea"><strong>Bea Moss</strong>Collection contact</button></div>${c.detail ? `<p class="paragraph">${escape(c.detail)}</p>` : ''}${menu([...(c.replayAvailable?[['Replay last conversation','phoneReplay','']]:[]),['Close phone','closePhone','Circle / Esc']])}</div>`,true);
      }
      case 'map': return shell(name, `<p class="eyebrow">Calder Bay · Morrow Ward</p><h1 class="title title--small">Map & objective</h1><p class="paragraph">${escape(c.objective || 'Find your next lead.')}</p><canvas id="full-map" class="map-large" aria-label="Street map of Morrow Ward"></canvas>${menu([['Back to play','closeMap','Circle / Esc']])}`,true);
      case 'decision': return shell(name, `<p class="eyebrow">The case is in your hands</p><h1 class="title title--small">Who gets the proof?</h1><p class="lead">Jun looks across the dark water. “People should know.”</p><div class="decision-cards"><button class="decision-card" data-action="chooseReporter"><strong>Give it to the reporter</strong><span>Make the diverted wages public. Jun can face the morning. Receive $600.</span></button><button class="decision-card" data-action="chooseBroker"><strong>Take the broker's money</strong><span>Keep the case quiet. The contractor gains the market. Receive $1,200.</span></button></div>${menu([['Decide later','closeDecision','Circle / Esc']])}`,true);
      case 'wheel': return shell(name, `<p class="eyebrow">Choose equipment</p><h1 class="title title--small">Weapon wheel</h1>${menu([['Unarmed · block and dodge','chooseWeapon','',false],['Service pistol · precision','chooseWeaponPistol','',!c.weapons?.pistol?.owned],['Compact SMG · close pressure','chooseWeaponSmg','',!c.weapons?.smg?.owned],['Back','closeWheel','Circle / Esc']])}`);
      case 'confirm': return shell(name, `<p class="eyebrow">Confirm your choice</p><h1 class="title title--small">${escape(c.title||'Are you sure?')}</h1><p class="lead">${escape(c.message||'')}</p>${menu([['Continue','confirmYes',''],['Cancel','confirmNo','Circle / Esc']])}`);
      case 'retry': return shell(name, `<p class="eyebrow">${escape(c.eyebrow || 'Morrow Ward')}</p><h1 class="title title--small">${escape(c.title || 'Try again')}</h1><p class="lead">${escape(c.reason || 'The job is not over.')}</p>${menu([['Retry checkpoint','retryCheckpoint',''],['Restart mission','restartMission',''],['Return to title','quitToTitle','']])}`);
      case 'ending': return shell(name, `<p class="eyebrow">The Last Collection · Complete</p><h1 class="title title--small">${escape(c.title || 'Morning comes')}</h1><div class="panel-scroll"><p class="lead">${escape(c.summary || '')}</p>${(c.lines||[]).map(line=>`<p class="paragraph"><strong>${escape(line.speaker)}:</strong> ${escape(line.text)}</p>`).join('')}<p class="paragraph">${escape(c.message || '')}</p></div><p class="meta">Payment received: $${escape(c.payment || 0)}</p>${menu([['Continue in Morrow Ward','endingContinue',''],['Credits','openCredits',''],['Replay mission','replayMission','']])}`,true);
      case 'credits': return shell(name, `<p class="eyebrow">Exit Wounds Avenue-93</p><h1 class="title title--small">Credits</h1><div class="panel-scroll"><p class="paragraph">An original playable story set in Morrow Ward, Calder Bay.</p><div class="credits-list"><div><strong>Design, code, visual and audio production:</strong> ${escape(c.production || 'Codex implementation team')}</div><div><strong>Engine:</strong> my-3d2dge and its credited open-source dependencies.</div><div><strong>Reference:</strong> Grand Theft Auto IV (2008), Rockstar Games.</div></div><div class="source-info">${escape(c.sourceInfo || 'Source information loading…')}</div></div>${menu([['Back','creditsBack','Circle / Esc']])}`,true);
      case 'error': return shell(name, `<p class="eyebrow">A recoverable problem</p><h1 class="title title--small">${escape(c.title || 'Could not continue')}</h1><p class="lead">${escape(c.message || 'Please retry or return to the title screen.')}</p>${menu([['Retry','retryError',''],['Return to title','quitToTitle','']])}`);
      default: return shell('error',`<h1 class="title title--small">Unknown screen</h1>${menu([['Return to title','quitToTitle','']])}`);
    }
  }

  settingsMarkup(s) {
    const choice = (name,label,options,description) => `<div class="setting"><label for="s-${name}">${label}</label><select id="s-${name}" data-setting="${name}">${options.map(([value,text]) => `<option value="${value}" ${String(s[name])===String(value)?'selected':''}>${text}</option>`).join('')}</select><small>${description}</small></div>`;
    const slider = (name,label,min,max,step,description) => `<div class="setting"><label for="s-${name}">${label} · <output>${Math.round((s[name] ?? 1)*100)}%</output></label><input id="s-${name}" type="range" min="${min}" max="${max}" step="${step}" value="${s[name] ?? 1}" data-setting="${name}"><small>${description}</small></div>`;
    return [
      choice('quality','Picture quality',[['high','High'],['medium','Medium'],['low','Low']],'Changes render resolution, shadows and decorative effects.'),
      slider('brightness','Brightness',.6,1.4,.05,'Adjusts the city without washing out the interface.'),
      slider('hudScale','HUD size',.8,1.35,.05,'Larger text and status at couch distance.'),
      slider('subtitleScale','Subtitle size',.8,1.4,.05,'Essential dialogue is always subtitled.'),
      slider('sensitivity','Look sensitivity',.3,1.8,.05,'Applies to controller and mouse look.'),
      choice('invertY','Vertical look',[['false','Normal'],['true','Inverted']],'Applies to both look devices.'),
      choice('aimMode','Aim control',[['hold','Hold'],['toggle','Toggle']],'Choose how aim is activated.'),
      choice('sprintMode','Sprint control',[['hold','Hold'],['toggle','Toggle']],'Choose how sprint is activated.'),
      slider('shake','Camera shake',0,1,.05,'Reduce movement without changing recoil rules.'),
      slider('masterVolume','Master volume',0,1,.05,'Sets the complete game mix.'),
      slider('musicVolume','Music / radio',0,1,.05,'Separate control for original music.'),
      slider('dialogueVolume','Dialogue',0,1,.05,'Keep spoken lines clear over the city.')
    ].join('');
  }

  hudMarkup() { return `<div class="hud" aria-live="off"><div class="hud__objective"><strong id="hud-objective">The Last Collection</strong><span id="hud-detail"></span></div><div class="hud__left"><canvas class="minimap" id="minimap" width="210" height="210" aria-label="Local map"></canvas><div class="meters"><span class="hud__label">Health</span><div class="bar"><i id="hud-health"></i></div><span class="hud__label">Armor</span><div class="bar bar--armor"><i id="hud-armor"></i></div><span class="hud__label" id="hud-money"></span></div></div><div class="hud__right"><div class="hud__weapon" id="hud-weapon"></div><div class="hud__ammo" id="hud-ammo"></div><div class="hud__heat" id="hud-heat"></div><span class="hud__search" id="hud-search"></span></div><div class="hud__subtitle" id="hud-subtitle"></div><div class="hud__prompt" id="hud-prompt"></div><div class="hud__toast" id="hud-toast"></div></div>`; }
  setHUD(hud = {}) {
    this.hudModel = {...this.hudModel,...hud};
    if (this.screen !== 'playing') return;
    const m = this.hudModel;
    const setText = (id,value) => { const el = this.root.querySelector('#'+id); if (el) el.textContent = String(value ?? ''); };
    setText('hud-objective',m.objective || 'The Last Collection');
    setText('hud-detail',m.detail || '');
    setText('hud-money',m.money == null ? '' : `$${m.money}`);
    setText('hud-weapon',m.weapon || 'Unarmed');
    setText('hud-ammo',m.ammo || '');
    setText('hud-heat',m.heat > 0 ? `POLICE · ${m.heat} / 3` : '');
    setText('hud-search',m.search || '');
    setText('hud-prompt',m.prompt || '');
    setText('hud-subtitle',m.subtitle ? `${m.speaker ? m.speaker+': ' : ''}${m.subtitle}` : '');
    setText('hud-toast',m.toast || '');
    for (const [id,val] of [['hud-health',m.health],['hud-armor',m.armor]]) {
      const el = this.root.querySelector('#'+id);
      if (el) el.style.width = `${Math.max(0,Math.min(100,Number(val ?? 100)))}%`;
    }
    document.documentElement.style.setProperty('--ui-scale',String(m.hudScale ?? 1));
    document.documentElement.style.setProperty('--subtitle-scale',String(m.subtitleScale ?? 1));
    this.drawMap(this.root.querySelector('#minimap'),m);
  }
  drawMap(canvas,m=this.hudModel) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w=canvas.width,h=canvas.height, player=m.position||{x:94,y:306};
    ctx.fillStyle='#092026';ctx.fillRect(0,0,w,h);
    const scale = canvas.id === 'full-map' ? Math.min(w/480,h/420) : .7;
    const origin = canvas.id === 'full-map' ? {x:0,y:0} : {x:player.x-w/(2*scale),y:player.y-h/(2*scale)};
    const x = n => (n-origin.x)*scale, y = n => (n-origin.y)*scale;
    ctx.strokeStyle='#466d6d';ctx.lineWidth=canvas.id==='full-map'?7:5;
    for(const roadX of [60,240,416]){ctx.beginPath();ctx.moveTo(x(roadX),y(34));ctx.lineTo(x(roadX),y(390));ctx.stroke();}
    for(const roadY of [52,202,332,380]){ctx.beginPath();ctx.moveTo(x(45),y(roadY));ctx.lineTo(x(430),y(roadY));ctx.stroke();}
    if(Array.isArray(m.route)&&m.route.length>1){ctx.strokeStyle='#e7b368';ctx.lineWidth=canvas.id==='full-map'?5:3;ctx.setLineDash(canvas.id==='full-map'?[9,6]:[5,4]);ctx.beginPath();m.route.forEach((point,index)=>index?ctx.lineTo(x(point.x),y(point.y)):ctx.moveTo(x(point.x),y(point.y)));ctx.stroke();ctx.setLineDash([]);}
    ctx.fillStyle='#ffc46b';
    if(m.destination&&typeof m.destination==='object'){ctx.beginPath();ctx.moveTo(x(m.destination.x),y(m.destination.y)-7);ctx.lineTo(x(m.destination.x)+7,y(m.destination.y)+6);ctx.lineTo(x(m.destination.x)-7,y(m.destination.y)+6);ctx.fill();}
    if(m.searchCenter&&m.searchRadius){ctx.strokeStyle='rgba(232,106,96,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x(m.searchCenter.x),y(m.searchCenter.y),m.searchRadius*scale,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#e8f4f1';ctx.beginPath();ctx.arc(x(player.x),y(player.y),5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#c5e9e4';ctx.font='bold 11px sans-serif';
    const labels=/** @type {Array<[string,{x:number,y:number}]>} */([['GARAGE',{x:94,y:306}],['MARKET',{x:113,y:216}],['DEPOT',{x:350,y:124}],['WATERFRONT',{x:382,y:356}],['BROKER',{x:90,y:78}]]);
    if(canvas.id==='full-map') for(const [label,p] of labels) ctx.fillText(label,x(p.x)+7,y(p.y)-7);
  }
  setMap(model){this.mapModel=model;if(this.screen==='map')this.drawMap(this.root.querySelector('#full-map'),{...this.hudModel,...model});}
  announce(message,seconds=4) {
    this.setHUD({toast:message});
    if(this.screen!=='playing'){
      const inner=this.root.querySelector('.screen__inner');
      if(inner){let notice=inner.querySelector('#screen-notice');if(!notice){notice=document.createElement('p');notice.id='screen-notice';notice.className='help help--warning';notice.setAttribute('role','status');inner.appendChild(notice);}notice.textContent=message;}
    }
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{this.setHUD({toast:''});this.root.querySelector('#screen-notice')?.remove();},seconds*1000);
  }
}
