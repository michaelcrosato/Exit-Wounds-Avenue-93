// Tuning in the Settings window: every knob sits at the shipped default, knobs and inspector overrides change the game,
// persist, and reset; the pages, tiers, search and guide links work. Run after npm run build.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const out = resolve("check-output/tune");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve("examples/emberdeep.html")).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ready = async () => {
	await page.goto(url + "#town");
	await page.waitForFunction(() => window.__ed?.ED.L);
	await page.waitForTimeout(600);
};
const checks = [];
async function check(name, fn) {
	await fn();
	checks.push(name);
	console.log("ok", name);
}
await ready();

await check("Shipped defaults: every knob in range, none changed", async () => {
	const r = await page.evaluate(() => {
		const { TUNE, TUNE_KNOBS } = window.__ed;
		return TUNE_KNOBS.map((K) => [K.id, K.def >= K.min && K.def <= K.max, TUNE[K.id] === K.def, !!K.about && !!K.where]);
	});
	assert.ok(r.length >= 60, "expected the full knob set, got " + r.length);
	for (const [id, inRange, atDef, documented] of r) {
		assert.ok(inRange, id + " default outside its range");
		assert.ok(atDef, id + " not at its default");
		assert.ok(documented, id + " has no explanation or source");
	}
});

await check("Knobs and overrides change the game, persist, and reset", async () => {
	const r = await page.evaluate(() => {
		const X = window.__ed, h = X.ED.hero, o = {};
		o.hp0 = h.maxHp;
		X.tuneSet("baseLife", 500);
		o.hp1 = h.maxHp;
		const at = (lvl) => X.spawnMonster("husk", X.ED.hero.x + 40, X.ED.hero.y, { level: lvl, instant: true }).maxHp;
		o.m0 = at(1);
		X.ovrSet("archetypes.husk.hp", 300);
		o.m1 = at(1);
		const hit0 = X.heroHit(X.ED.hero, 1, { skill: "blade" }).amount;
		X.ovrSet("skills.blade.dmgMul", 2);
		o.mul = X.heroHit(X.ED.hero, 1, { skill: "blade" }).amount / hit0;
		X.tuneSet("gravity", 99);
		o.clamped = X.TUNE.gravity;
		return o;
	});
	assert.ok(r.hp1 > r.hp0 + 300, "starting life did not raise maximum life");
	assert.ok(r.m1 > r.m0 * 5, "the husk inspector override did not apply");
	assert.equal(r.mul, 2);
	assert.equal(r.clamped, 5, "a knob must clamp to its range");
	await ready();
	const kept = await page.evaluate(() => [window.__ed.TUNE.gravity, window.__ed.REG.archetypes.husk.hp, window.__ed.REG.skills.blade.dmgMul]);
	assert.deepEqual(kept, [5, 300, 2], "changes must survive a reload");
	const reset = await page.evaluate(() => {
		const X = window.__ed;
		X.tuneReset();
		for (const k of Object.keys(X.TUNE_OVR)) X.ovrSet(k, undefined);
		return [X.TUNE.gravity, X.REG.archetypes.husk.hp, X.REG.skills.blade.dmgMul, X.TUNE.baseLife];
	});
	assert.deepEqual(reset, [1, 30, undefined, 70]);
});

await check("Settings: tuning pages, tiers, search, guide jump, inspector", async () => {
	await page.evaluate(() => window.__ed.UI.open("settings"));
	await page.getByRole("tab", { name: "Combat", exact: true }).click();
	await page.getByRole("button", { name: "Simple", exact: true }).click();
	const simple = await page.locator(".ed-knob").count();
	await page.getByRole("button", { name: "Advanced", exact: true }).click();
	const advanced = await page.locator(".ed-knob").count();
	assert.ok(advanced > simple && simple > 0, "Advanced must show more than Simple");
	await page.getByRole("spinbutton", { name: "Knockback strength value", exact: true }).fill("2");
	await page.getByRole("spinbutton", { name: "Knockback strength value", exact: true }).press("Enter");
	assert.equal(await page.evaluate(() => window.__ed.TUNE.knockback), 2);
	await page.getByRole("button", { name: "Reset Knockback strength", exact: true }).click();
	assert.equal(await page.evaluate(() => window.__ed.TUNE.knockback), 1);
	await page.getByRole("tab", { name: "Keys & help", exact: true }).click();
	await page.getByRole("button", { name: "Change gravity →" }).click();
	await page.getByRole("slider", { name: "Gravity", exact: true }).waitFor();
	await page.getByRole("searchbox", { name: "Find a setting" }).fill("skeleton");
	await page.getByRole("button", { name: "Monster: Skeleton" }).click();
	await page.getByRole("spinbutton", { name: "Skeleton hp", exact: true }).fill("99");
	await page.getByRole("spinbutton", { name: "Skeleton hp", exact: true }).press("Enter");
	assert.equal(await page.evaluate(() => window.__ed.REG.archetypes.skeleton.hp), 99);
	await page.getByRole("button", { name: "Reset this monster", exact: true }).click();
	assert.equal(await page.evaluate(() => window.__ed.REG.archetypes.skeleton.hp), 24);
	await page.screenshot({ path: out + "/panel.png" });
});

assert.deepEqual(errors, [], "page errors: " + errors.join(" | "));
console.log("All " + checks.length + " tuning scenarios passed.");
await browser.close();
