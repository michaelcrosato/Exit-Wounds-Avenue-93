/* =============================================================================
 * TOOLS: the playtester's switches (invulnerable, unlimited resources, no cooldowns, frozen AI, a paused or faster
 * world), travel, spawning and build experiments. They act on the hero you play, and he saves as usual: the whole game
 * is a test bench. The switches last for this visit; Settings > Tools sets them (64-menu.js draws the pages).
 * ============================================================================= */
const DEV_DEFAULT = {
	god: false,
	resources: false,
	cooldowns: false,
	freezeFoes: false,
	paused: false,
	speed: 1,
};
const DEV = {
	...DEV_DEFAULT,
	steps: 0,
	depth: 1,
	monster: "husk",
	count: 1,
	elite: 0,
	rarity: 3,
	itemLevel: 1,
	boss: null,
	mechs: [], // the mechanics added to every depth from the next one (46-mechanics-a.js reads them)
	runFrom: 1,
	runTo: 10,
};
/** true while the hero is in a world the tools can act on (the town, a depth, the Proving Grounds) */
const devInWorld = () => !!ED.hero && !!ED.L && ["town", "level", "proving"].includes(ED.mode);
function devRestore() {
	if (!ED.hero) return;
	reviveHero(ED.hero);
	ED.hero.cds = {};
	ED.hero.dodges = ED.hero.maxDodge;
	ED.hero.inv = 1;
}
function devStep() {
	if (!DEV.paused || !devInWorld()) return;
	// Step the same scene update used by live play, with panels temporarily detached.
	const stack = UI.stack;
	UI.stack = [];
	DEV.steps = 1;
	try {
		game.scene.update(1 / 60);
	} finally {
		DEV.steps = 0;
		UI.stack = stack;
		syncTouchControls(true);
	}
}
function devTravel(depth) {
	if (!Number.isFinite(depth)) return;
	DEV.depth = clamp(Math.round(depth), 1, 500);
	if (!ED.hero || ED.mode === "title") ED.hero = loadHeroOrNew(); // from the title: the chosen character's hero
	ED.savedLevel = null;
	devRestore();
	UI.closeAll();
	descend(DEV.depth);
}
function devSpawn(boss = false) {
	if (!devInWorld()) return;
	if (ED.foes.length >= 300) {
		formStatus("Spawn limit reached (300). Clear enemies first.");
		return;
	}
	const h = ED.hero;
	const count = Math.min(boss ? 1 : DEV.count, 300 - ED.foes.length);
	for (let i = 0; i < count; i++) {
		const a = h.facing + (i - (DEV.count - 1) / 2) * 0.4,
			pt = {
				x: h.x + Math.cos(a) * 52,
				y: h.y + Math.sin(a) * 52,
				z: 0,
				r: 8,
				step: 2,
			};
		ED.L.map.collide(pt);
		const m = boss
			? spawnBoss(DEV.boss || Object.keys(REG.bosses)[0], pt.x, pt.y, {
					level: Math.max(1, ED.depth),
				})
			: spawnMonster(DEV.monster, pt.x, pt.y, {
					level: Math.max(1, ED.depth),
					elite: DEV.elite,
				});
		if (m && boss) {
			ED.boss = m;
			wakeBoss(m);
		}
	}
	formStatus(
		"Spawned " + (boss ? "boss" : count + " enemies") + ". Back to resume.",
	);
}
/* =============================================================================
 * THE TUNING PAGES: the game's rule numbers (01-tune.js), section by section, in Settings (64-menu.js)
 * Simple shows the few settings that change the game the most; Advanced shows every one. Each setting says what it
 * changes, its default, and which source file reads it. The inspectors change one monster, boss, item or skill:
 * those edits are kept as overrides (ed:tune:ovr) and laid over the registries when the game loads.
 * ============================================================================= */
// tab: the Settings page open (kept for the next time); tier: Simple (1) or Advanced (2); find: the search box
const DEV_UI = { tab: E.store.get("ed:menu:tab", "graphics"), tier: E.store.get("ed:dev:tier", 1), find: "", pick: {}, flash: null };
/* ---------- overrides: one field of one registered part (monster, boss, item base, affix, skill) ---------- */
const TUNE_OVR = {};
const TUNE_ORIG = {};
{
	const saved = E.store.get("ed:tune:ovr", {});
	if (saved && typeof saved === "object")
		for (const k in saved) if (Number.isFinite(saved[k])) TUNE_OVR[k] = saved[k];
}
/** 'archetypes.husk.attacks.0.dmg' -> [the object holding it, its last key] (null if the part or path is gone) */
function ovrSlot(key) {
	const [kind, id, ...path] = key.split(".");
	let o = REG[kind] && REG[kind][id];
	if (!o || !path.length) return null;
	for (let i = 0; i < path.length - 1; i++) {
		o = o[path[i]];
		if (!o || typeof o !== "object") return null;
	}
	return [o, path[path.length - 1]];
}
/** the value a field had before any override (what Reset brings back) */
function ovrDefault(key) {
	if (key in TUNE_ORIG) return TUNE_ORIG[key];
	const s = ovrSlot(key);
	return s ? s[0][s[1]] : undefined;
}
function ovrWrite(key, v) {
	const s = ovrSlot(key);
	if (!s) return false;
	if (!(key in TUNE_ORIG)) TUNE_ORIG[key] = s[0][s[1]];
	if (v === undefined) {
		if (TUNE_ORIG[key] === undefined) delete s[0][s[1]];
		else s[0][s[1]] = TUNE_ORIG[key];
	} else s[0][s[1]] = v;
	const [kind, id] = key.split(".");
	if (kind === "archetypes") REG.archetypes[id]._measured = false; // (its swings are measured again)
	return true;
}
function ovrSet(key, v) {
	if (v === undefined) delete TUNE_OVR[key];
	else TUNE_OVR[key] = v;
	ovrWrite(key, v);
	E.store.set("ed:tune:ovr", TUNE_OVR);
	if (ED.hero && ED.hero.stats) computeStats(ED.hero);
}
for (const k in TUNE_OVR) ovrWrite(k, TUNE_OVR[k]);
const ovrCount = (prefix) => Object.keys(TUNE_OVR).filter((k) => k.startsWith(prefix)).length;

/* ---------- what the inspectors show: every number in a part's spec, with plain words for the known ones ---------- */
const DEV_SKIP = new Set(["palettes", "pal", "rig", "blob", "look", "over", "colors", "names", "runes", "tags", "themes", "slots", "music", "combo", "patterns", "body"]);
const DEV_FIELD = {
	archetypes: {
		hp: "Life at depth 1. Depth multiplies it (Monsters > Life growth per depth), then the Settings slider.",
		dmg: "Damage of one hit at depth 1, before each attack's own multiplier.",
		speed: "Walking speed in world units a second (16 is one tile; the hero runs 84).",
		r: "Body radius: how wide it is for collisions and for your swings to connect.",
		xp: "Experience it gives at depth 1 (grows with depth).",
		mass: "Weight. Knockback is divided by it; at 2 or more its swings also wind up slower.",
		armor: "Armor against physical hits (grows with depth).",
		weight: "How often it is picked for a pack, against the others allowed here (husks are 14, most 4 to 12). 0 removes it from random packs.",
		minDepth: "The first depth it can appear on (a pack may reach 2 depths ahead).",
		head: "Height of its head: where hits spark and damage numbers appear.",
		"attacks.*.dmg": "This attack's damage, times the monster's damage.",
		"attacks.*.wind": "Wind-up length, times the move's own (higher is slower and easier to dodge).",
		"attacks.*.recover": "Extra seconds it stays open after the swing.",
		"attacks.*.cool": "Seconds it waits after this attack before the next.",
		"attacks.*.kb": "How hard this attack shoves you.",
		"attacks.*.half": "Half the width of its swing, in radians (1.1 is about 63 degrees each side).",
		"shot.every": "Seconds between its shots (plus a random extra).",
		"shot.speed": "Speed of its projectiles.",
		"shot.dmg": "Shot damage, times the monster's damage.",
		"shot.n": "Projectiles per volley.",
		"shot.spread": "Angle between the projectiles of a volley.",
		"res.*": "Resistance to this element: 0.5 takes half damage, negative takes more.",
	},
	bosses: {
		hp: "Life, counted in normal monsters of its depth (14 = fourteen times a normal one).",
		dmg: "Damage, times a normal monster of its depth.",
		size: "How big it is drawn and how wide it is.",
		minDepth: "The first depth it can be the boss of.",
		"phases.*.at": "This phase begins when its life falls under this share (0.6 = 60%).",
		"phases.*.gap": "Seconds of rest between attack patterns in this phase.",
	},
	itemBases: {
		minIlvl: "The first item level it can drop at.",
		"dmg.0": "Lowest weapon damage at item level 1 (grows with item level).",
		"dmg.1": "Highest weapon damage at item level 1.",
		armor: "Armor at item level 1 (grows with item level).",
		weight: "How often it drops against the other bases of its slot (10 is standard; 0 never).",
		"implicit.*": "A stat every one of these carries, whatever else it rolls.",
	},
	itemAffixes: {
		"v.0": "The least it can roll at item level 1.",
		"v.1": "The most it can roll at item level 1 (deeper items roll higher).",
		weight: "How often it is chosen against the other affixes that fit (10 is standard; 0 never).",
		minIlvl: "The first item level it can appear on.",
		cap: "The most one line of it can ever reach.",
	},
	skills: {
		dmgMul: "A damage multiplier for this skill only (a tuning setting: 1 is the shipped damage).",
		cost: "Ember spent each use.",
		cd: "Cooldown in seconds.",
		gen: "Ember gained per hit (generators).",
		unlock: "Hero level needed to learn it.",
	},
	affixes: {
		minDepth: "The first depth an elite can roll it.",
		weight: "How often it is chosen.",
	},
};
const DEV_INSPECT = {
	monsters: [{ kind: "archetypes", name: "Monster", note: "Changes count for monsters that appear after the change (in Tools: Clear enemies & projectiles, then Spawn monsters). Attack timings re-measure on the next swing." },
		{ kind: "affixes", name: "Elite affix", note: "Champion and rare affixes (Hasted, Stoneskin, Vampiric...). Their effects are code; their rarity is here." }],
	bosses: [{ kind: "bosses", name: "Boss", note: "Life, damage and size count from the next time it spawns. Phase thresholds and pattern gaps count at once, even mid-fight." }],
	loot: [{ kind: "itemBases", name: "Item base", note: "Counts for items made after the change (drops, the vendor, Tools' Create item in bag)." },
		{ kind: "itemAffixes", name: "Item affix", note: "Counts for items made after the change." }],
	skills: [{ kind: "skills", name: "Skill", note: "Counts at once." }],
};
/** what the code uses when a spec leaves a field out (shown as the default, and what Reset returns to) */
const DEV_IMPLIED = { "skills.dmgMul": 1, "archetypes.attacks.*.dmg": 1, "archetypes.attacks.*.wind": 2.2, "archetypes.attacks.*.recover": 0.14, "archetypes.attacks.*.cool": 0.8, "archetypes.attacks.*.kb": 80, "archetypes.attacks.*.half": 1.1 };
const devImplied = (kind, path) => DEV_IMPLIED[kind + "." + path.replace(/\.\d+\./, ".*.")];
function devFieldHelp(kind, path) {
	const H = DEV_FIELD[kind] || {},
		star = path.replace(/\.\d+\./, ".*.").replace(/^(res|implicit)\.[^.]+$/, "$1.*");
	return H[path] || H[star] || H[path.split(".").pop()] || "A number in this part's definition. Search the source for its id to see how it is used.";
}
function devFields(spec, kind) {
	const out = [];
	const walk = (o, path, depth) => {
		for (const k of Object.keys(o)) {
			if (k.startsWith("_") || DEV_SKIP.has(k)) continue;
			const v = o[k],
				p = path ? path + "." + k : k;
			if (typeof v === "number" && Number.isFinite(v)) out.push(p);
			else if (v && typeof v === "object" && depth < 2 && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)) walk(v, p, depth + 1);
		}
	};
	walk(spec, "", 0);
	if (kind === "skills" && !out.includes("dmgMul")) out.unshift("dmgMul");
	if (kind === "archetypes" && Array.isArray(spec.attacks))   // each melee attack's timing, even where it uses the code's default
		spec.attacks.forEach((a, i) => {
			for (const f of ["dmg", "wind", "recover", "cool", "kb", "half"]) if (a && typeof a === "object" && !out.includes("attacks." + i + "." + f)) out.push("attacks." + i + "." + f);
		});
	const order = Object.keys(DEV_FIELD[kind] || {});
	return out.sort((a, b) => {
		const ia = order.indexOf(a), ib = order.indexOf(b);
		return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
	});
}

const DEV_NAMES = { hp: "Life", dmg: "Damage", speed: "Speed", r: "Body radius", xp: "Experience", mass: "Mass", armor: "Armor", weight: "Rarity weight", minDepth: "First depth", head: "Head height", cost: "Ember cost", cd: "Cooldown", gen: "Ember gained", unlock: "Unlock level", dmgMul: "Damage multiplier", size: "Size", minIlvl: "First item level", cap: "Cap", at: "Starts below", gap: "Rest between patterns", wind: "Wind-up", recover: "Recovery", cool: "Cooldown", kb: "Knockback", half: "Swing width", every: "Shot interval", n: "Projectiles", spread: "Spread", dur: "Duration" };
/** 'attacks.1.wind' -> 'Attack 2 › Wind-up', 'dmg.0' -> 'Damage (min)', 'res.fire' -> 'Resistance › fire' */
function devFieldName(path) {
	const seg = path.split("."), last = seg[seg.length - 1];
	if (/^\d+$/.test(last) && seg.length === 2) return (DEV_NAMES[seg[0]] || seg[0]) + (last === "0" ? " (min)" : last === "1" ? " (max)" : " #" + last);
	return seg.map((k, i) => (/^\d+$/.test(k) ? null : seg[i + 1] && /^\d+$/.test(seg[i + 1]) ? cap(k.replace(/s$/, "")) + " " + (+seg[i + 1] + 1) : k === "res" ? "Resistance" : k === "shot" ? "Shot" : k === "implicit" ? "Built-in" : DEV_NAMES[k] || k)).filter(Boolean).join(" › ");
}
/* ---------- small DOM helpers ---------- */
const devFmt = (v, K) => {
	const dec = (String(K.step).split(".")[1] || "").length,
		n = (+v).toFixed(dec);
	return K.unit === "x" ? n + "×" : K.unit === "%" ? n + "%" : K.unit === "s" ? n + " s" : K.unit === "+" ? (v > 0 ? "+" : "") + n : n;
};
function devStatus(msg) {
	formStatus(msg);
}
function devSection(el, title, blurb, tag = "h3") {
	formElement(tag, title, el);
	if (blurb) formElement("p", blurb, el, { class: "ed-dev-blurb" });
}
/** one knob: name, what it does, a slider with a number box, its default and source, and a reset */
function devKnobRow(parent, K) {
	const changed = tuneChanged(K.id),
		row = formElement("div", "", parent, { class: "ed-knob" + (changed ? " ed-changed" : ""), "data-knob": K.id });
	if (DEV_UI.flash === K.id) row.classList.add("ed-flash");
	const head = formElement("div", "", row, { class: "ed-knob-head" });
	const lab = formElement("label", K.label, head, { for: "knob-" + K.id });
	if (K.tier === 2) formElement("span", "advanced", lab, { class: "ed-tag" });
	const val = formElement("output", devFmt(TUNE[K.id], K), head, { class: "ed-val" });
	formElement("p", K.about, row, { class: "ed-about" });
	const ctl = formElement("div", "", row, { class: "ed-knob-ctl" });
	const range = formElement("input", "", ctl, { type: "range", id: "knob-" + K.id, min: K.min, max: K.max, step: K.step, "aria-label": K.label });
	range.value = TUNE[K.id];
	const num = formElement("input", "", ctl, { type: "number", min: K.min, max: K.max, step: K.step, "aria-label": K.label + " value" });
	num.value = TUNE[K.id];
	const reset = formButton(ctl, "↺", () => {
		tuneSet(K.id, K.def);
		sync();
		devStatus(K.label + " back to " + devFmt(K.def, K) + ".");
	});
	reset.title = "Back to the default (" + devFmt(K.def, K) + ")";
	reset.setAttribute("aria-label", "Reset " + K.label);
	const meta = formElement("p", "", row, { class: "ed-meta" });
	const sync = () => {
		range.value = num.value = TUNE[K.id];
		val.textContent = devFmt(TUNE[K.id], K);
		const c = tuneChanged(K.id);
		row.classList.toggle("ed-changed", c);
		meta.textContent = "Default " + devFmt(K.def, K) + (c ? " · now changed" : "") + " · read in " + K.where;
		devBadges();
	};
	range.oninput = () => {
		tuneSet(K.id, +range.value);
		sync();
	};
	num.onchange = () => {
		tuneSet(K.id, +num.value);
		sync();
	};
	sync();
}
/** the knobs of one section, grouped, filtered by tier and the search box */
function devKnobs(el, sec) {
	const list = TUNE_KNOBS.filter((K) => K.sec === sec && devVisible(K));
	if (!TUNE_KNOBS.some((K) => K.sec === sec)) return;
	if (!list.length) {
		formElement("p", "Switch to Advanced to see this section's settings.", el, { class: "ed-dev-blurb" });
		return;
	}
	let group = null;
	for (const K of list) {
		if (K.group !== group) {
			group = K.group;
			formElement("h4", group, el);
		}
		devKnobRow(el, K);
	}
}
function devVisible(K) {
	return DEV_UI.tier === 2 || K.tier === 1 || tuneChanged(K.id);
}
/** an inspector: pick one part, see and change every number in it */
function devInspector(el, I) {
	const parts = Object.values(REG[I.kind]).filter((p) => !String(p.id).startsWith("composed"));
	if (!parts.length) return;
	const pick = (DEV_UI.pick[I.kind] = REG[I.kind][DEV_UI.pick[I.kind]] ? DEV_UI.pick[I.kind] : parts[0].id);
	devSection(el, I.name + " inspector", I.note);
	formField(el, I.name, "select", pick, (v) => {
		DEV_UI.pick[I.kind] = v;
		menuRender();
	}, {
		options: parts.map((p) => {
			const n = ovrCount(I.kind + "." + p.id + ".");
			return [p.id, (p.name || p.id) + (p.slot ? " (" + p.slot + ")" : "") + (n ? " • " + n + " changed" : "")];
		}),
	});
	const spec = REG[I.kind][pick],
		box = formElement("div", "", el, { class: "ed-inspect" });
	const fields = devFields(spec, I.kind);
	if (!fields.length) formElement("p", "No numbers to change on this one.", box);
	for (const path of fields) {
		const key = I.kind + "." + pick + "." + path,
			def = ovrDefault(key),
			implied = devImplied(I.kind, path),
			cur = key in TUNE_OVR ? TUNE_OVR[key] : def === undefined ? (implied === undefined ? 0 : implied) : def;
		const row = formElement("div", "", box, { class: "ed-field-row" + (key in TUNE_OVR ? " ed-changed" : "") });
		const lab = formElement("label", devFieldName(path), row);
		formElement("small", " " + path, lab, { class: "ed-code" });
		const inp = formElement("input", "", row, { type: "number", step: "any", "aria-label": (spec.name || pick) + " " + path });
		inp.value = cur;
		const rb = formButton(row, "↺", () => {
			ovrSet(key, undefined);
			menuRender();
			devStatus(path + " back to " + (def === undefined ? "the default" : def) + ".");
		});
		rb.setAttribute("aria-label", "Reset " + path);
		rb.disabled = !(key in TUNE_OVR);
		formElement("p", devFieldHelp(I.kind, path) + "  Default: " + (def === undefined ? (implied === undefined ? "unset" : implied) : def) + ".", row, { class: "ed-about" });
		inp.onchange = () => {
			const v = +inp.value;
			if (!Number.isFinite(v)) return;
			const base = def === undefined ? implied : def;
			ovrSet(key, base !== undefined && Math.abs(v - base) < 1e-9 ? undefined : v);
			row.classList.toggle("ed-changed", key in TUNE_OVR);
			rb.disabled = !(key in TUNE_OVR);
			devStatus((spec.name || pick) + ": " + path + " set to " + v + ".");
			devBadges();
		};
	}
	const acts = formElement("div", "", el, { class: "ed-row" });
	formButton(acts, "Reset this " + I.name.toLowerCase(), () => {
		for (const k of Object.keys(TUNE_OVR)) if (k.startsWith(I.kind + "." + pick + ".")) ovrSet(k, undefined);
		menuRender();
		devStatus((spec.name || pick) + " is back to its shipped numbers.");
	});
	if (I.kind === "archetypes" && devInWorld())
		formButton(acts, "Spawn one to test", () => {
			const was = DEV.monster, n = DEV.count;
			DEV.monster = pick;
			DEV.count = 1;
			devSpawn();
			DEV.monster = was;
			DEV.count = n;
		});
	if (I.kind === "bosses" && devInWorld())
		formButton(acts, "Spawn it to test", () => {
			const was = DEV.boss;
			DEV.boss = pick;
			devSpawn(true);
			DEV.boss = was;
		});
	if (I.kind === "itemBases" && devInWorld())
		formButton(acts, "Create one in the bag", () => {
			if (ED.hero.bag.length >= BAG_MAX) return devStatus("Bag full. Make room first.");
			ED.hero.bag.push(makeItem({ base: pick, ilvl: DEV.itemLevel, rarity: DEV.rarity }));
			devStatus("Added a " + (spec.name || pick) + " to the bag.");
		});
}
/* ---------- the tuning pages' counts ---------- */
/** how many of a tuning page's numbers are changed from the shipped game (0 for the other pages) */
function devTabCount(id) {
	if (!TUNE_SECTIONS.some((S) => S.id === id)) return 0;
	const kinds = (DEV_INSPECT[id] || []).map((I) => I.kind + ".");
	return TUNE_KNOBS.filter((K) => K.sec === id && tuneChanged(K.id)).length + Object.keys(TUNE_OVR).filter((k) => kinds.some((p) => k.startsWith(p))).length;
}
function devBadges() {
	const el = FORM.el;
	if (!el) return;
	for (const b of el.querySelectorAll("[data-tab]")) {
		const n = devTabCount(b.dataset.tab),
			s = b.querySelector(".ed-badge");
		if (s) s.textContent = n ? n : "";
	}
	const t = el.querySelector("[data-tuned]");
	if (t) {
		const n = TUNE_KNOBS.filter((K) => tuneChanged(K.id)).length + Object.keys(TUNE_OVR).length;
		t.textContent = n ? n + " change" + (n === 1 ? "" : "s") + " from the shipped game, saved in this browser." : "The game is as shipped.";
	}
}

const DEV_GUIDE = [
	["Change how a monster behaves", "How aggressive monsters are lives in Monsters > Aggression: how far they see you, how many may attack at once, the pause between attacks, and how long they telegraph a swing. To change one monster (its life, speed, damage, each attack's wind-up and cooldown), use the Monster inspector at the bottom of Monsters.", "monsters", "sight"],
	["Make a monster tougher, weaker or faster", "Monsters > Monster inspector: pick it, then change hp, dmg or speed. For all monsters at once, use the Settings difficulty sliders, or Monsters > Strength for how they grow with depth.", "monsters"],
	["Change gravity", "Physics & world > Gravity. It changes how hard everything falls: monsters thrown into the air, your falls, hopping slimes, lobbed shots and loot bouncing out of corpses.", "world", "gravity"],
	["Change how an item works", "Loot > Item base inspector (weapon damage, armor, how often it drops) and Item affix inspector (each magic property's roll range and rarity). Drop rates, rarity and prices are in Loot's sliders.", "loot"],
	["More or less loot", "Loot > Drops: item drop chance, gold, potions, and elite and boss items. Loot > Rarity luck makes drops better.", "loot", "dropChance"],
	["Tune the dodge roll and movement", "Hero > Movement and Dodge roll: speed, distance, duration, recharge and charges.", "hero", "dodgeSpeed"],
	["The deep gets too hard (or too easy)", "Two numbers race: Monsters > Life and Damage growth per depth against Loot > Item power growth. Lower the first or raise the second to keep up longer.", "monsters", "foeHpGrowth"],
	["Make a boss fight longer or faster", "Bosses: life, damage and pattern speed for all of them; the Boss inspector changes one, including how long it rests between attacks in each phase.", "bosses"],
	["A skill is too strong, weak or slow", "Skills > Skill inspector: its damage multiplier, ember cost, cooldown and ember generated.", "skills"],
	["Level up faster or slower", "Progression: XP needed per level, points per level, and damage per skill rank.", "progress", "xpCurve"],
	["Make hits feel heavier or calmer", "Physics & world > Feel (hit stop and screen shake) and Combat > Knockback.", "world", "hitStop"],
	["Spawn monsters, travel, make items", "Tools: go invulnerable, freeze or pause the world, jump to any depth, spawn any monster or boss, grant points and gold, make any item. They act on the hero you play.", "tools"],
];
/* ---------- recording a session for a bug report (E.session: the engine records, tools/replay.mjs replays) ---------- */
// a sharper checksum for the recording: the hero, the level and the crowd, so a replay stops at the first frame that differs
game.stateHash = () => {
	const h = ED.hero;
	return [ED.mode || "", ED.depth || 0, h ? h.x : 0, h ? h.y : 0, h ? h.hp : 0, (ED.foes || []).length, (ED.drops || []).length];
};
function devSessionBlock(el) {
	const S = E.session,
		live = S.recording || S.replaying; // (a replay lays the panel out as the recording did, so its taps land on the same buttons)
	devSection(el, "Record a session for a bug report", "Turn recording on and play. When something goes wrong, save the session and send it to Claude: it replays your exact game, frame by frame, and sees what you saw. Recording starts with the next load and goes on until you turn it off. While recording, the GPU lighting is off.", "h4");
	formField(el, "Record sessions (from the next load)", "checkbox", S.wanted(), (v) => {
		S.record(v);
		menuRender();
	});
	if (live) {
		const d = S.data, secs = d.frames.length ? (d.frames[d.frames.length - 1] - d.frames[0]) / 1000 : 0;
		formElement("p", "Recording this session: " + Math.floor(secs / 60) + " min " + Math.round(secs % 60) + " s, " + d.frames.length + " frames, " + d.events.length + " inputs.", el, { class: "ed-about" });
		formButton(el, "Save this session", () => {
			if (S.share) S.share().then(() => formStatus("Session saved: send the file to Claude with what went wrong and when."));
		});
	} else if (S.wanted()) formButton(el, "Start recording now (reloads the page)", () => location.reload());
}
/** Help's guide to the tuning: how its pages work, and where each common change lives */
function devGuide(el) {
	devSection(el, "Where do I change…?", "Tap a question to jump to the right place.");
	for (const [q, a, tab, knobId] of DEV_GUIDE) {
		const card = formElement("div", "", el, { class: "ed-guide" });
		formButton(card, q + " →", () => menuGo(tab, knobId)).className = "ed-guide-q";
		formElement("p", a, card, { class: "ed-about" });
	}
	devSection(el, "How the tuning pages work", null);
	const ul = formElement("ul", "", el, { class: "ed-dev-list" });
	for (const t of [
		"Each page under Tuning is one part of the game. It starts with what that part does, then its settings, grouped.",
		"Simple shows the settings that change the game the most. Advanced shows every one (and Simple always shows any you changed).",
		"Every setting says what it changes in plain words, its default, and the source file that reads it, if you want to go further than the slider.",
		"Drag a slider or type an exact number. ↺ puts one setting back; each page also has a reset for the whole page.",
		"Changes count at once and stay in this browser until you reset them. While any is in force, TUNED shows at the top of the screen.",
		"Copy tuning puts all your changes on the clipboard, so you can keep them, share them, or hand them to Claude to make them the game's new defaults.",
	])
		formElement("li", t, ul);
	devSection(el, "Not here?", "Some things are code, not numbers: a brand-new attack, a different way for one monster to move, a new item power. Ask Claude, and name the part (for example “make skeletons circle around me before attacking”).");
}
/** a tuning page: Simple or Advanced, the copy, paste and reset of all the tuning, then the section's knobs and inspectors */
function devTuneTab(el, sec) {
	const S = TUNE_SECTIONS.find((s) => s.id === sec);
	const bar = formElement("div", "", el, { class: "ed-dev-bar" });
	const tiers = formElement("div", "", bar, { class: "ed-seg", role: "group", "aria-label": "Detail" });
	for (const [t, name] of [[1, "Simple"], [2, "Advanced"]]) {
		const b = formButton(tiers, name, () => {
			DEV_UI.tier = t;
			E.store.set("ed:dev:tier", t);
			menuRender();
		});
		b.setAttribute("aria-pressed", String(DEV_UI.tier === t));
	}
	formButton(bar, "Copy tuning", () => devCopy());
	formButton(bar, "Paste tuning", () => devPaste());
	formButton(bar, "Reset all tuning", () => {
		if (!confirm("Put every tuning setting and inspector change back to the shipped game?")) return;
		tuneReset();
		for (const k of Object.keys(TUNE_OVR)) ovrSet(k, undefined);
		menuRender();
		devStatus("Everything is back to the shipped game.");
	});
	formElement("p", "", el, { class: "ed-meta", "data-tuned": "" });
	formElement("p", S.blurb, el, { class: "ed-dev-intro" });
	devKnobs(el, sec);
	for (const I of DEV_INSPECT[sec] || []) devInspector(el, I);
	const acts = formElement("div", "", el, { class: "ed-row" });
	formButton(acts, "Reset all of " + S.name, () => {
		tuneReset(TUNE_KNOBS.filter((K) => K.sec === sec).map((K) => K.id));
		const kinds = (DEV_INSPECT[sec] || []).map((I) => I.kind + ".");
		for (const k of Object.keys(TUNE_OVR)) if (kinds.some((p) => k.startsWith(p))) ovrSet(k, undefined);
		menuRender();
		devStatus(S.name + " is back to the shipped game.");
	});
}
/** the tuning's part of Settings' search: every section's knobs (Simple and Advanced), and every monster, boss, item
 *  and skill by name in the inspectors; returns how many it found */
function devSearch(el, q) {
	let n = 0;
	for (const S of TUNE_SECTIONS) {
		const list = TUNE_KNOBS.filter((K) => K.sec === S.id && (K.label + " " + K.about + " " + K.group + " " + K.id).toLowerCase().includes(q));
		if (!list.length) continue;
		formElement("h3", "Tuning › " + S.name, el);
		for (const K of list) devKnobRow(el, K);
		n += list.length;
	}
	const parts = [];
	for (const sec in DEV_INSPECT)
		for (const I of DEV_INSPECT[sec])
			for (const p of Object.values(REG[I.kind]))
				if (!String(p.id).startsWith("composed") && ((p.name || "") + " " + p.id).toLowerCase().includes(q)) parts.push([sec, I, p]);
	if (parts.length) {
		formElement("h3", "In the inspectors", el);
		const box = formElement("div", "", el, { class: "ed-row" });
		for (const [sec, I, p] of parts.slice(0, 40))
			formButton(box, I.name + ": " + (p.name || p.id), () => {
				DEV_UI.pick[I.kind] = p.id;
				menuGo(sec);
				const sel = FORM.el && [...FORM.el.querySelectorAll(".ed-field select")].find((s) => s.value === p.id);
				if (sel) sel.scrollIntoView({ block: "start" });
			});
	}
	return n + parts.length;
}
function devExport() {
	const tune = {};
	for (const K of TUNE_KNOBS) if (tuneChanged(K.id)) tune[K.id] = TUNE[K.id];
	return JSON.stringify({ emberdeepTuning: 1, tune, overrides: TUNE_OVR }, null, 1);
}
function devCopy() {
	const text = devExport();
	const done = () => devStatus("Tuning copied. Paste it back later, or hand it to Claude to bake in as the defaults.");
	if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt("Copy this tuning:", text));
	else prompt("Copy this tuning:", text);
}
function devPaste() {
	const text = prompt("Paste tuning copied from Settings:");
	if (!text) return;
	try {
		const o = JSON.parse(text);
		if (!o || o.emberdeepTuning !== 1) throw new Error("not copied tuning");
		tuneReset();
		for (const k of Object.keys(TUNE_OVR)) ovrSet(k, undefined);
		for (const id in o.tune || {}) tuneSet(id, +o.tune[id]);
		for (const k in o.overrides || {}) if (Number.isFinite(o.overrides[k])) ovrSet(k, o.overrides[k]);
		menuRender();
		devStatus("Tuning loaded.");
	} catch (err) {
		devStatus("That is not tuning copied from Settings (" + err.message + ").");
	}
}
/** Settings > Tools: the switches, travel, encounters, build experiments and recording. The world's tools wait for a
 *  game (the town, a depth, the Proving Grounds); travel starts one from the title */
function devToolsPage(el) {
	const live = devInWorld(),
		h = ED.hero,
		world = (b) => {
			b.disabled = !live;
			return b;
		};
	formElement("p", "These act on the hero you play, and he saves as usual. The switches last until you reload." + (live ? "" : " Start or continue a game to use the ones that act on the world."), el, { class: "ed-dev-intro" });
	formElement("h4", "Simulation", el);
	for (const [key, label] of [
		["god", "Invulnerable"],
		["resources", "Unlimited ember, potions & dodges"],
		["cooldowns", "No skill cooldowns"],
		["freezeFoes", "Freeze enemy AI"],
		["paused", "Pause simulation"],
	]) {
		formField(el, label, "checkbox", DEV[key], (v) => {
			DEV[key] = v;
			if (key === "cooldowns" && v && ED.hero) ED.hero.cds = {};
		});
	}
	formField(
		el,
		"Simulation speed",
		"select",
		DEV.speed,
		(v) => {
			DEV.speed = +v;
			slowMoReset(DEV.speed);
		},
		{ options: [0.25, 0.5, 1, 2, 4].map((v) => [v, v + "×"]) },
	);
	const sim = formElement("div", "", el, { class: "ed-row" });
	world(formButton(sim, "Step 1 frame (while paused)", devStep));
	world(
		formButton(sim, "Restore life & resources", () => {
			devRestore();
			formStatus("Life, ember, potions, dodges and cooldowns restored.");
		}),
	);
	world(
		formButton(sim, live && h.bot ? "Stop autopilot" : "Start autopilot", () => {
			botOn(ED.hero, !ED.hero.bot);
			menuRender();
		}),
	);
	formElement("h4", "Travel", el);
	formField(
		el,
		"Depth (1–500)",
		"number",
		DEV.depth,
		(v) => {
			if (Number.isFinite(v)) DEV.depth = clamp(Math.round(v), 1, 500);
		},
		{ min: 1, max: 500, step: 1 },
	);
	const go = formElement("div", "", el, { class: "ed-row" });
	formButton(go, "Travel to depth", () => devTravel(DEV.depth));
	const away = (fn) => () => {
		if (!ED.hero || ED.mode === "title") ED.hero = loadHeroOrNew();
		UI.closeAll();
		devRestore();
		fn();
	};
	formButton(go, "Return to town", away(() => goTown()));
	formButton(go, "Proving grounds", away(() => game.go("proving")));
	formButton(go, "Gallery", away(() => game.go("gallery")));
	if (ED.mode === "title")
		formButton(go, "Watch the attract demo", () => {
			UI.closeAll();
			startDemo();
		}).title = "The autopilot plays a random depth, as the title does when left alone; any key comes back";
	formElement("h4", "Autopilot run", el);
	formElement("p", "The autopilot plays depth after depth at 3× speed and logs each one: a soak or balance run (__ed.botRun). It revives and goes on after a death, up to 10.", el, { class: "ed-about" });
	formField(el, "From depth", "number", DEV.runFrom, (v) => Number.isFinite(v) && (DEV.runFrom = clamp(Math.round(v), 1, 500)), { min: 1, max: 500, step: 1 });
	formField(el, "To depth", "number", DEV.runTo, (v) => Number.isFinite(v) && (DEV.runTo = clamp(Math.round(v), 1, 500)), { min: 1, max: 500, step: 1 });
	const run = formElement("div", "", el, { class: "ed-row" });
	formButton(run, BOT_RUN.on ? "Stop the run" : "Start the run", () => {
		if (BOT_RUN.on) {
			BOT_RUN.on = false;
			slowMoReset(DEV.speed);
			if (ED.hero) botOn(ED.hero, false);
			formStatus("Run stopped.");
		} else {
			if (!ED.hero || ED.mode === "title") ED.hero = loadHeroOrNew();
			UI.closeAll();
			botRun({ from: DEV.runFrom, to: Math.max(DEV.runFrom, DEV.runTo) });
		}
		menuRender();
	});
	if (BOT_RUN.log.length) {
		const t = formElement("div", "", el, { class: "ed-keys ed-run" });
		for (const r of BOT_RUN.log.slice(-12)) {
			formElement("span", "Depth " + r.depth + " · " + r.name, t);
			formElement("span", "level " + r.level + " · " + r.hp + "% life · " + r.deaths + " deaths" + (r.cleared ? "" : " · died"), t);
		}
	}
	formElement("h4", "Extra mechanics", el);
	formElement("p", "Mechanics added to every depth from the next one on, beside the depth's own (a ?mechs= link does the same). Until you reload.", el, { class: "ed-about" });
	const mech = formElement("div", "", el, { class: "ed-seg ed-seg-wrap", role: "group", "aria-label": "Extra mechanics" });
	for (const M of Object.values(REG.mechanics)) {
		const b = formButton(mech, M.name || M.id, () => {
			DEV.mechs = DEV.mechs.includes(M.id) ? DEV.mechs.filter((x) => x !== M.id) : DEV.mechs.concat(M.id);
			menuRender();
		});
		b.setAttribute("aria-pressed", String(DEV.mechs.includes(M.id)));
	}
	formElement("h4", "Encounters", el);
	formField(el, "Monster", "select", DEV.monster, (v) => (DEV.monster = v), { options: Object.values(REG.archetypes).map((m) => [m.id, m.name || m.id]) });
	formField(el, "Count", "select", DEV.count, (v) => (DEV.count = +v), { options: [1, 5, 10, 25].map((n) => [n, n]) });
	formField(el, "Monster tier", "select", DEV.elite, (v) => (DEV.elite = +v), {
		options: [
			[0, "Normal"],
			[1, "Champion"],
			[2, "Rare"],
		],
	});
	world(formButton(el, "Spawn monsters", () => devSpawn()));
	formField(el, "Boss", "select", DEV.boss || Object.keys(REG.bosses)[0], (v) => (DEV.boss = v), { options: Object.values(REG.bosses).map((b) => [b.id, b.name || b.id]) });
	world(formButton(el, "Spawn boss", () => devSpawn(true)));
	const enc = formElement("div", "", el, { class: "ed-row" });
	world(
		formButton(enc, "Clear enemies & projectiles", () => {
			ED.foes.length = 0;
			ED.boss = null;
			ED.fx.length = 0;
			GRID.build([]);
			formStatus("Enemies cleared without kill rewards.");
		}),
	);
	world(
		formButton(enc, "Reveal map", () => {
			ED.L.seen.fill(1);
			ED.L.seenV = (ED.L.seenV || 0) + 1;
			formStatus("Map revealed.");
		}),
	);
	formElement("h4", "Build experiments", el);
	const build = formElement("div", "", el, { class: "ed-row" });
	world(
		formButton(build, "Grant 10 skill & passive points", () => {
			ED.hero.pts.skill += 10;
			ED.hero.pts.passive += 10;
			formStatus("Granted 10 points of each type.");
		}),
	);
	world(
		formButton(build, "Unlock all skills", () => {
			for (const id in REG.skills) if (!ED.hero.skills[id]) ED.hero.skills[id] = { rank: 1 };
			formStatus("All skills unlocked. Assign them in Skills.");
		}),
	);
	world(
		formButton(build, "Gain a level", () => {
			const h = ED.hero,
				k = (1 + (h.stats.xpGain || 0) / 100) * DIFF.xp; // (gainXp scales by the hero's bonus and Difficulty's)
			gainXp(h, Math.max(1, SCALE.xpNeed(h.level) - h.xp) / k + 0.01);
			formStatus("Level " + h.level + ".");
		}),
	);
	world(
		formButton(build, "Grant 10,000 gold", () => {
			ED.hero.gold += 10000;
			formStatus("Granted 10,000 gold.");
		}),
	);
	formField(
		el,
		"Item level",
		"number",
		DEV.itemLevel,
		(v) => {
			if (Number.isFinite(v)) DEV.itemLevel = clamp(Math.round(v), 1, 500);
		},
		{ min: 1, max: 500, step: 1 },
	);
	formField(el, "Item rarity", "select", DEV.rarity, (v) => (DEV.rarity = +v), {
		options: [
			[0, "Common"],
			[1, "Magic"],
			[2, "Rare"],
			[3, "Legendary"],
		],
	});
	world(
		formButton(el, "Create item in bag", () => {
			if (ED.hero.bag.length >= BAG_MAX) return formStatus("Bag full. Make room first.");
			ED.hero.bag.push(makeItem({ ilvl: DEV.itemLevel, rarity: DEV.rarity }));
			formStatus("Item added to inventory.");
		}),
	);
	devSessionBlock(el);
	devSection(el, "Labs", "Every lab, test page and demo of the engine.", "h4");
	formButton(el, "All labs ↗", () => location.assign("labs.html")).title = "The Labs page: every lab, test page and demo"; // examples/labs.html, /labs on the site: "labs.html" works from both
}
/** every step before the world moves: the switches that keep the hero topped up */
function devBeforeWorld() {
	const h = ED.hero;
	if (DEV.resources && h && h.alive) {
		h.ember = h.maxEmber;
		h.potions = h.maxPotions;
		h.dodges = h.maxDodge;
		const C = characterOf(h);
		if (C.prime) C.prime(h); // a character's own resource too (Dan's brood)
	}
	if (DEV.cooldowns && h) h.cds = {};
}
/** what the screen says about a game that is not as shipped: TUNED (the tuning), the switches in force, and the
 *  overlays Settings > Graphics turns on (the collision circles, the frame rate and timings) */
function devDraw(r) {
	if (ED.mode === "title" || ED.demo) return;
	if (OPT.hitboxes)
		for (const u of [ED.hero, ...ED.foes])
			if (u && u.alive) r.decal(() => r.groundRing(u.x, u.y, u.r, u === ED.hero ? "#8fe3ff" : "#ff8a6a", 0.9), { emissive: true });
	const tuned = Object.keys(TUNE_OVR).length || TUNE_KNOBS.some((K) => tuneChanged(K.id)),
		on = [DEV.god && "INVULNERABLE", DEV.resources && "UNLIMITED", DEV.cooldowns && "NO COOLDOWNS", DEV.freezeFoes && "AI FROZEN", DEV.paused && "PAUSED", DEV.speed !== 1 && DEV.speed + "X"].filter(Boolean);
	if (!tuned && !on.length && !OPT.perfOverlay) return;
	r.overlay((g) => {
		let y = 4 + UI.frame.t;
		const line = (t, c) => {
			E.font.text(g, t, r.W / 2, y, c, { align: "center", font: "tiny" });
			y += 9;
		};
		if (tuned) line("TUNED", "#8fe3ff");
		if (on.length) line(on.join(" • "), "#ffc06a");
		if (OPT.perfOverlay) line(Math.round(game.fps) + " FPS • " + game.stats.updateMs.toFixed(1) + "ms UPDATE • " + game.stats.renderMs.toFixed(1) + "ms DRAW • " + ED.foes.length + " FOES", "#e8e0f8");
	});
}
