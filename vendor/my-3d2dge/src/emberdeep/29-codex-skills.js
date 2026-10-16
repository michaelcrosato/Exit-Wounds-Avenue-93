/* Codex's six written spells. They share damage, loot, ranks, runes and status rules with the game. */
const CX = {
	mint: "#83f4df",
	paper: "#fff0c9",
	gold: "#ffd782",
	ink: "#625092",
	purple: "#bc9bea",
};
A.define("cx_write", [
	{
		wave: "noise",
		freq: 4200,
		to: 1500,
		dur: 0.07,
		vol: 0.12,
		filter: "highpass",
	},
	{ wave: "triangle", freq: 880, to: 1320, dur: 0.13, vol: 0.13 },
]);
A.define("cx_fold", [
	{
		wave: "noise",
		freq: 900,
		to: 3800,
		dur: 0.19,
		vol: 0.13,
		filter: "bandpass",
	},
	{ wave: "sine", freq: 440, to: 220, dur: 0.25, vol: 0.2 },
]);
A.define("cx_seal", [
	{
		wave: "triangle",
		freq: 660,
		arp: [0, 7, 12],
		step: 0.05,
		dur: 0.35,
		vol: 0.22,
	},
	{ wave: "sine", freq: 160, to: 80, dur: 0.25, vol: 0.23 },
]);

function cxGlyph(r, x, y, radius, color, turn = 0, alpha = 1) {
	r.groundRing(x, y, radius, color, alpha);
	const points = Array.from({ length: 6 }, (_, i) => {
		const a = turn + (i * TAU) / 6;
		return [x + Math.cos(a) * radius * 0.8, y + Math.sin(a) * radius * 0.8];
	});
	const g = r.tgt;
	px.blend(g, alpha, "normal", () => {
		for (let i = 0; i < 6; i++)
			px.line(
				g,
				...r.w(...points[i], 0.3),
				...r.w(...points[(i + 2) % 6], 0.3),
				color,
			);
	});
}
function cxBurst(x, y, radius, color = CX.mint, dur = 0.6) {
	FX.visual(dur, (r, u) =>
		r.decal(
			() =>
				cxGlyph(
					r,
					x,
					y,
					radius * (0.7 + 0.3 * u),
					color,
					u * 0.5,
					(1 - u) * 0.8,
				),
			{ emissive: true },
		),
	);
}
function cxTarget(h, ctx, reach = 125) {
	const dx = ctx.tx - h.x,
		dy = ctx.ty - h.y,
		d = Math.hypot(dx, dy),
		a = d > 1 ? Math.atan2(dy, dx) : h.aim;
	let x = h.x,
		y = h.y;
	for (let n = 4; n <= Math.min(reach, Math.max(8, d)); n += 4) {
		const nx = h.x + Math.cos(a) * n,
			ny = h.y + Math.sin(a) * n;
		if (ED.L.map.heightAt(nx, ny) > 8) break;
		x = nx;
		y = ny;
	}
	return [x, y];
}
function cxCast(h, ctx, pose, wind, recovery, fire) {
	return {
		name: ctx.id,
		moveK: 0.65,
		face: ctx.aim,
		cancel: true,
		speed: h.castMul,
		rig: { codexPose: pose, codexStroke: 0 },
		update(dt) {
			this.t += dt;
			this.rig.codexStroke =
				this.t < wind
					? (-this.t / wind) * 0.5
					: Math.max(0, 1 - (this.t - wind) / recovery);
			if (!this.fired && this.t >= wind) {
				this.fired = true;
				const empowered = ctx.id !== "cx_quill" && h.manuscript >= 3;
				if (empowered) {
					h.manuscript = 0;
					h.illuminatedT = 1;
					cxBurst(h.x, h.y, 22, CX.gold);
				}
				fire(empowered ? 1.5 : 1, empowered);
				sfx(pose === "quill" ? "cx_write" : "cx_seal", { vol: 0.6 });
			}
			this.free = this.fired && this.t > wind + recovery * 0.55;
			return this.t < wind + recovery;
		},
	};
}
function cxQuill(h, ctx, a, scale = 1, options = {}) {
	const p = h.rig.hand("R");
	// Aim from the detached hand, rather than firing a parallel ray from beside the target line.
	const angle = Math.atan2(ctx.ty - p[1], ctx.tx - p[0]) + a - ctx.aim;
	return FX.bolt({
		team: "hero",
		src: h,
		x: p[0],
		y: p[1],
		z: 12,
		ang: angle,
		speed: 330,
		life: 0.65,
		r: 3,
		el: "storm",
		pierce: ctx.pierce,
		chain: ctx.chains,
		hit: ctx.hit(scale, { kb: 25, extra: { statusChance: 0.12 } }),
		...options,
		look: {
			trail: false,
			draw(g, x, y, bolt, r) {
				const a0 = r.w(
						bolt.x - Math.cos(bolt.ang) * 10,
						bolt.y - Math.sin(bolt.ang) * 10,
						bolt.z,
					),
					dx = x - a0[0],
					dy = y - a0[1],
					d = Math.hypot(dx, dy) || 1,
					nx = (-dy / d) * 2,
					ny = (dx / d) * 2;
				px.poly(
					g,
					[
						[x, y],
						[x - dx * 0.6 + nx, y - dy * 0.6 + ny],
						a0,
						[x - dx * 0.6 - nx, y - dy * 0.6 - ny],
					],
					CX.paper,
				);
				px.line(g, ...a0, x, y, CX.mint);
			},
		},
	});
}
function cxIcon(kind) {
	return (g, x, y, s) => {
		const p = (a, b) => [x + a * s, y + b * s];
		if (kind === "quill") {
			px.poly(g, [p(3, 13), p(6, 4), p(12, 2), p(11, 9)], CX.paper);
			px.line(g, ...p(3, 13), ...p(11, 4), CX.mint);
		} else if (kind === "seal") {
			ICON.ring(g, x, y, s, CX.mint);
			px.line(g, ...p(4, 11), ...p(8, 4), CX.paper);
			px.line(g, ...p(8, 4), ...p(12, 11), CX.paper);
		} else if (kind === "folio") {
			for (let i = 0; i < 3; i++)
				px.poly(
					g,
					[p(3 + i * 3, 4 - i), p(7 + i * 3, 5), p(9 - i, 13), p(3 - i, 11)],
					i === 1 ? CX.mint : CX.paper,
				);
		} else if (kind === "revision") {
			ICON.arc(g, x, y, s, CX.purple);
			px.line(g, ...p(5, 8), ...p(11, 8), CX.paper, s);
			px.line(g, ...p(8, 5), ...p(8, 11), CX.paper, s);
		} else if (kind === "orbit") {
			ICON.ring(g, x, y, s, CX.gold);
			for (let i = 0; i < 3; i++)
				px.rect(
					g,
					x + (3 + i * 4) * s,
					y + (i === 1 ? 3 : 9) * s,
					3 * s,
					4 * s,
					CX.paper,
				);
		} else {
			px.poly(
				g,
				[p(2, 3), p(8, 5), p(14, 3), p(13, 12), p(8, 14), p(3, 12)],
				CX.paper,
			);
			px.line(g, ...p(8, 5), ...p(8, 14), CX.gold);
			ICON.star(g, x, y - 3 * s, s * 0.7, CX.mint);
		}
	};
}
function cxSkill(id, spec) {
	return def("skills", "cx_" + id, {
		character: "codex",
		unlock: 1,
		el: "storm",
		color: "#254f54",
		icon: cxIcon(id),
		...spec,
	});
}

cxSkill("quill", {
	name: "Quillshot",
	kind: "basic",
	tags: ["spell", "proj"],
	cost: 0,
	gen: 9,
	genOnHit: true,
	range: 145,
	desc: () =>
		"Flick a luminous quill. Hits generate Ember and inscribe a page. At three pages, your next Codex spell is Illuminated: 50% stronger.",
	runes: [
		{
			id: "fork",
			name: "Double Script",
			desc: "Two quills fan out, each dealing 70% damage.",
		},
		{
			id: "seek",
			name: "True Name",
			desc: "Quills seek nearby enemies and pierce one extra target.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "quill", 0.08, 0.27, () => {
			const n = 1 + ctx.proj + (ctx.rune === "fork" ? 1 : 0);
			for (let i = 0; i < n; i++)
				cxQuill(
					h,
					ctx,
					ctx.aim + (i - (n - 1) / 2) * 0.13,
					ctx.rune === "fork" ? 0.77 : 1.1,
					{
						home: ctx.rune === "seek" ? 3 : 0,
						pierce: ctx.pierce + (ctx.rune === "seek" ? 1 : 0),
					},
				);
		});
	},
});
cxSkill("seal", {
	name: "Margin Seal",
	kind: "core",
	tags: ["spell", "aoe"],
	el: "frost",
	cost: 18,
	cd: 2.8,
	desc: () =>
		"Write a seal at your aim point. After a short warning it snaps shut, damaging and slowing the pack. Illuminated: 50% more damage and a wider seal.",
	runes: [
		{
			id: "bind",
			name: "Binding Clause",
			desc: "The seal also stuns for 0.6 seconds.",
		},
		{
			id: "echo",
			name: "Postscript",
			desc: "A second, weaker seal follows the first.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "seal", 0.24, 0.28, (power, lit) => {
			const [x, y] = cxTarget(h, ctx),
				radius = 29 * ctx.area * (lit ? 1.2 : 1),
				col = lit ? CX.gold : CX.mint;
			const burst = (scale) => {
				FX.nova({
					team: "hero",
					src: h,
					x,
					y,
					r0: 2,
					r1: radius,
					dur: 0.22,
					color: col,
					el: "frost",
					hit: ctx.hit(2.1 * power * scale, {
						kb: 55,
						extra: {
							el: "frost",
							status: "chill",
							statusChance: 1,
							statusPower: 2,
							stun: ctx.rune === "bind" ? 0.6 : 0,
						},
					}),
				});
				cxBurst(x, y, radius, col);
			};
			let fired = false,
				echo = false;
			FX.visual(
				0.9,
				(r, u) =>
					r.decal(
						() => cxGlyph(r, x, y, radius, col, -u, u < 0.4 ? 0.6 : 0.15),
						{ emissive: true },
					),
				(f) => {
					if (!fired && f.t >= 0.28) {
						fired = true;
						burst(1);
					}
					if (!echo && ctx.rune === "echo" && f.t >= 0.65) {
						echo = true;
						burst(0.5);
					}
				},
			);
		});
	},
});
cxSkill("folio", {
	name: "Razor Folio",
	kind: "core",
	tags: ["spell", "proj"],
	cost: 22,
	cd: 4,
	range: 120,
	el: "phys",
	desc: () =>
		"Unfurl a fan of five cutting pages. They pierce enemies, reach their edge, and return to your hands. Illuminated: 50% more damage.",
	runes: [
		{ id: "wide", name: "Loose Leaves", desc: "Seven pages in a wider fan." },
		{
			id: "rend",
			name: "Paper Cuts",
			desc: "Pages inflict bleeding.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "folio", 0.18, 0.36, (power) => {
			const n = (ctx.rune === "wide" ? 7 : 5) + ctx.proj;
			for (let i = 0; i < n; i++) {
				const a = ctx.aim + (i - (n - 1) / 2) * 0.16;
				const bolt = cxQuill(h, ctx, a, 0.7 * power, {
					pierce: 20 + ctx.pierce,
					life: 1.25,
					speed: 170,
					el: "phys",
					hit: ctx.hit(0.7 * power, {
						kb: 15,
						extra: {
							el: "phys",
							status: ctx.rune === "rend" ? "bleed" : undefined,
							statusChance: ctx.rune === "rend" ? 1 : 0,
						},
					}),
				});
				const update = bolt.update;
				bolt.look.draw = (g, x, y, p, r) => {
					const z = r.view.zoom || 1,
						a = p.t * 9,
						c = Math.cos(a),
						s = Math.sin(a),
						pt = (u, v) => [x + (u * c - v * s) * z, y + (u * s + v * c) * z];
					px.poly(g, [pt(-2, -4), pt(2, -4), pt(2, 4), pt(-2, 4)], CX.paper);
					px.line(g, ...pt(-1, -2), ...pt(1, -2), CX.ink);
					px.line(g, ...pt(-1, 0), ...pt(1, 0), CX.ink);
				};
				bolt.update = (dt) => {
					if (bolt.t > 0.4) {
						if (!bolt.returning) {
							bolt.returning = true;
							bolt.hitSet.clear();
						}
						const a = Math.atan2(h.y - bolt.y, h.x - bolt.x);
						bolt.vx = Math.cos(a) * 220;
						bolt.vy = Math.sin(a) * 220;
						if (Math.hypot(h.x - bolt.x, h.y - bolt.y) < 8) return false;
					}
					return h.alive && update(dt);
				};
			}
		});
	},
});
cxSkill("revision", {
	name: "Revision",
	kind: "core",
	tags: ["spell"],
	cost: 24,
	cd: 10,
	noAuto: true,
	bot: { heal: 0.65 }, // the autopilot casts it to heal, below 65% life
	desc: (rank = 1) => {
		const heal = 18 + Math.min(5, Math.max(0, rank - 1));
		return `Redraw your bindings: recover ${heal}% life, cleanse damaging ailments, and restore one foldstep. Illuminated: heal ${heal * 1.5}% instead.`;
	},
	runes: [
		{
			id: "ward",
			name: "Hardcover",
			desc: "Gain 50% increased armor for four seconds.",
		},
		{
			id: "flow",
			name: "Free Verse",
			desc: "Gain 20% movement speed for four seconds.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "revision", 0.26, 0.35, (power) => {
			h.hp = Math.min(
				h.maxHp,
				h.hp + h.maxHp * (0.18 + 0.01 * Math.min(5, ctx.rank - 1)) * power,
			);
			for (const id of ["burn", "poison", "bleed", "curse"]) delete h.st[id];
			h.dodges = Math.min(h.maxDodge, h.dodges + 1);
			h.buffs = h.buffs.filter((b) => b.id !== "cx_revision");
			h.buffs.push({
				id: "cx_revision",
				name: "Revised",
				t: 4,
				color: CX.mint,
				stats:
					ctx.rune === "ward"
						? { armorPct: 50 }
						: ctx.rune === "flow"
							? { moveSpeed: 20 }
							: {},
			});
			computeStats(h);
			cxBurst(h.x, h.y, 30, CX.mint, 1);
			P.glints(h.x, h.y, 20, 8, CX.paper, 15);
			sfx("heal", { vol: 0.45 });
		});
	},
});
cxSkill("orbit", {
	name: "Living Index",
	kind: "core",
	tags: ["spell", "aoe"],
	cost: 28,
	cd: 10,
	range: 58,
	desc: () =>
		"Release three orbiting leaves for four seconds. They cut nearby foes as you glide. Illuminated: 50% more damage.",
	runes: [
		{
			id: "reach",
			name: "Wide Margins",
			desc: "Leaves orbit farther out and last one second longer.",
		},
		{
			id: "guard",
			name: "Book Ward",
			desc: "Gain 20% all resistances while the leaves orbit.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "orbit", 0.3, 0.35, (power) => {
			const dur = ctx.rune === "reach" ? 5 : 4,
				R = (ctx.rune === "reach" ? 44 : 30) * ctx.area;
			if (ctx.rune === "guard") {
				h.buffs = h.buffs.filter((b) => b.id !== "cx_index");
				h.buffs.push({
					id: "cx_index",
					name: "Book Ward",
					color: CX.gold,
					t: dur,
					stats: { resAll: 20 },
				});
				computeStats(h);
			}
			const f = addFx({
				kind: "cx_index",
				t: 0,
				nt: 0,
				update(dt) {
					this.t += dt;
					this.nt -= dt;
					if (this.nt <= 0) {
						this.nt = 0.28;
						for (let i = 0; i < 3; i++) {
							const a = this.t * 3.4 + (i * TAU) / 3;
							hitCircle(
								"hero",
								h.x + Math.cos(a) * R,
								h.y + Math.sin(a) * R,
								10,
								() => ctx.hit(0.65 * power, { kb: 10 }),
							);
						}
					}
					return h.alive && this.t < dur;
				},
				draw(r) {
					for (let i = 0; i < 3; i++) {
						const a = this.t * 3.4 + (i * TAU) / 3,
							x = h.x + Math.cos(a) * R,
							y = h.y + Math.sin(a) * R;
						r.queue(
							x,
							y,
							12,
							(g) => {
								const p = r.w(x, y, 12),
									z = r.view.zoom || 1;
								px.poly(
									g,
									[
										[p[0], p[1] - 5 * z],
										[p[0] + 3 * z, p[1]],
										[p[0], p[1] + 5 * z],
										[p[0] - 3 * z, p[1]],
									],
									CX.paper,
								);
								px.line(g, p[0], p[1] - 3 * z, p[0], p[1] + 3 * z, CX.mint);
							},
							{ emissive: true },
						);
					}
				},
			});
			f.owner = h;
		});
	},
});
cxSkill("finale", {
	name: "The Last Word",
	kind: "ultimate",
	tags: ["spell", "aoe"],
	cost: 45,
	cd: 18,
	el: "void",
	desc: () =>
		"Open the archive at your aim point: draw the pack inward, then close the book in a radiant blast. Illuminated: 50% more damage and a larger finale.",
	runes: [
		{
			id: "silence",
			name: "Full Stop",
			desc: "The final blast stuns for one second.",
		},
		{
			id: "after",
			name: "Afterword",
			desc: "The blast leaves a damaging field for two seconds.",
		},
	],
	cast(h, ctx) {
		return cxCast(h, ctx, "finale", 0.55, 0.5, (power, lit) => {
			const [x, y] = cxTarget(h, ctx),
				R = 48 * ctx.area * (lit ? 1.2 : 1);
			FX.pull({ team: "hero", src: h, x, y, r: R, force: 270, dur: 0.8 });
			let fired = false;
			FX.visual(
				1.35,
				(r, u) => {
					r.decal(
						() =>
							cxGlyph(
								r,
								x,
								y,
								R * (u < 0.6 ? 1 - u * 0.3 : 1),
								u < 0.6 ? CX.purple : CX.gold,
								-u * 2,
								1 - u,
							),
						{ emissive: true },
					);
					r.queue(
						x,
						y,
						22,
						(g) => {
							const [sx, sy] = r.w(x, y, 22 + Math.sin(u * Math.PI) * 10),
								z = (r.view.zoom || 1) * Math.sin(u * Math.PI),
								w = 13 * z;
							px.poly(
								g,
								[
									[sx - w, sy - 7 * z],
									[sx, sy - 3 * z],
									[sx + w, sy - 7 * z],
									[sx + w, sy + 7 * z],
									[sx, sy + 10 * z],
									[sx - w, sy + 7 * z],
								],
								CX.paper,
							);
							px.line(g, sx, sy - 3 * z, sx, sy + 10 * z, CX.gold, 2);
						},
						{ emissive: true },
					);
				},
				(f) => {
					if (!fired && f.t > 0.8) {
						fired = true;
						FX.nova({
							team: "hero",
							src: h,
							x,
							y,
							r0: 2,
							r1: R,
							dur: 0.32,
							el: "void",
							color: CX.gold,
							hit: ctx.hit(5 * power, {
								kb: 130,
								extra: { stun: ctx.rune === "silence" ? 1 : 0 },
							}),
						});
						if (ctx.rune === "after")
							FX.area({
								team: "hero",
								src: h,
								x,
								y,
								r: R * 0.65,
								dur: 2,
								tick: 0.5,
								el: "void",
								hit: ctx.hit(0.55 * power),
							});
						sfx("cx_seal", { pitch: 0.65, vol: 0.9 });
						shake(4);
						game.freeze(0.045);
					}
				},
			);
		});
	},
});
BUS.on("hit", (e) => {
	const h = e.src;
	if (
		!h ||
		h !== ED.hero ||
		h.character !== "codex" ||
		e.hit.skill !== "cx_quill" ||
		e.hit.proc ||
		e.tgt.team !== "foe"
	)
		return;
	const was = h.manuscript || 0;
	h.manuscript = Math.min(3, was + 1);
	if (was < 3 && h.manuscript === 3) {
		sfx("chime", { pitch: 1.4, vol: 0.35 });
		P.text(h.x, h.y, 39, "ILLUMINATED", CX.gold);
	}
});
BUS.on("dodge", ({ h }) => {
	if (h.character === "codex") {
		sfx("cx_fold", { vol: 0.7 });
		cxBurst(h.x, h.y, 15, CX.purple, 0.4);
	}
});
BUS.on("heroDie", ({ h }) => {
	if (h.character === "codex") h.manuscript = 0;
});
BUS.on("draw", ({ r }) => {
	const h = ED.hero;
	if (!h || h.character !== "codex" || UI.hideHud || ED.mode === "gallery")
		return;
	r.overlay((g) => {
		const f = HUD_in(g, r);
		try {
		const x = f.W - 89,
			y = f.H - 45;
		for (let i = 0; i < 3; i++) {
			const c = i < h.manuscript ? CX.gold : "#40384d";
			px.poly(
				g,
				[
					[x + i * 9, y],
					[x + 4 + i * 9, y - 4],
					[x + 8 + i * 9, y],
					[x + 4 + i * 9, y + 4],
				],
				c,
			);
		}
		E.font.text(g, "SCRIPT", x + 13, y + 7, CX.paper, {
			font: "tiny",
			align: "center",
		});
		} finally {
			HUD_out(g);
		}
	});
});
