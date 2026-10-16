// Renders the actual procedural rig for the character's documentation, with no external art assets.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const frames = process.argv.includes("--frames");
const folder = resolve("check-output/codex-showcase");
mkdirSync(folder, { recursive: true });
mkdirSync("docs/assets", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
	const page = await browser.newPage({ viewport: { width: 960, height: 620 } });
	await page.goto(
		pathToFileURL(resolve("examples/emberdeep.html")).href +
			"?character=codex#town",
	);
	await page.waitForFunction(() => window.__ed);
	await page.evaluate(() => {
		__ed.game.paused = true;
		const E = My3D2dge,
			cv = document.createElement("canvas");
		cv.width = 960;
		cv.height = 620;
		cv.id = "showcase";
		cv.style.cssText =
			"position:fixed;inset:0;z-index:999;width:960px;height:620px;image-rendering:pixelated";
		document.body.appendChild(cv);
		const g = cv.getContext("2d");
		const names = [
			"IDLE / OBSERVE",
			"GLIDE / BANK",
			"FOLDSTEP",
			"QUILLSHOT",
			"ILLUMINATED",
			"DEFEAT / UNBIND",
		];
		const heroes = names.map(() => __ed.newHero("codex"));
		const view = new E.View("showcase", "Showcase", 0, 20, 3.8);
		window.drawCodexSheet = (t, dt) => {
			g.fillStyle = "#100d1b";
			g.fillRect(0, 0, 960, 620);
			g.fillStyle = "#83f4df";
			g.font = "12px monospace";
			g.fillText("EMBERDEEP  /  PLAYABLE CHARACTER 02", 28, 28);
			g.fillStyle = "#fff0c9";
			g.font = "bold 38px monospace";
			g.fillText("CODEX", 28, 69);
			g.fillStyle = "#bcb0ce";
			g.font = "17px monospace";
			g.fillText("THE UNWRITTEN", 174, 66);
			g.font = "12px monospace";
			g.fillText(
				"A soul written in the margins. An archive that refuses to fall.",
				28,
				94,
			);
			for (let i = 0; i < heroes.length; i++) {
				const h = heroes[i],
					x = 24 + (i % 3) * 312,
					y = 114 + Math.floor(i / 3) * 237;
				g.fillStyle = "#191525";
				g.fillRect(x, y, 296, 224);
				g.strokeStyle = "#463953";
				g.strokeRect(x + 0.5, y + 0.5, 295, 223);
				g.fillStyle = "#bfa36b";
				g.font = "11px monospace";
				g.fillText(names[i], x + 14, y + 20);
				const cycle = t % 2,
					wave = 0.5 + 0.5 * Math.sin(t * 4);
				const state = {
					x: 0,
					y: 0,
					z: 0,
					facing: Math.PI / 2 + Math.sin(t * 0.7) * 0.4,
					vx: i === 1 ? 75 : 0,
					vy: i === 1 ? 45 : 0,
					dash: i === 2 && cycle < 0.55,
					pose: i === 5 && cycle < 1.5 ? "die" : null,
					codexPose: i === 3 ? "quill" : i === 4 ? "finale" : null,
					codexStroke: i === 3 ? Math.sin(t * 8) : 0,
				};
				h.manuscript = i === 4 ? 3 : i === 3 ? Math.floor(t * 2) % 4 : 0;
				h.rig.update(dt, state);
				const sway = i === 1 ? Math.sin(t * 2) * 16 : 0;
				const floor = i === 5 ? 184 : 197;
				E.px.ell(g, x + 148 + sway, y + floor + 1, 45, 8, "#0c0a14");
				h.rig.draw(g, x + 148 + sway, y + floor, view);
				if (i === 4) {
					g.fillStyle = "#ffd782";
					for (let p = 0; p < 3; p++)
						g.fillRect(x + 124 + p * 18, y + 211, 8, 3);
				}
				if (i === 1) {
					g.fillStyle = "#83f4df";
					g.globalAlpha = 0.15 + wave * 0.15;
					g.fillRect(x + 30, y + 174, 25, 1);
					g.fillRect(x + 44, y + 180, 16, 1);
					g.globalAlpha = 1;
				}
			}
			g.fillStyle = "#92859e";
			g.font = "11px monospace";
			g.fillText(
				"Actual in-game rig  /  Six signature spells  /  Independent progression and save",
				28,
				609,
			);
			return cv.toDataURL("image/png").split(",")[1];
		};
	});
	// Settle each pose and capture a still with the foldstep closed and the fallen folio visible.
	for (let i = 0; i <= 45; i++)
		await page.evaluate((t) => window.drawCodexSheet(t, 1 / 60), i / 60);
	const png = await page.evaluate(() => window.drawCodexSheet(0.3, 0.1));
	writeFileSync("docs/assets/codex-showcase.png", Buffer.from(png, "base64"));
	if (frames)
		for (let i = 0; i < 120; i++) {
			const data = await page.evaluate(
				(t) => window.drawCodexSheet(t, 1 / 15),
				i / 15,
			);
			writeFileSync(
				folder + "/frame-" + String(i).padStart(3, "0") + ".png",
				Buffer.from(data, "base64"),
			);
		}
	console.log(
		"Rendered docs/assets/codex-showcase.png" +
			(frames ? " and 120 animation frames" : ""),
	);
} finally {
	await browser.close();
}
