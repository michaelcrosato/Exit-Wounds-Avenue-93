// End-to-end character selection, save isolation, gameplay, progression, rigs and device input.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const out = resolve("check-output/codex");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve("examples/emberdeep.html")).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({
	viewport: { width: 1280, height: 800 },
});
const page = await context.newPage(),
	errors = [],
	checks = [];
const track = (p) => {
	p.on("pageerror", (e) => errors.push(e.message));
	p.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});
};
track(page);
async function key(p, code, ms = 90) {
	await p.keyboard.down(code);
	await p.waitForTimeout(ms);
	await p.keyboard.up(code);
	await p.waitForTimeout(90);
}
async function button(p, label, touch = false) {
	await p.waitForFunction(
		(label) => __ed.UI.hot.some((h) => h.label === label),
		label,
	);
	const xy = await p.evaluate((label) => {
		const { game, UI } = __ed,
			sc = game.screen,
			h = UI.hot.find((h) => h.label === label),
			r = sc.canvas.getBoundingClientRect();
		return [
			r.left +
				((h.x + h.w / 2) * sc.S + sc.OX - Math.round(sc.fx * sc.S)) / sc.dpr,
			r.top +
				((h.y + h.h / 2) * sc.S + sc.OY - Math.round(sc.fy * sc.S)) / sc.dpr,
		];
	}, label);
	if (touch) await p.touchscreen.tap(...xy);
	else await p.mouse.click(...xy);
	await p.waitForTimeout(150);
}
/* the experiments run on the hero himself (the tools act on the real game): his save is kept first and put back after,
   with the switches off, back in town */
const keepHero = (p) =>
	p.evaluate(() => {
		const X = __ed;
		X.saveGame();
		X.kept = JSON.stringify(My3D2dge.store.get(X.characterSaveKey(X.ED.hero.character)));
		X.UI.closeAll();
		X.goTown();
	});
const restoreHero = (p) =>
	p.evaluate(() => {
		const X = __ed,
			id = X.ED.hero.character;
		X.ED.hero.bot = null;
		Object.assign(X.DEV, { god: false, resources: false, cooldowns: false, freezeFoes: false, paused: false });
		My3D2dge.store.set(X.characterSaveKey(id), JSON.parse(X.kept));
		X.ED.hero = X.loadHeroOrNew(id);
		X.ED.savedLevel = null;
		X.UI.closeAll();
		X.goTown();
		return X.kept;
	});
async function check(name, fn) {
	await fn();
	checks.push(name);
	console.log("ok", name);
}
async function choose(p, name) {
	await button(p, "CHARACTER");
	await p.getByRole("button", { name, exact: true }).click();
	await p
		.getByRole("button", { name: "PLAY AS " + name.toUpperCase(), exact: true })
		.click();
	await p.waitForFunction(() => __ed.ED.mode === "town");
	await p.waitForTimeout(1200);
}
async function title(p) {
	await key(p, "Escape");
	await button(p, "SAVE AND QUIT");
	await p.waitForFunction(() => __ed.ED.mode === "title");
	await p.waitForTimeout(400);
}
try {
	await page.goto(url + "?test=codex#town");
	await page.waitForFunction(() => window.__ed?.ED.mode === "town");
	await page.waitForTimeout(1200);
	await check(
		"Character picker, legacy Wanderer save and independent Codex continuation",
		async () => {
			const legacy = await page.evaluate(() => {
				__ed.ED.hero.gold = 777;
				__ed.ED.hero.level = 4;
				__ed.computeStats(__ed.ED.hero);
				__ed.saveGame();
				const s = My3D2dge.store.get("ed:save");
				delete s.character;
				My3D2dge.store.set("ed:save", s);
				return JSON.stringify(s);
			});
			await page.goto(url + "?test=legacy");
			await page.waitForFunction(() => window.__ed?.ED.mode === "title");
			assert.equal(
				await page.evaluate(() => __ed.ED.titleHero.character),
				"wanderer",
			);
			await button(page, "CHARACTER");
			await page.getByRole("button", { name: "Codex", exact: true }).click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: out + "/selection.png" });
			await page
				.getByRole("button", { name: "PLAY AS CODEX", exact: true })
				.click();
			await page.waitForFunction(() => __ed.ED.mode === "town");
			await page.waitForTimeout(1200);
			assert.deepEqual(
				await page.evaluate(() => [
					__ed.ED.hero.character,
					__ed.ED.hero.rig.constructor.name,
					__ed.ED.hero.slots.length,
					__ed.ED.hero.maxEmber,
				]),
				["codex", "CodexRig", 6, 125],
			);
			assert.equal(
				await page.evaluate(() =>
					JSON.stringify(My3D2dge.store.get("ed:save")),
				),
				legacy,
			);
			await page.evaluate(() => {
				__ed.ED.hero.gold = 1234;
				__ed.saveGame();
			});
			await page.reload();
			await page.waitForFunction(() => window.__ed);
			await page.waitForTimeout(1200);
			assert.equal(await page.evaluate(() => __ed.CHAR.selected), "codex");
			assert.equal(await page.evaluate(() => __ed.ED.titleHero.gold), 1234);
			await choose(page, "Wanderer");
			assert.deepEqual(
				await page.evaluate(() => [
					__ed.ED.hero.character,
					__ed.ED.hero.gold,
					__ed.ED.hero.level,
				]),
				["wanderer", 777, 4],
			);
			await title(page);
			await choose(page, "Codex");
			assert.equal(await page.evaluate(() => __ed.ED.hero.gold), 1234);
		},
	);
	await check(
		"Glide, foldstep, inventory model and character-safe respec",
		async () => {
			const before = await page.evaluate(() => [
				__ed.ED.hero.x,
				__ed.ED.hero.y,
			]);
			await key(page, "KeyD", 350);
			const after = await page.evaluate(() => [__ed.ED.hero.x, __ed.ED.hero.y]);
			assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 10);
			await page.keyboard.down("Space");
			await page.waitForTimeout(100);
			assert.ok(
				await page.evaluate(
					() => __ed.ED.hero.rig.fold > 0.5 && __ed.ED.hero.inv > 0,
				),
			);
			await page.screenshot({ path: out + "/foldstep.png" });
			await page.keyboard.up("Space");
			await page.waitForTimeout(550);
			assert.ok(await page.evaluate(() => __ed.ED.hero.rig.fold < 0.05));
			await key(page, "KeyI");
			await page.screenshot({ path: out + "/inventory.png" });
			assert.equal(await page.evaluate(() => __ed.UI.top().id), "inventory");
			await key(page, "Escape");
			await key(page, "KeyK");
			assert.ok(
				await page.evaluate(() =>
					__ed.UI.panels.skills.api.rows().some((r) => r.id === "cx_quill"),
				),
			);
			const respec = await page.evaluate(() => {
				const h = __ed.ED.hero,
					api = __ed.UI.panels.skills.api;
				h.pts.skill = 5;
				api.rankUp("cx_quill");
				api.rune("cx_quill", "seek");
				const rank = h.skills.cx_quill.rank,
					rune = h.skills.cx_quill.rune;
				__ed.UI.panels.tree.api.respec("skill", { quiet: true });
				return {
					rank,
					rune,
					points: h.pts.skill,
					skills: Object.fromEntries(
						__ed.CHARACTERS.codex.skills.map((id) => [id, h.skills[id]?.rank]),
					),
				};
			});
			assert.equal(respec.rank, 2);
			assert.equal(respec.rune, "seek");
			assert.equal(respec.points, 5);
			assert.ok(Object.values(respec.skills).every((rank) => rank === 1));
			await key(page, "Escape");
		},
	);
	await check(
		"Every signature spell, Manuscript empowerment, rune effects, and the hero put back after",
		async () => {
			await keepHero(page);
			await page.waitForTimeout(800);
			const result = await page.evaluate(() => {
				const { ED, game, DEV } = __ed,
					h = ED.hero,
					map = ED.L.map;
				DEV.freezeFoes = true;
				DEV.god = true;
				game.paused = true;
				game.input.clear();
				__ed.UI.closeAll();
				let spot;
				for (let y = 4; y < map.h - 4 && !spot; y++)
					for (let x = 4; x < map.w - 10 && !spot; x++) {
						if (
							[0, 1, 2, 3, 4, 5, 6].every(
								(k) => map.heightAt((x + k) * 16 + 8, y * 16 + 8) === 0,
							)
						)
							spot = [(x + 1) * 16 + 8, y * 16 + 8];
					}
				if (!spot) throw new Error("No spell testing lane");
				h.x = spot[0];
				h.critChance = 0;
				h.y = spot[1];
				h.z = 0;
				h.act = null;
				h.bot = {
					manual: true,
					input: {
						worldMove: [0, 0],
						aimSource: "bot",
						aimAt: [h.x + 70, h.y],
						move: () => [0, 0],
						buffered: () => false,
						down: () => false,
						pressed: () => false,
						consume() {},
					},
				};
				const hits = [];
				__ed.BUS.on("hit", (e) => {
					if (e.src === h) hits.push({ skill: e.hit.skill, damage: e.dmg });
				});
				const step = (seconds) => {
					for (let i = 0; i < Math.ceil(seconds * 60); i++) {
						game.time += 1 / 60;
						game.real += 1 / 60;
						game.input.tick(1 / 60);
						game.scene.update(1 / 60);
					}
				};
				const target = __ed.spawnMonster("husk", h.x + 70, h.y, {
					instant: true,
					level: 1,
				});
				target.hp = target.maxHp = 100000;
				target.armor = 0;
				target.res = {};
				target.react = null;
				target.st = {};
				target.spawnT = 0;
				step(0.05);
				const cast = (slot, seconds, distance = 70) => {
					ED.fx.length = 0;
					target.x = h.x + distance;
					target.y = h.y;
					target.st = {};
					target.alive = true;
					h.bot.input.aimAt = [target.x, target.y];
					h.aim = 0;
					h.tx = target.x;
					h.ty = target.y;
					h.facing = 0;
					h.act = null;
					h.cds = {};
					h.ember = h.maxEmber;
					step(0.05);
					__ed.useSlot(h, slot);
					step(seconds);
				};
				cast(0, 0.8);
				cast(0, 0.8);
				cast(0, 0.8);
				const charged = h.manuscript;
				const oldHits = hits.length;
				cast(1, 1.2);
				const litDamage = hits
					.slice(oldHits)
					.find((e) => e.skill === "cx_seal")?.damage;
				const consumed = h.manuscript;
				const start = hits.length;
				cast(1, 1.2);
				const normalDamage = hits
					.slice(start)
					.find((e) => e.skill === "cx_seal")?.damage;
				cast(2, 1.1, 46);
				h.hp = h.maxHp * 0.35;
				h.dodges = 0;
				h.st.burn = { t: 3, p: 1 };
				cast(3, 0.7);
				const revision = {
					hp: h.hp / h.maxHp,
					dodges: h.dodges,
					clean: !h.st.burn,
				};
				cast(4, 3, 30);
				cast(5, 2);
				// Test chosen runes through the same runtime as normal skill use.
				h.skills.cx_seal = { rank: 2, rune: "bind" };
				cast(1, 0.7);
				const stunned = !!target.st.stun;
				h.skills.cx_orbit = { rank: 2, rune: "guard" };
				cast(4, 0.7, 30);
				const ward = h.buffs.some((b) => b.id === "cx_index");
				const finite = [h.x, h.y, h.hp, target.hp].every(Number.isFinite);
				h.bot = null;
				__ed.saveGame();
				return {
					charged,
					consumed,
					litDamage,
					normalDamage,
					revision,
					stunned,
					ward,
					finite,
					skills: [...new Set(hits.map((e) => e.skill))],
					errors: game.errors,
				};
			});
			assert.equal(result.charged, 3, JSON.stringify(result));
			assert.equal(result.consumed, 0);
			assert.ok(
				result.litDamage > result.normalDamage * 1.15,
				JSON.stringify(result),
			);
			assert.ok(
				result.revision.hp > 0.5 &&
					result.revision.dodges > 0 &&
					result.revision.clean,
			);
			assert.ok(result.stunned && result.ward && result.finite);
			for (const id of [
				"cx_quill",
				"cx_seal",
				"cx_folio",
				"cx_orbit",
				"cx_finale",
			])
				assert.ok(result.skills.includes(id), id + " dealt damage");
			assert.deepEqual(result.errors, []);
			const kept = await restoreHero(page);
			await page.evaluate(() => {
				__ed.game.paused = false;
			});
			await page.waitForTimeout(900);
			assert.equal(
				await page.evaluate(() =>
					JSON.stringify(My3D2dge.store.get("ed:save:codex")),
				),
				kept,
			);
			assert.equal(
				await page.evaluate(() => __ed.ED.hero.rig.constructor.name),
				"CodexRig",
			);
		},
	);
	await check(
		"Shared skills, equipment upgrades, passives and spectral-copy compatibility",
		async () => {
			await keepHero(page);
			await page.waitForTimeout(800);
			const result = await page.evaluate(() => {
				const { ED, game, DEV, REG } = __ed,
					h = ED.hero;
				DEV.god = DEV.resources = DEV.cooldowns = DEV.freezeFoes = true;
				const gear = __ed.makeItem({ base: "frostwand", ilvl: 15, rarity: 2 });
				h.bag.push(gear);
				__ed.equip(h, gear, "weapon");
				__ed.gainXp(h, 1000);
				__ed.UI.panels.tree.api.auto();
				const equipment =
					h.rig.constructor.name === "CodexRig" &&
					h.gear.weapon.uid === gear.uid &&
					h.level > 1 &&
					h.tree.length > 0;
				h.bot = {
					manual: true,
					input: {
						worldMove: [0, 0],
						aimSource: "bot",
						aimAt: [h.x + 30, h.y],
						move: () => [0, 0],
						buffered: () => false,
						down: () => false,
						pressed: () => false,
						consume() {},
					},
				};
				const ids = Object.keys(REG.skills).filter(
						(id) => !REG.skills[id].character,
					),
					cast = [];
				let echo = false;
				for (const id of ids) {
					if (h.act?.end) h.act.end(true);
					h.act = null;
					h.dodgeT = 0;
					h.cds = {};
					h.ember = h.maxEmber;
					h.st = {};
					h.vx = h.vy = 0;
					h.z = 0;
					ED.fx.length = ED.allies.length = ED.foes.length = 0;
					h.skills[id] = { rank: 3 };
					h.slots[0] = id;
					__ed.dressHero(h);
					const m = __ed.spawnMonster("dummy", h.x + 30, h.y, {
						instant: true,
					});
					m.spawnT = 0;
					h.bot.input.aimAt = [m.x, m.y];
					h.aim = h.facing = 0;
					h.tx = m.x;
					h.ty = m.y;
					if (__ed.useSlot(h, 0)) cast.push(id);
					for (let frame = 0; frame < 150; frame++) {
						game.hitstop = 0;
						game._step(1 / 60);
						if (frame % 15 === 0) game._frame();
						if (
							id === "echo" &&
							ED.allies.some(
								(a) => a.kind === "echo" && a.rig instanceof __ed.CodexRig,
							)
						)
							echo = true;
					}
				}
				h.bot = null;
				return { equipment, echo, ids, cast, errors: game.errors };
			});
			assert.ok(result.equipment && result.echo);
			assert.deepEqual(result.cast, result.ids);
			assert.deepEqual(result.errors, []);
			await restoreHero(page);
			await page.waitForTimeout(900);
		},
	);
	await check(
		"All camera views, death/revival, gamepad and mobile character selection",
		async () => {
			for (const view of ["iso", "threequarter", "topdown", "brawler"]) {
				await page.evaluate((v) => {
					__ed.game.setView(v);
					__ed.game.setZoom(2);
					__ed.UI.cardT = 0;
				}, view);
				await page.waitForTimeout(200);
				await page.screenshot({ path: out + "/" + view + ".png" });
			}
			await page.evaluate(() => __ed.descend(1));
			await page.waitForFunction(() => __ed.ED.mode === "level");
			await page.waitForTimeout(1200);
			await page.evaluate(() => {
				__ed.ED.foes.length = 0;
				__ed.ED.hero.inv = 0;
				__ed.dealDamage(__ed.ED.hero, { amount: 99999, el: "void", var: 0 });
			});
			await page.waitForFunction(
				() => __ed.ED.hero.dead && __ed.ED.hero.rig.fall > 0.9,
			);
			await page.screenshot({ path: out + "/defeated.png" });
			await page.waitForFunction(() => __ed.UI.top()?.id === "death");
			await key(page, "Enter");
			await page.waitForFunction(() => __ed.ED.mode === "town");
			await page.waitForFunction(() => __ed.ED.hero.rig.fall < 0.1);
			assert.ok(
				await page.evaluate(
					() => __ed.ED.hero.alive && __ed.ED.hero.rig.fall < 0.1,
				),
			);
			await page.evaluate(() => {
				window.pad = {
					index: 1,
					id: "Codex test pad",
					connected: true,
					axes: [0.8, 0, 1, 0],
					buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
				};
				Object.defineProperty(navigator, "getGamepads", {
					value: () => [null, window.pad],
				});
				window.pad.buttons[2].pressed = true;
			});
			await page.waitForTimeout(220);
			assert.ok(
				await page.evaluate(
					() => __ed.game.input.padMove[0] > 0.5 && __ed.ED.hero.rig.run > 0.1,
				),
			);
			await page.evaluate(() => {
				window.pad.buttons[2].pressed = false;
				window.pad.axes = [0, 0, 0, 0];
			});
			const mobile = await browser.newContext({
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true,
			});
			const p = await mobile.newPage();
			track(p);
			await p.goto(url);
			await p.waitForFunction(() => window.__ed);
			await p.waitForTimeout(500);
			await button(p, "CHARACTER", true);
			await p.getByRole("button", { name: "Codex", exact: true }).tap();
			assert.ok(
				await p
					.locator("dialog")
					.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
			);
			await p.getByRole("button", { name: "PLAY AS CODEX", exact: true }).tap();
			await p.waitForFunction(() => __ed.ED.mode === "town");
			await p.waitForTimeout(1200);
			await p.locator('[data-act="s0"]').tap();
			await p.waitForTimeout(90);
			assert.ok(
				await p.evaluate(
					() =>
						__ed.ED.hero.act?.skill === "cx_quill" ||
						__ed.ED.fx.some((f) => f.hit?.skill === "cx_quill"),
				),
			);
			await p.screenshot({ path: out + "/mobile.png" });
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
	console.log("All", checks.length, "Codex scenarios passed.");
} catch (e) {
	await page.screenshot({ path: out + "/failure.png" });
	console.error("Browser errors:", errors);
	throw e;
} finally {
	await browser.close();
}
