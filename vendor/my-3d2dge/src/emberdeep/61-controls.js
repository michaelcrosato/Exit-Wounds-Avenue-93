/* Saved bindings, native settings dialogs, and multi-touch controls. */
const CONTROL_ACTIONS = [
	["up", "Move up"],
	["down", "Move down"],
	["left", "Move left"],
	["right", "Move right"],
	...SLOT_ACTS.map((a, i) => [a, "Skill " + (i + 1)]),
	["dodge", "Dodge"],
	["potion", "Potion"],
	["interact", "Interact"],
	["portal", "Town portal"],
	["bag", "Inventory"],
	["skills", "Skills"],
	["tree", "Passives"],
	["map", "Map (hold)"],
	["labels", "Loot labels"],
];
const CONTROL_DEFAULT = {
	deadzone: 0.18,
	invertAimY: false,
	aimAssist: true,
	touch: "auto",
	handed: "right",
	size: 54,
	opacity: 0.8,
};
const CONTROL = { bindings: {}, ...CONTROL_DEFAULT };
const storedControls = E.store.get("ed:controls", {});
const bindingCode = (c) =>
	typeof c === "string" &&
	/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Tab|Enter|NumpadEnter|Backspace|Mouse[0-4]|Pad([0-9]|1[0-5]))$/.test(
		c,
	);
const RESERVED_KEYS = new Set(["KeyV", "KeyM", "KeyH", "Digit0", "Pad9"]);
if (storedControls && typeof storedControls === "object") {
	for (const key of ["deadzone", "size", "opacity"])
		if (Number.isFinite(storedControls[key]))
			CONTROL[key] = storedControls[key];
	for (const key of ["invertAimY", "aimAssist"])
		if (typeof storedControls[key] === "boolean")
			CONTROL[key] = storedControls[key];
	if (["auto", "on", "off"].includes(storedControls.touch))
		CONTROL.touch = storedControls.touch;
	if (["left", "right"].includes(storedControls.handed))
		CONTROL.handed = storedControls.handed;
	for (const [a] of CONTROL_ACTIONS) {
		const codes = storedControls.bindings && storedControls.bindings[a];
		if (
			Array.isArray(codes) &&
			codes.length <= 12 &&
			codes.every((c) => bindingCode(c) && !RESERVED_KEYS.has(c))
		)
			CONTROL.bindings[a] = [...new Set(codes)];
	}
}
CONTROL.deadzone = clamp(CONTROL.deadzone, 0.05, 0.5);
CONTROL.size = clamp(CONTROL.size, 44, 72);
CONTROL.opacity = clamp(CONTROL.opacity, 0.3, 1);
const PAD_LABELS = [
	"A / Cross",
	"B / Circle",
	"X / Square",
	"Y / Triangle",
	"LB / L1",
	"RB / R1",
	"LT / L2",
	"RT / R2",
	"View / Share",
	"Menu / Options",
	"L stick",
	"R stick",
	"D-pad up",
	"D-pad down",
	"D-pad left",
	"D-pad right",
];
function codeLabel(code) {
	if (/^Pad\d+$/.test(code)) return PAD_LABELS[+code.slice(3)] || code;
	return (
		{
			Mouse0: "LMB",
			Mouse1: "MMB",
			Mouse2: "RMB",
			Mouse3: "Mouse 4",
			Mouse4: "Mouse 5",
			Space: "Space",
			ShiftLeft: "L Shift",
			ShiftRight: "R Shift",
		}[code] || code.replace(/^Key|^Digit/, "").replace(/^Arrow/, "")
	);
}
function actionCodes(a) {
	return CONTROL.bindings[a] || INPUT[a] || [];
}
function actionLabel(a, compact = false) {
	const codes = actionCodes(a),
		pad = game.input.lastDevice === "gamepad";
	const code = codes.find((c) => c.startsWith("Pad") === pad) || codes[0];
	if (compact && code && /^Pad\d+$/.test(code))
		return [
			"A",
			"B",
			"X",
			"Y",
			"LB",
			"RB",
			"LT",
			"RT",
			"View",
			"Menu",
			"L3",
			"R3",
			"Up",
			"Down",
			"Left",
			"Right",
		][+code.slice(3)];
	return code ? codeLabel(code) : "—";
}
function applyControls(save = true) {
	const map = { ...INPUT };
	for (const [a] of CONTROL_ACTIONS) map[a] = actionCodes(a);
	game.input.use(map);
	game.input.deadzone = CONTROL.deadzone;
	game.input.invertAimY = CONTROL.invertAimY;
	game.input.stickSide = CONTROL.handed === "right" ? "left" : "right";
	game.input.stickRadius = CONTROL.size * 0.82;
	if (save) E.store.set("ed:controls", CONTROL);
	syncTouchControls(true);
}

/* Native dialogs remain legible on portrait phones and support browser focus/scrolling. */
const FORM = { el: null, capture: null, message: "" };
function formElement(tag, text, parent, attrs = {}) {
	const el = document.createElement(tag);
	if (text) el.textContent = text;
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	if (parent) parent.appendChild(el);
	return el;
}
function formButton(parent, text, fn) {
	const el = formElement("button", text, parent, { type: "button" });
	el.onclick = fn;
	return el;
}
function formField(parent, label, type, value, change, extra = {}) {
	const row = formElement("label", "", parent, { class: "ed-field" });
	formElement("span", label, row);
	const el = formElement(
		type === "select" ? "select" : "input",
		"",
		row,
		type === "select" ? {} : { type, ...extra },
	);
	if (type === "select")
		for (const [v, t] of extra.options)
			formElement("option", t, el, { value: v });
	if (type === "checkbox") el.checked = value;
	else el.value = value;
	el.onchange = () =>
		change(
			type === "checkbox"
				? el.checked
				: type === "select"
					? el.value
					: Number(el.value),
		);
	return el;
}
function openForm(title, build) {
	closeForm();
	const el = formElement("dialog", "", document.body, {
		class: "ed-dialog",
		"aria-labelledby": "ed-dialog-title",
	});
	FORM.el = el;
	const head = formElement("header", "", el);
	formElement("h2", title, head, { id: "ed-dialog-title" });
	formButton(head, "Back", () => UI.close());
	el.addEventListener("cancel", (e) => {
		e.preventDefault();
		if (FORM.capture) cancelBinding();
		else UI.close();
	});
	el.addEventListener("keydown", (e) => e.stopPropagation());
	el.addEventListener("contextmenu", (e) => e.preventDefault());
	// the tap that opened this window lifts over it: a click whose press was not on the window (a pointer's click,
	// detail > 0, with no press here since it opened) is the finger leaving the canvas, not a press of what lies under
	// it now (it hit PLAY AS on the character window). Keys and a pad click with detail 0
	let downAt = -1;
	el.addEventListener("pointerdown", () => (downAt = performance.now()), true);
	el.addEventListener(
		"click",
		(e) => {
			if (e.detail && (downAt < 0 || performance.now() - downAt > 5000)) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		},
		true,
	);
	build(el);
	el.showModal();
	el.querySelector("button").focus();
}
function closeForm() {
	FORM.capture = null;
	if (FORM.el) {
		FORM.el.close();
		FORM.el.remove();
		FORM.el = null;
	}
	game.input.clear();
}
function formStatus(message) {
	FORM.message = message;
	const el = FORM.el && FORM.el.querySelector("[data-status]");
	if (el) el.textContent = message;
}
function cancelBinding() {
	FORM.capture = null;
	formStatus("Binding cancelled.");
	game.input.clear();
}
function beginBinding(a, kind) {
	FORM.capture = { a, kind, prev: game.input.padPrev.slice() };
	formStatus(
		"Press " +
			(kind === "pad" ? "a controller button" : "a key or mouse button") +
			" for " +
			CONTROL_ACTIONS.find((x) => x[0] === a)[1] +
			". Escape cancels.",
	);
}
function setBinding(code) {
	const c = FORM.capture;
	if (!c) return;
	if (!bindingCode(code) || RESERVED_KEYS.has(code)) {
		formStatus("That input is reserved. Choose another; Escape cancels.");
		return;
	}
	const conflict = CONTROL_ACTIONS.find(
		([a]) => a !== c.a && actionCodes(a).includes(code),
	);
	if (conflict) {
		formStatus(
			codeLabel(code) +
				" is used by " +
				conflict[1] +
				". Clear that binding first, or choose another.",
		);
		return;
	}
	CONTROL.bindings[c.a] = actionCodes(c.a)
		.filter((k) => k.startsWith("Pad") !== (c.kind === "pad"))
		.concat(code);
	FORM.capture = null;
	applyControls();
	menuRender();
	formStatus("Saved " + codeLabel(code) + ".");
}
addEventListener(
	"keydown",
	(e) => {
		if (!FORM.capture) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		if (e.code === "Escape") cancelBinding();
		else if (FORM.capture.kind === "key" && !e.repeat) setBinding(e.code);
	},
	true,
);
addEventListener(
	"pointerdown",
	(e) => {
		if (
			!FORM.capture ||
			FORM.capture.kind !== "key" ||
			e.pointerType !== "mouse"
		)
			return;
		e.preventDefault();
		e.stopImmediatePropagation();
		setBinding("Mouse" + e.button);
	},
	true,
);
function updateForm() {
	const inp = game.input,
		el = FORM.el;
	if (!el) return;
	const meter = el.querySelector("[data-pad]");
	if (meter)
		meter.textContent = inp.padId
			? inp.padId +
				" · sticks " +
				inp.padAxes.map((v) => v.toFixed(2)).join(", ") +
				" · buttons " +
				inp.padPrev
					.map((v, i) => (v ? i : null))
					.filter((v) => v !== null)
					.join(", ")
			: "No controller detected. Press a button to connect.";
	if (FORM.capture) {
		const c = FORM.capture;
		const i = inp.padPrev.findIndex((v, i) => v && !c.prev[i]);
		c.prev = inp.padPrev.slice();
		if (i === 9) cancelBinding();
		else if (i >= 0 && c.kind === "pad") setBinding("Pad" + i);
		return;
	}
	if (inp.pressed("pause") || inp.pressed("cancel")) {
		UI.close();
		return;
	}
	const all = [...el.querySelectorAll("button, input, select")].filter(
			(e) => !e.disabled,
		),
		cur = document.activeElement;
	let ix = Math.max(0, all.indexOf(cur));
	const focus = (d) => {
		ix = (ix + d + all.length) % all.length;
		all[ix].focus();
		all[ix].scrollIntoView({ block: "nearest" });
	};
	if (inp.repeat("menuUp")) focus(-1);
	else if (inp.repeat("menuDown")) focus(1);
	const dir = inp.repeat("menuLeft") ? -1 : inp.repeat("menuRight") ? 1 : 0;
	if (dir) {
		if (cur && cur.tagName === "SELECT") {
			cur.selectedIndex =
				(cur.selectedIndex + dir + cur.options.length) % cur.options.length;
			cur.dispatchEvent(new Event("change"));
		} else if (cur && ["range", "number"].includes(cur.type)) {
			dir > 0 ? cur.stepUp() : cur.stepDown();
			cur.dispatchEvent(new Event("change"));
		} else focus(dir);
	}
	if (inp.pressed("confirm") && all[ix]) {
		inp.consumeAll();
		all[ix].click();
	}
}
/** Settings > Controls: every action's keyboard and controller bindings, then the controller's and the touch
 *  buttons' settings. A binding is changed by choosing it and pressing the new key or button */
function controlsPage(el) {
	{
		formElement(
			"p",
			"Choose a binding to change it; changes save at once. Menu navigation always works with arrows / D-pad / left stick, Enter / A, and Escape / Menu. Backspace / B performs secondary actions in inventory and skill panels.",
			el,
			{ class: "ed-dev-intro" },
		);
		formElement(
			"p",
			"Mouse aims; left stick moves; right stick aims. Click either stick to interact or open a portal. View / Share opens inventory. Skills and passives are also in the pause menu.",
			el,
		);
		formElement("p", "", el, { "data-pad": "", class: "ed-meter" });
		const table = formElement("div", "", el, { class: "ed-bindings" });
		for (const [a, label] of CONTROL_ACTIONS) {
			const row = formElement("div", "", table, { class: "ed-binding" });
			formElement("strong", label, row);
			for (const kind of ["key", "pad"]) {
				const group = formElement("div", "", row);
				const codes = actionCodes(a).filter(
					(c) => c.startsWith("Pad") === (kind === "pad"),
				);
				const b = formButton(
					group,
					codes.map(codeLabel).join(" / ") || "Unbound",
					() => beginBinding(a, kind),
				);
				b.setAttribute(
					"aria-label",
					label + (kind === "key" ? " keyboard / mouse" : " gamepad"),
				);
				b.dataset.bind = a + ":" + kind;
				const clear = formButton(group, "Clear", () => {
					CONTROL.bindings[a] = actionCodes(a).filter(
						(c) => c.startsWith("Pad") !== (kind === "pad"),
					);
					applyControls();
					menuRender();
				});
				clear.setAttribute("aria-label", "Clear " + label + " " + kind);
			}
		}
		formElement("h3", "Controller & touch", el);
		formField(
			el,
			"Stick deadzone",
			"range",
			CONTROL.deadzone,
			(v) => {
				CONTROL.deadzone = v;
				applyControls();
			},
			{ min: 0.05, max: 0.5, step: 0.01 },
		);
		formField(
			el,
			"Invert right-stick Y",
			"checkbox",
			CONTROL.invertAimY,
			(v) => {
				CONTROL.invertAimY = v;
				applyControls();
			},
		);
		formField(
			el,
			"Vibration",
			"range",
			game.settings.rumble,
			(v) => game.settings.set("rumble", v),   // the engine's setting (saved with the player's other choices): 0 turns it off
			{ min: 0, max: 1, step: 0.05 },
		);
		formField(
			el,
			"Aim assist for sticks / touch",
			"checkbox",
			CONTROL.aimAssist,
			(v) => {
				CONTROL.aimAssist = v;
				applyControls();
			},
		);
		formField(
			el,
			"Touch controls",
			"select",
			CONTROL.touch,
			(v) => {
				CONTROL.touch = v;
				applyControls();
			},
			{
				options: [
					["auto", "Automatic"],
					["on", "Always show"],
					["off", "Hidden"],
				],
			},
		);
		formField(
			el,
			"Action buttons on",
			"select",
			CONTROL.handed,
			(v) => {
				CONTROL.handed = v;
				applyControls();
			},
			{
				options: [
					["right", "Right"],
					["left", "Left"],
				],
			},
		);
		formField(
			el,
			"Touch button size",
			"range",
			CONTROL.size,
			(v) => {
				CONTROL.size = v;
				applyControls();
			},
			{ min: 44, max: 72, step: 2 },
		);
		formField(
			el,
			"Touch opacity",
			"range",
			CONTROL.opacity,
			(v) => {
				CONTROL.opacity = v;
				applyControls();
			},
			{ min: 0.3, max: 1, step: 0.05 },
		);
		formButton(el, "Reset all controls", () => {
			Object.assign(CONTROL, CONTROL_DEFAULT, { bindings: {} });
			applyControls();
			menuRender();
		});
	}
}

/* Touch taps hit the same canvas widgets as a mouse. Only open world space starts a stick. */
game.input.touchFilter = (e) => {
	const sc = game.screen,
		pt = sc.clientToScreen(e.clientX, e.clientY),
		m = { x: pt[0] - sc.ix, y: pt[1] - sc.iy };
	return (
		!UI.modal &&
		ED.mode !== "title" &&
		ED.mode !== "gallery" &&
		!UI.hot.some((h) => (h.click || h.drag) && inRect(m, h))
	);
};
canvas.addEventListener("pointerdown", (e) => {
	if (
		e.pointerType === "mouse" ||
		(game.input.stickId === e.pointerId && game.input.stickOn)
	)
		return;
	UI.mouse.cx = e.clientX;
	UI.mouse.cy = e.clientY;
	UI.mouse.active = true;
	UI.mouse.down = true;
	game.input.press("Act:click");
	canvas.setPointerCapture(e.pointerId);
});
const endTouch = (e) => {
	if (e.pointerType !== "mouse") {
		game.input.release("Act:click");
		UI.mouse.down = false;
		UI.drag = null;
	}
};
addEventListener("pointerup", endTouch);
addEventListener("pointercancel", endTouch);
function pauseOnFocusLoss() {
	UI.mouse.down = false;
	UI.drag = null;
	if (!UI.modal && ["town", "level", "proving"].includes(ED.mode) && !ED.demo)
		UI.open("pause");
}
addEventListener("blur", pauseOnFocusLoss);
document.addEventListener("visibilitychange", () => {
	if (document.hidden) pauseOnFocusLoss();
});
/* Full screen: the game fills the phone without the browser's bars. On a touch screen, a tap on the title menu asks for
   it (a browser only goes full screen from a tap or a click); FULL SCREEN on the title and in the pause menu turn it
   on and off, and leaving it there is remembered. An iPhone has no full screen for a web page:
   there, Add to Home Screen opens Emberdeep as an app, with no browser bars (the page's web-app tags). */
const FS = {   // the engine's game.fullscreen (new E.Game({ fullscreen: 'button' }): the title's tap decides here, not the engine)
	can: () => game.fullscreen.supported,
	on: () => game.fullscreen.on,
	enter: () => game.fullscreen.enter(),
	exit: () => game.fullscreen.exit(),
	toggle() {
		OPT.fullscreen = !FS.on();
		saveOpts();
		if (OPT.fullscreen) FS.enter();
		else FS.exit();
	},
	/** from a tap on the title menu: a phone or a tablet (a finger is its main pointer) goes full screen unless the
	 *  player left it */
	auto() {
		if (OPT.fullscreen !== false && FS.can() && matchMedia("(pointer: coarse)").matches) FS.enter();
	},
};
for (const ev of ["fullscreenchange", "webkitfullscreenchange"])
	document.addEventListener(ev, () => syncTouchControls(true));
const TOUCH = { el: null, key: "" };
function syncTouchControls(force = false) {
	const show =
		!UI.top()?.dom &&
		(CONTROL.touch === "on" ||
			(CONTROL.touch === "auto" &&
				matchMedia("(any-pointer: coarse)").matches));
	const panel = UI.modal || ED.mode === "title" || ED.mode === "gallery";
	const key = [
		show,
		panel,
		ED.mode,
		CONTROL.size,
		CONTROL.handed,
		CONTROL.opacity,
		FS.on(),
	].join(":");
	if (!force && key === TOUCH.key) return;
	TOUCH.key = key;
	if (TOUCH.el) {
		for (const b of TOUCH.el.querySelectorAll("[data-act]"))
			game.input.release("Act:" + b.dataset.act);
		TOUCH.el.remove();
	}
	game.input.touchEnabled = show && !panel;
	if (!show) {
		TOUCH.el = null;
		HUD_layout();
		return;
	}
	const root = formElement("div", "", document.getElementById("stage"), {
		class: "ed-touch " + (CONTROL.handed === "left" ? "ed-left" : ""),
	});
	TOUCH.el = root;
	root.style.setProperty("--touch-size", CONTROL.size + "px");
	root.style.setProperty("--touch-opacity", CONTROL.opacity);
	if (!panel) {
		const actions = formElement("div", "", root, { class: "ed-touch-actions" });
		for (const [a, label] of [
			...SLOT_ACTS.map((a, i) => [a, "Skill " + (i + 1)]),
			["dodge", "Dodge"],
			["potion", "Potion"],
			["interact", "Use"],
		])
			formElement("button", label, actions, { type: "button", "data-act": a });
	}
	const bar = formElement("div", "", root, { class: "ed-touch-bar" });
	if (!(ED.mode === "title" && !UI.modal))   // the title's menu is all on the canvas (FULL SCREEN too)
		for (const [a, label] of ED.mode === "gallery" && !UI.modal
		? [
				["menuLeft", "Previous"],
				["menuRight", "Next"],
				["menuDown", "Reel"],
				["confirm", "Replay"],
				["labels", "Slow"],
				["pause", "Back"],
			]
		: panel
			? [["pause", "Back"]]
			: [
					["pause", "Menu"],
					["bag", "Bag"],
					["map", "Map"],
					["portal", "Portal"],
				])
		formElement("button", label, bar, { type: "button", "data-act": a });
	game.input.bindButtons(root);
	HUD_layout();
}
/* The HUD's frame (UI.frame, in screen pixels) on a phone. The safe areas first: the picture fills the whole screen,
   under the notch, the status bar and the home bar, and the HUD keeps out of them. Then the touch buttons: held
   upright, the action buttons take the bottom of the screen and the HUD bar (orbs, skills, xp) rides just above them;
   on a wide screen they stand in the ember orb's corner, above the HUD bar. The buttons at the top push the minimap,
   the boss bar and the notices down (barB). Runs when the buttons change and when the screen does. */
const SAFE = formElement("div", "", document.body, { "aria-hidden": "true" });
SAFE.style.cssText =
	"position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
function HUD_layout() {
	const sc = game.screen,
		F = UI.frame,
		rc = canvas.getBoundingClientRect(),
		cs = getComputedStyle(SAFE),
		pad = (v) => parseFloat(v) || 0;
	if (!(rc.width > 0 && rc.height > 0)) return;
	// page (CSS) pixels to screen pixels and back
	const sx = (x) => ((x - rc.left) * sc.dpr - sc.OX) / sc.S,
		sy = (y) => ((y - rc.top) * sc.dpr - sc.OY) / sc.S,
		py = (y) => rc.top + (y * sc.S + sc.OY) / sc.dpr;
	F.l = Math.max(0, Math.ceil(sx(rc.left + pad(cs.paddingLeft))));
	F.r = Math.max(0, Math.ceil(sc.W - sx(rc.right - pad(cs.paddingRight))));
	F.t = Math.max(0, Math.ceil(sy(rc.top + pad(cs.paddingTop))));
	F.b = Math.max(0, Math.ceil(sc.H - sy(rc.bottom - pad(cs.paddingBottom))));
	const acts = TOUCH.el && TOUCH.el.querySelector(".ed-touch-actions"),
		bar = TOUCH.el && TOUCH.el.querySelector(".ed-touch-bar"),
		tall = rc.height > rc.width;
	F.barB = bar && bar.childElementCount ? Math.max(0, Math.ceil(sy(bar.getBoundingClientRect().bottom))) : 0;
	if (acts) {
		acts.style.removeProperty("--touch-size");
		if (tall) {
			acts.style.bottom = "max(10px, env(safe-area-inset-bottom, 0px))";
			F.b = Math.max(F.b, Math.ceil(sc.H - sy(acts.getBoundingClientRect().top) + 3));
		} else {
			acts.style.bottom =
				Math.max(8, Math.ceil(rc.bottom - py(sc.H - F.b - 42))) + "px";   // the orbs reach 39 px up
			// a short wide screen (a phone on its side, a notch and a home bar taking their share): smaller buttons, so
			// the grid fits between the minimap and the HUD bar (the menu buttons and the minimap stay on the right for
			// either hand; a left hand's grid has the left side to itself)
			const a = acts.getBoundingClientRect(),
				mapB = py(F.t + HUD_under() + 4 + 54) + 4;
			if (CONTROL.handed !== "left" && a.top < mapB)
				acts.style.setProperty("--touch-size", Math.max(44, Math.floor((a.bottom - mapB - 10) / 3)) + "px");
		}
	}
	// in play the hero sits in the middle of the open ground between them (kept while a panel is up, so the view holds
	// still); the title and the gallery frame their own scenes
	if (!["town", "level", "proving"].includes(ED.mode)) game.cam.offset = null;
	else if (acts || !TOUCH.el) game.cam.offset = [Math.round((F.l - F.r) / 2), Math.round((Math.max(F.t, acts && tall ? F.barB : 0) - F.b) / 2)];
}
game.screen.listeners.push(HUD_layout);
applyControls(false);
