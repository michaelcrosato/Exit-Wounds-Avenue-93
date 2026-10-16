// Behavioral regression checks: real keyboard/mouse/touch events and Gamepad API polling.
// Run after npm run build. Screenshots and a JSON result are saved under check-output/controls.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const out = resolve("check-output/controls");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve("examples/emberdeep.html")).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [],
	checks = [];
const context = await browser.newContext({
	viewport: { width: 1280, height: 800 },
});
await context.addInitScript(() => {
	window.testPads = [];
	Object.defineProperty(navigator, "getGamepads", {
		value: () => window.testPads,
	});
});
function track(page) {
	page.on("pageerror", (e) => errors.push(e.message));
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});
}
const page = await context.newPage();
track(page);
async function ready(p, hash = "town") {
	await p.goto(url + (hash ? "#" + hash : ""));
	await p.waitForFunction(() => window.__ed?.ED.L);
	await p.waitForTimeout(700);
}
async function key(p, code) {
	await p.keyboard.down(code);
	await p.waitForTimeout(80);
	await p.keyboard.up(code);
	await p.waitForTimeout(80);
}
async function canvasButton(p, label, touch = false) {
	await p.waitForFunction(
		(label) => window.__ed.UI.hot.some((h) => h.label === label),
		label,
	);
	const [x, y] = await p.evaluate((label) => {
		const { game, UI } = window.__ed,
			h = UI.hot.find((h) => h.label === label),
			sc = game.screen,
			rc = sc.canvas.getBoundingClientRect();
		return [
			rc.left +
				((h.x + h.w / 2) * sc.S + sc.OX - Math.round(sc.fx * sc.S)) / sc.dpr,
			rc.top +
				((h.y + h.h / 2) * sc.S + sc.OY - Math.round(sc.fy * sc.S)) / sc.dpr,
		];
	}, label);
	if (touch) await p.touchscreen.tap(x, y);
	else await p.mouse.click(x, y);
	await p.waitForTimeout(130);
}
/* a page of the Settings window, opened from the pause menu (or the title) */
async function settingsPage(p, tab, touch = false) {
	await canvasButton(p, "SETTINGS", touch);
	const t = p.getByRole("tab", { name: tab, exact: true });
	if (touch) await t.tap();
	else await t.click();
	await p.waitForTimeout(100);
}
const save = (p) =>
	p.evaluate(() => JSON.stringify(My3D2dge.store.get("ed:save")));
/* the phone layout, in page pixels: whether the picture fills the screen, where the HUD bar, the action buttons, the
   top buttons and the minimap sit (UI.frame: the HUD's frame, 61-controls HUD_layout) */
const phoneLayout = (p) =>
	p.evaluate(() => {
		const sc = __ed.game.screen,
			F = __ed.UI.frame,
			rc = sc.canvas.getBoundingClientRect(),
			py = (y) => rc.top + (y * sc.S + sc.OY) / sc.dpr,
			a = document.querySelector(".ed-touch-actions")?.getBoundingClientRect(),
			b = document.querySelector(".ed-touch-bar")?.getBoundingClientRect(),
			under = F.barB > 0 ? Math.max(0, Math.ceil(F.barB - F.t) + 1) : 0;
		return {
			fills:
				sc.OX <= 0 && sc.OY <= 0 && sc.W * sc.S >= sc.canvas.width - sc.S && sc.H * sc.S >= sc.canvas.height - sc.S,
			hudTop: py(sc.H - F.b - 39),   // the orbs' tops
			hudBottom: py(sc.H - F.b - 5),
			gridTop: a && a.top,
			gridBottom: a && a.bottom,
			barBottom: b && b.bottom,
			mapTop: py(F.t + under + 4),
			mapBottom: py(F.t + under + 58),
		};
	});
async function check(name, fn) {
	await fn();
	checks.push(name);
	console.log("ok", name);
}
async function padButton(i) {
	await page.evaluate((i) => {
		window.testPads[2].buttons[i].pressed = true;
	}, i);
	await page.waitForTimeout(100);
	await page.evaluate((i) => {
		window.testPads[2].buttons[i].pressed = false;
	}, i);
	await page.waitForTimeout(100);
}
try {
	await ready(page);
	await check(
		"Menu access, keyboard rebinding, conflicts, reset and persistence",
		async () => {
			await key(page, "Escape");
			await settingsPage(page, "Controls");
			await page
				.getByRole("button", {
					name: "Move right keyboard / mouse",
					exact: true,
				})
				.click();
			await key(page, "KeyR");
			assert.deepEqual(await page.evaluate(() => __ed.CONTROL.bindings.right), [
				"Pad15",
				"KeyR",
			]);
			await page
				.getByRole("button", { name: "Move up keyboard / mouse", exact: true })
				.click();
			await key(page, "KeyR");
			assert.match(
				await page.locator("[data-status]").innerText(),
				/used by Move right/,
			);
			await key(page, "Escape");
			assert.equal(await page.locator("dialog").count(), 1);
			await key(page, "Escape");
			await key(page, "Escape");
			const before = await page.evaluate(() => [
				__ed.ED.hero.x,
				__ed.ED.hero.y,
			]);
			await page.keyboard.down("KeyR");
			await page.waitForTimeout(400);
			await page.keyboard.up("KeyR");
			const after = await page.evaluate(() => [__ed.ED.hero.x, __ed.ED.hero.y]);
			assert.ok(
				Math.hypot(after[0] - before[0], after[1] - before[1]) > 10,
				"rebound movement moves hero",
			);
			await ready(page);
			assert.ok(
				await page.evaluate(() => __ed.game.input.map.right.includes("KeyR")),
			);
			await key(page, "Escape");
			await settingsPage(page, "Controls");
			await page
				.getByRole("button", { name: "Skill 1 keyboard / mouse", exact: true })
				.click();
			await page.mouse.click(640, 220, { button: "middle" });
			assert.ok(
				await page.evaluate(() => __ed.game.input.map.s0.includes("Mouse1")),
			);
			await page
				.getByRole("button", { name: "Reset all controls", exact: true })
				.click();
			assert.ok(
				await page.evaluate(
					() =>
						__ed.game.input.map.s0.includes("Mouse0") &&
						__ed.game.input.map.right.includes("KeyD"),
				),
			);
			await page.screenshot({ path: out + "/desktop-controls.png" });
			await key(page, "Escape");
			await key(page, "Escape");
		},
	);
	await check(
		"Gamepad in slot 2: movement, aim, actions, menus and disconnect cleanup",
		async () => {
			await page.evaluate(() => {
				window.testPads[2] = {
					index: 2,
					id: "Test standard controller",
					connected: true,
					axes: [0, 0, 0, 0],
					buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
				};
				__ed.ED.hero.act = null;
				window.skillEvents = 0;
				__ed.BUS.on("skill", () => window.skillEvents++);
			});
			// A parked mouse over a skill widget must not block keyboard/gamepad attacks.
			const hudPoint = await page.evaluate(() => {
				const { game, UI } = __ed,
					sc = game.screen;
				const h = UI.hot.find((h) => h.w === 18 && h.h === 18 && h.click);
				const rc = sc.canvas.getBoundingClientRect();
				return [
					rc.left +
						((h.x + 9) * sc.S + sc.OX - Math.round(sc.fx * sc.S)) / sc.dpr,
					rc.top +
						((h.y + 9) * sc.S + sc.OY - Math.round(sc.fy * sc.S)) / sc.dpr,
				];
			});
			await page.mouse.move(...hudPoint);
			await padButton(2);
			assert.ok(await page.evaluate(() => window.skillEvents > 0));
			assert.equal(await page.evaluate(() => __ed.game.input.aimSource), "pad");
			const potions = await page.evaluate(() => __ed.ED.hero.potions);
			await padButton(6);
			assert.equal(
				await page.evaluate(() => __ed.ED.hero.potions),
				potions - 1,
			);
			await page.mouse.move(20, 20);
			await page.evaluate(() => {
				window.testPads[2].axes = [0.65, 0, 0, -0.8];
			});
			await page.waitForTimeout(250);
			assert.ok(
				await page.evaluate(
					() =>
						__ed.game.input.aimSource === "pad" &&
						__ed.game.input.padMove[0] > 0 &&
						__ed.game.input.padAim[1] < 0,
				),
			);
			await page.evaluate(() => {
				window.testPads[2].axes = [0.03, 0, 0, 0];
			});
			await page.waitForTimeout(80);
			assert.deepEqual(
				await page.evaluate(() => __ed.game.input.padMove),
				[0, 0],
			);
			await padButton(9);
			assert.equal(await page.evaluate(() => __ed.UI.top().id), "pause");
			await page.evaluate(() => {
				window.testPads[2].axes[1] = 0.8;
			});
			await page.waitForTimeout(120);
			assert.equal(await page.evaluate(() => __ed.UI.focus), 1);
			await page.evaluate(() => {
				window.testPads[2].axes[1] = 0;
			});
			await padButton(0);
			assert.equal(await page.evaluate(() => __ed.UI.top().id), "inventory");
			await padButton(9);
			await padButton(9);
			await page.evaluate(() => {
				__ed.ED.hero.x = __ed.ED.L.waystone.x;
				__ed.ED.hero.y = __ed.ED.L.waystone.y;
				__ed.ED.hero.act = null;
			});
			await padButton(10);
			assert.equal(await page.evaluate(() => __ed.UI.top().id), "waystone");
			await padButton(9);
			await key(page, "Escape");
			await settingsPage(page, "Controls");
			await page
				.getByRole("button", { name: "Clear Interact pad", exact: true })
				.click();
			await page
				.getByRole("button", { name: "Skill 1 gamepad", exact: true })
				.click();
			await padButton(10);
			assert.ok(
				await page.evaluate(() => __ed.CONTROL.bindings.s0.includes("Pad10")),
			);
			await page
				.getByRole("button", { name: "Reset all controls", exact: true })
				.click();
			await page
				.getByRole("checkbox", { name: "Invert right-stick Y", exact: true })
				.check();
			await page.evaluate(() => {
				window.testPads[2].axes[3] = -0.8;
			});
			await page.waitForTimeout(80);
			assert.ok(await page.evaluate(() => __ed.game.input.padAim[1] > 0));
			await page.evaluate(() => {
				window.testPads[2].axes[3] = 0;
			});
			await page
				.getByRole("checkbox", { name: "Invert right-stick Y", exact: true })
				.uncheck();
			await padButton(1);
			await padButton(9);
			await page.evaluate(() => {
				window.testPads[2].axes = [0.8, 0.7, -0.8, 0.2];
				window.testPads[2].buttons[2].pressed = true;
			});
			await page.waitForTimeout(100);
			await page.evaluate(() => {
				window.testPads = [];
			});
			await page.waitForTimeout(100);
			assert.ok(
				await page.evaluate(
					() =>
						![...__ed.game.input.held].some((c) => c.startsWith("Pad")) &&
						__ed.game.input.padMove.every((v) => v === 0) &&
						__ed.game.input.padAim === null,
				),
			);
		},
	);
	await check("Focus loss clears holds and pauses the game", async () => {
		await page.keyboard.down("KeyD");
		await page.waitForTimeout(100);
		await page.evaluate(() => dispatchEvent(new Event("blur")));
		assert.equal(await page.evaluate(() => __ed.game.input.held.size), 0);
		assert.equal(await page.evaluate(() => __ed.UI.top().id), "pause");
		await page.keyboard.up("KeyD");
		await key(page, "Escape");
	});
	await check(
		"Tools act on the hero you play: switches, stepping, spawning, travel, and the save keeps it",
		async () => {
			await page.evaluate(() => __ed.saveGame());
			const gold = await page.evaluate(() => __ed.ED.hero.gold);
			await key(page, "Escape");
			await canvasButton(page, "TOOLS");
			await page.getByRole("tab", { name: "Tools", exact: true }).waitFor();
			assert.equal(
				await page.getByRole("tab", { name: "Tools", exact: true }).getAttribute("aria-selected"),
				"true",
			);
			await page
				.getByRole("checkbox", { name: "Invulnerable", exact: true })
				.check();
			assert.equal(
				await page.evaluate(() =>
					__ed.dealDamage(__ed.ED.hero, { amount: 999, el: "fire", var: 0 }),
				),
				0,
			);
			await page
				.getByRole("checkbox", {
					name: "Unlimited ember, potions & dodges",
					exact: true,
				})
				.check();
			await page
				.getByRole("checkbox", { name: "No skill cooldowns", exact: true })
				.check();
			await page
				.getByRole("button", { name: "Grant 10,000 gold", exact: true })
				.click();
			await page
				.getByRole("button", {
					name: "Grant 10 skill & passive points",
					exact: true,
				})
				.click();
			await page
				.getByRole("button", { name: "Unlock all skills", exact: true })
				.click();
			await page
				.getByRole("button", { name: "Create item in bag", exact: true })
				.click();
			assert.ok(
				await page.evaluate(
					() =>
						__ed.ED.hero.bag.length > 0 &&
						__ed.ED.hero.pts.skill >= 10 &&
						Object.keys(__ed.ED.hero.skills).length ===
							Object.keys(__ed.REG.skills).length,
				),
			);
			await page
				.getByRole("checkbox", { name: "Pause simulation", exact: true })
				.check();
			const t = await page.evaluate(() => __ed.ED.t);
			await page.evaluate(() => {
				const h = __ed.ED.hero;
				h.ember = h.potions = h.dodges = 0;
				h.cds = { ember: 20 };
			});
			await page
				.getByRole("button", {
					name: "Step 1 frame (while paused)",
					exact: true,
				})
				.click();
			assert.ok(
				Math.abs((await page.evaluate(() => __ed.ED.t)) - t - 1 / 60) < 1e-8,
			);
			assert.ok(
				await page.evaluate(() => {
					const h = __ed.ED.hero;
					return (
						h.ember === h.maxEmber &&
						h.potions === h.maxPotions &&
						h.dodges === h.maxDodge &&
						!Object.keys(h.cds).length
					);
				}),
			);
			await page.waitForTimeout(120);
			assert.ok(
				Math.abs((await page.evaluate(() => __ed.ED.t)) - t - 1 / 60) < 1e-8,
			);
			await page
				.getByRole("button", { name: "Spawn monsters", exact: true })
				.click();
			await page
				.getByRole("button", { name: "Spawn boss", exact: true })
				.click();
			assert.ok(
				await page.evaluate(() => __ed.ED.foes.length >= 2 && __ed.ED.boss),
			);
			await page
				.getByRole("checkbox", { name: "Freeze enemy AI", exact: true })
				.check();
			const foeState = () =>
				page.evaluate(() =>
					__ed.ED.foes.map((m) => [m.x, m.y, m.spawnT, m.stunT]),
				);
			const frozen = await foeState();
			await page
				.getByRole("button", {
					name: "Step 1 frame (while paused)",
					exact: true,
				})
				.click();
			assert.deepEqual(await foeState(), frozen);
			await page
				.getByRole("checkbox", { name: "Freeze enemy AI", exact: true })
				.uncheck();
			await page
				.getByRole("button", {
					name: "Step 1 frame (while paused)",
					exact: true,
				})
				.click();
			assert.notDeepEqual(await foeState(), frozen);
			await page
				.getByRole("button", { name: "Reveal map", exact: true })
				.click();
			assert.ok(
				await page.evaluate(() => __ed.ED.L.seen.every((v) => v === 1)),
			);
			await page
				.getByRole("button", {
					name: "Clear enemies & projectiles",
					exact: true,
				})
				.click();
			assert.equal(await page.evaluate(() => __ed.ED.foes.length), 0);
			// the overlays and the full lighting are Graphics settings now, kept with the options
			await page.getByRole("tab", { name: "Graphics", exact: true }).click();
			await page
				.getByRole("checkbox", { name: "Full lighting", exact: true })
				.check();
			await page
				.getByRole("checkbox", { name: "Collision circles", exact: true })
				.check();
			await page.waitForTimeout(100);
			assert.equal(await page.evaluate(() => __ed.game.lights.enabled), false);
			assert.ok(
				await page.evaluate(() => {
					const o = My3D2dge.store.get("ed:opt");
					return o.fullLight === true && o.hitboxes === true;
				}),
			);
			await page
				.getByRole("checkbox", { name: "Full lighting", exact: true })
				.uncheck();
			await page
				.getByRole("checkbox", { name: "Collision circles", exact: true })
				.uncheck();
			await page.getByRole("tab", { name: "Tools", exact: true }).click();
			await page
				.getByRole("combobox", { name: "Simulation speed", exact: true })
				.selectOption("2");
			assert.equal(await page.evaluate(() => __ed.SLOW.base), 2);
			await page
				.getByRole("spinbutton", { name: "Depth (1–500)", exact: true })
				.fill("7");
			await page
				.getByRole("button", { name: "Travel to depth", exact: true })
				.click();
			await page.waitForFunction(() => __ed.ED.depth === 7);
			await page.evaluate(() => __ed.saveGame());
			assert.equal(
				JSON.parse(await save(page)).gold,
				gold + 10000,
				"the granted gold is the hero's own, and saves with him",
			);
			await key(page, "Escape");
			await canvasButton(page, "TOOLS");
			await page.screenshot({ path: out + "/tools.png" });
			await page
				.getByRole("button", { name: "Start autopilot", exact: true })
				.click();
			assert.ok(await page.evaluate(() => __ed.ED.hero.bot));
			await page
				.getByRole("button", { name: "Stop autopilot", exact: true })
				.click();
			assert.ok(await page.evaluate(() => !__ed.ED.hero.bot));
			// difficulty: a page of its own, kept as soon as it changes
			await page.getByRole("tab", { name: "Difficulty", exact: true }).click();
			await page.getByRole("slider", { name: "Hero damage", exact: true }).focus();
			await page.keyboard.press("ArrowRight");
			assert.ok(await page.evaluate(() => __ed.DIFF.heroDmg > 1));
			assert.ok(
				await page.evaluate(() => My3D2dge.store.get("ed:diff").heroDmg > 1),
			);
			await page
				.getByRole("button", { name: "Reset difficulty", exact: true })
				.click();
			assert.equal(await page.evaluate(() => __ed.DIFF.heroDmg), 1);
			// the switches off again, and home
			await page.getByRole("tab", { name: "Tools", exact: true }).click();
			for (const name of [
				"Invulnerable",
				"Unlimited ember, potions & dodges",
				"No skill cooldowns",
				"Pause simulation",
			])
				await page.getByRole("checkbox", { name, exact: true }).uncheck();
			await page
				.getByRole("combobox", { name: "Simulation speed", exact: true })
				.selectOption("1");
			await page
				.getByRole("button", { name: "Return to town", exact: true })
				.click();
			await page.waitForFunction(() => __ed.ED.mode === "town");
			assert.equal(await page.evaluate(() => __ed.SLOW.base), 1);
			assert.ok(
				await page.evaluate(
					() => !__ed.DEV.god && !__ed.DEV.paused && !__ed.UI.stack.length,
				),
			);
		},
	);
	await check(
		"Town conversations can pause and do not leak across travel",
		async () => {
			await page.evaluate(() => {
				const n = __ed.ED.L.npcs.find((n) => n.id === "bram");
				__ed.ED.hero.x = n.x;
				__ed.ED.hero.y = n.y + 8;
				__ed.ED.hero.act = null;
			});
			await key(page, "KeyE");
			assert.ok(
				await page.evaluate(() =>
					__ed.ED.L.npcs.some((n) => n.id === "bram" && n.talking),
				),
			);
			await key(page, "Escape");
			assert.equal(await page.evaluate(() => __ed.UI.top().id), "pause");
			await canvasButton(page, "TOOLS");
			await page
				.getByRole("button", { name: "Return to town", exact: true })
				.click();
			await page.waitForTimeout(700);
			const t = await page.evaluate(() => __ed.ED.t);
			await page.waitForTimeout(150);
			assert.ok(
				await page.evaluate((t) => __ed.ED.t > t, t),
				"the old conversation does not hold the world after travel",
			);
		},
	);
	await check(
		"Mobile portrait / landscape menus, two-finger play, cancellation and handedness",
		async () => {
			const mobile = await browser.newContext({
				viewport: { width: 390, height: 844 },
				deviceScaleFactor: 3,   // a phone's screen (an iPhone 14's)
				isMobile: true,
				hasTouch: true,
			});
			const p = await mobile.newPage();
			track(p);
			await ready(p, "");
			// held upright, the title fills the phone, and a touch screen that can go full screen offers it
			assert.ok((await phoneLayout(p)).fills);
			assert.ok(await p.evaluate(() => __ed.UI.hot.some((h) => h.label === "FULL SCREEN")));
			await settingsPage(p, "Controls", true);
			// any tap on the title menu takes a phone full screen (a browser only allows it from a tap)
			assert.ok(await p.evaluate(() => !!document.fullscreenElement));
			assert.equal(await p.locator("dialog").count(), 1);
			assert.ok(
				await p
					.locator("dialog")
					.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
			);
			await p.getByRole("button", { name: "Back", exact: true }).tap();
			await canvasButton(p, "GALLERY", true);
			await p.waitForFunction(() => __ed.ED.mode === "gallery");
			const gallerySave = await save(p);
			await p.evaluate(() => __ed.saveGame());
			assert.equal(await save(p), gallerySave);
			const firstSkill = await p.evaluate(() => __ed.ED.hero.slots[5]);
			await p.getByRole("button", { name: "Next", exact: true }).tap();
			await p.waitForFunction(
				(first) => __ed.ED.hero.slots[5] !== first,
				firstSkill,
			);
			await p.getByRole("button", { name: "Reel", exact: true }).tap();
			await p.waitForFunction(() => __ed.ED.foes.length === 1);
			await p.getByRole("button", { name: "Slow", exact: true }).tap();
			await p.waitForFunction(() => __ed.game.timeScale < 1);
			await p.getByRole("button", { name: "Back", exact: true }).tap();
			await p.waitForFunction(() => __ed.ED.mode === "title");
			assert.deepEqual(await p.evaluate(() => __ed.game.errors), []);
			await canvasButton(p, "NEW GAME", true);
			await p.waitForFunction(() => __ed.ED.mode === "town");
			await p.waitForTimeout(1200);
			assert.equal(await p.locator(".ed-touch-actions button").count(), 9);
			// the picture fills the upright screen: the HUD bar rides over the action buttons, the minimap sits
			// under the top buttons, and the camera keeps the hero in the open ground between them
			const up = await phoneLayout(p);
			assert.ok(up.fills, "the picture fills the upright screen");
			assert.ok(up.hudBottom <= up.gridTop, "the HUD bar is above the action buttons");
			assert.ok(up.mapTop >= up.barBottom, "the minimap is under the top buttons");
			assert.ok(await p.evaluate(() => __ed.game.cam.offset[1] < 0));
			await p.screenshot({ path: out + "/mobile-portrait.png" });
			const cdp = await mobile.newCDPSession(p),
				attack = await p.locator('[data-act="s0"]').boundingBox();
			const finger = { x: 55, y: 410, id: 1 },
				finger2 = {
					x: attack.x + attack.width / 2,
					y: attack.y + attack.height / 2,
					id: 2,
				};
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [finger],
			});
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ ...finger, x: 95 }],
			});
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [{ ...finger, x: 95 }, finger2],
			});
			await p.waitForTimeout(180);
			assert.ok(
				await p.evaluate(
					() =>
						__ed.game.input.stickOn &&
						__ed.game.input.move()[0] > 0.5 &&
						__ed.game.input.down("s0"),
				),
			);
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchCancel",
				touchPoints: [],
			});
			await p.waitForTimeout(100);
			assert.ok(
				await p.evaluate(
					() => !__ed.game.input.stickOn && !__ed.game.input.down("s0"),
				),
			);
			await p.locator('[data-act="pause"]').tap();
			// leaving full screen from the pause menu is remembered (the title then leaves the phone as it is)
			await canvasButton(p, "LEAVE FULL SCREEN", true);
			await p.waitForFunction(() => !document.fullscreenElement);
			assert.equal(await p.evaluate(() => My3D2dge.store.get("ed:opt").fullscreen), false);
			await settingsPage(p, "Controls", true);
			await p
				.getByRole("combobox", { name: "Action buttons on", exact: true })
				.selectOption("left");
			await p.getByRole("button", { name: "Back", exact: true }).tap();
			await canvasButton(p, "RESUME", true);
			assert.equal(await p.evaluate(() => __ed.game.input.stickSide), "right");
			await p.setViewportSize({ width: 844, height: 390 });
			await p.waitForTimeout(300);
			// on its side the action buttons stand above the HUD bar, under the minimap
			const side = await phoneLayout(p);
			assert.ok(side.fills, "the picture fills the screen on its side");
			assert.ok(side.gridBottom <= side.hudTop, "the action buttons are above the HUD bar");
			assert.ok(side.gridTop >= side.mapBottom, "the action buttons are under the minimap");
			assert.ok(
				await p.locator(".ed-touch-actions").evaluate((el) => {
					const r = el.getBoundingClientRect();
					return (
						r.left >= 0 &&
						r.right <= innerWidth &&
						r.top >= 0 &&
						r.bottom <= innerHeight
					);
				}),
			);
			await p.screenshot({ path: out + "/mobile-landscape.png" });
			assert.deepEqual(await p.evaluate(() => __ed.game.errors), []);
			await mobile.close();
		},
	);
	assert.deepEqual(await page.evaluate(() => __ed.game.errors), []);
	assert.deepEqual(errors, []);
	writeFileSync(
		out + "/results.json",
		JSON.stringify({ checks, errors }, null, 2),
	);
	console.log("All", checks.length, "control / tools scenarios passed.");
} catch (error) {
	await page.screenshot({ path: out + "/failure.png" });
	console.error("Browser errors:", errors);
	throw error;
} finally {
	await browser.close();
}
