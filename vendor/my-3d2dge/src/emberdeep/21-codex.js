/* Codex is a separate procedural rig, not a Humanoid skin. Local coordinates: forward, right, up.
 * A floating folio, detached gauntlets, porcelain mask, brass astrolabe and three loose leaves.
 * It implements the small rig interface shared skills need, without borrowing the swordsman's gait. */
class CodexRig {
	constructor(hero) {
		this.hero = hero;
		this.o = { size: 1, weapon: "staff", bladeLen: 13, hunch: 0, lean: 0 };
		this.C = {
			metal: "#eee2b9",
			metalDk: "#bdae88",
			hilt: "#d2a353",
			cloth: "#30263f",
			skin: "#fff5da",
		};
		this.t = 0;
		this.phase = 0;
		this.facing = 0;
		this.x = this.y = this.z = 0;
		this.fold = this.fall = this.flare = this.bank = this.recoil = 0;
		this.J = {};
		this.state = {};
		this.trail = [];
		this.update(0, {});
	}
	kick(v) {
		this.recoil = clamp(this.recoil + v * 0.15, -2, 2);
	}
	_w(p) {
		const c = Math.cos(this.facing),
			s = Math.sin(this.facing),
			k = this.o.size;
		return [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2] * k];
	}
	hand(side = "R") {
		const p = this._w(this.J["hand" + side]);
		return [this.x + p[0], this.y + p[1], this.z + p[2]];
	}
	head() {
		const p = this._w(this.J.head);
		return [this.x + p[0], this.y + p[1], this.z + p[2]];
	}
	tip() {
		const p = this._w(E.V3.add(this.J.handR, E.V3.mul(this.J.bladeDir, 13)));
		return [this.x + p[0], this.y + p[1], this.z + p[2]];
	}
	update(dt, s = {}) {
		this.t += dt;
		this.phase = this.t;
		this.state = s;
		this.x = s.x || 0;
		this.y = s.y || 0;
		this.z = s.z || 0;
		this.facing = s.facing || 0;
		const h = this.hero,
			speed = Math.hypot(s.vx || 0, s.vy || 0) / 90;
		this.run = approach(this.run || 0, s.run || Math.min(1, speed), dt * 4);
		this.bank = approach(
			this.bank,
			(-(s.vx || 0) * Math.sin(this.facing) +
				(s.vy || 0) * Math.cos(this.facing)) /
				110,
			dt * 4,
		);
		this.fold = approach(
			this.fold,
			s.dash ? 1 : s.pose === "crouch" || s.pose === "kneel" ? 0.35 : 0,
			dt * (s.dash ? 15 : 9),
		);
		this.fall = approach(
			this.fall,
			s.pose === "die" || s.down ? 1 : 0,
			dt * 2.4,
		);
		const st = s.attack,
			cast =
				s.codexPose || (st ? "quill" : s.pose === "cast" ? "seal" : s.pose);
		this.cast = cast;
		const stroke = st
			? st.phase === "wind"
				? -0.45 * st.u
				: st.phase === "active"
					? Math.sin(st.u * Math.PI)
					: 0.3 * (1 - st.u)
			: s.codexStroke || 0;
		this.flare = approach(
			this.flare,
			cast === "finale" || cast === "cheer" ? 1 : cast ? 0.4 : 0,
			dt * 6,
		);
		this.recoil *= Math.exp(-dt * 10);
		this.hover =
			(4 + Math.sin(this.t * 2.8) * 0.7 + this.run * 1.2 + this.recoil) *
			(1 - this.fall);
		const z = this.hover,
			fold = this.fold,
			hurt = s.hurt ? -2 : 0;
		this.J = {
			hipC: [0, 0, 9 + z],
			shC: [0, 0, 20 + z],
			head: [1, 0, 29 + z + hurt],
			handL: [
				4 + Math.sin(this.t * 1.7),
				-9 - this.flare * 5,
				17 + z + this.flare * 8,
			],
			handR: [4 + stroke * 9, 9 - stroke * 4, 17 + z + stroke * 5],
			bladeDir: E.V3.norm([0.7 + stroke, 0.2, 0.6 - stroke * 0.5]),
		};
		if (cast === "orbit" || cast === "finale") {
			this.J.handR = [2, 11, 26 + z];
			this.J.handL = [2, -11, 26 + z];
		}
		if (cast === "seal")
			this.J.handR = [
				8,
				4 + Math.sin(stroke * 5) * 5,
				22 + z + Math.cos(stroke * 5) * 3,
			];
		if (cast === "folio") {
			this.J.handR = [6, 11 + stroke * 5, 19 + z];
			this.J.handL = [6, -11 - stroke * 5, 19 + z];
		}
		if (cast === "revision") this.J.handL = [5, -1, 18 + z];
		if (s.pose === "wave")
			this.J.handL = [2, -10, 28 + z + Math.sin(this.t * 8) * 2];
		if (h.potionT > 0) this.J.handL = [7, -2, 23 + z];
		for (const key of ["handL", "handR"]) {
			this.J[key][1] *= 1 - fold * 0.75;
			this.J[key][2] = lerp(this.J[key][2], 12, fold);
		}
		this.stroke = stroke;
	}
	draw(g, ox, oy, sourceView) {
		// Keep the face readable from a high camera, as the engine does for its other characters.
		const view = E.charView ? E.charView(sourceView) : sourceView;
		this._lastView = view;
		const q = [],
			h = this.hero,
			t = this.t,
			fold = this.fold,
			fall = this.fall;
		const C = {
			ink: "#181629",
			shade: "#353048",
			paper: "#eee2b9",
			light: "#fff5da",
			gold: "#d2a353",
			darkGold: "#765235",
			mint: "#83f4df",
			purple: "#bc9bea",
		};
		const charge = (h.manuscript || 0) / 3,
			glow = charge >= 1 ? "#ffe08b" : C.mint;
		const weapon = h.gear && h.gear.weapon,
			accent =
				weapon && weapon.el && weapon.el !== "phys"
					? EL(weapon.el).light
					: glow;
		const armor = h.gear && h.gear.chest,
			edging = armor && armor.rarity >= 2 ? "#f2cd79" : C.gold;
		const transform = (p) => {
			let [f, r, z] = p;
			f -= this.run * (z - 10) * 0.14;
			r -= this.bank * (z - 10) * 0.14;
			f *= 1 - fold * 0.35;
			r *= 1 - fold * 0.65;
			z = lerp(z, 12 + (z - 18) * 0.24, fold);
			const a = fall * 1.4,
				cf = Math.cos(a),
				sf = Math.sin(a);
			return this._w([
				f * cf + (z - 3) * sf,
				r,
				Math.max(1, (z - 3) * cf - f * sf + 3),
			]);
		};
		const project = (p) => {
			const w = transform(p),
				a = view.p(...w);
			return [ox + a[0], oy + a[1]];
		};
		const depth = (p) => view.depth(...transform(p));
		const face = (pts, color, edge = C.ink) => {
			const d = pts.reduce((n, p) => n + depth(p), 0) / pts.length;
			q.push({
				d,
				draw() {
					const ps = pts.map(project);
					px.poly(g, ps, color);
					if (edge)
						for (let i = 0; i < ps.length; i++)
							px.line(g, ...ps[i], ...ps[(i + 1) % ps.length], edge);
				},
			});
		};
		const line = (a, b, color, width = 1, bias = 0.05) =>
			q.push({
				d: (depth(a) + depth(b)) / 2 + bias,
				draw() {
					px.line(g, ...project(a), ...project(b), color, width);
				},
			});
		const gem = (at, radius, color, tall = radius) => {
			const [f, r, z] = at,
				top = [f, r, z + tall],
				bottom = [f, r, z - tall];
			const ring = [
				[f + radius, r, z],
				[f, r + radius, z],
				[f - radius, r, z],
				[f, r - radius, z],
			];
			ring.forEach((p, i) => {
				face([top, p, ring[(i + 1) % 4]], i % 2 ? color : E.shade(color, 0.2));
				face([bottom, ring[(i + 1) % 4], p], E.shade(color, -0.25));
			});
		};
		const z = this.hover;
		// Two ribbons of bookmark silk. Their travelling bend trails the glide, never a walking cycle.
		for (const side of [-1, 1])
			for (let i = 0; i < 4; i++) {
				const tail = (n) => [
					-3 - n * (0.7 + this.run * 1.5),
					side * (2 + Math.sin(t * 4 - n * 0.8) * 0.8),
					11 + z - n * 2.7,
				];
				const a = tail(i),
					b = tail(i + 1);
				face(
					[
						[a[0], a[1] - 1, a[2]],
						[a[0], a[1] + 1, a[2]],
						[b[0], b[1] + 0.6, b[2]],
						[b[0], b[1] - 0.6, b[2]],
					],
					side < 0 ? C.purple : C.mint,
					C.shade,
				);
			}
		// The book is the body: a faceted spine, two hinged covers, visible stacks of paper.
		gem([-1, 0, 16 + z], 4.5, C.shade, 8);
		for (const side of [-1, 1]) {
			const spread = 7.5 + this.flare * 4,
				flutter = Math.sin(t * 3 + side) * 0.6;
			face(
				[
					[-2, side, 24 + z],
					[-3, side * spread, 22 + z + flutter],
					[-3, side * (spread + 1), 10 + z],
					[-1, side * 2, 9 + z],
				],
				C.ink,
				edging,
			);
			for (let leaf = 0; leaf < 3; leaf++) {
				const offset = leaf * 0.35,
					r = side * (spread - 0.9 + offset),
					base = 11 + z + leaf * 0.5;
				face(
					[
						[0.3 + offset, side * 1.7, 23 + z],
						[-1 + offset, r, 21.7 + z + flutter],
						[-1 + offset, r, base],
						[0.3 + offset, side * 1.7, 10.5 + z],
					],
					leaf === 2 ? C.paper : "#bdae88",
					null,
				);
			}
			for (let row = 0; row < 5; row++)
				line(
					[1.1, side * 2.5, 13 + z + row * 1.6],
					[-0.2, side * (spread - 1.7 - (row % 2)), 13 + z + row * 1.6],
					"#706453",
				);
		}
		gem([3.3, 0, 18 + z], 2.3, fall > 0.7 ? C.darkGold : glow, 3.4);
		// A mechanical halo, behind the detached mask. Gaps make the orbit's rotation legible.
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * TAU + t * 0.22,
				b = a + 0.32,
				R = 8 + this.flare * 2;
			line(
				[-3, Math.cos(a) * R, 29 + z + Math.sin(a) * R],
				[-3, Math.cos(b) * R, 29 + z + Math.sin(b) * R],
				i % 3 ? C.gold : glow,
			);
		}
		// Porcelain face, split into asymmetrical folds. Eye slits are geometry on its forward plane.
		const hz = 29 + z + (this.state.hurt ? -2 : 0);
		face(
			[
				[2, -4, hz + 4],
				[4.5, 0, hz + 5],
				[5, 0, hz - 5],
				[2.5, -3, hz - 2],
			],
			C.light,
		);
		face(
			[
				[4.5, 0, hz + 5],
				[2, 4, hz + 3],
				[2.5, 3, hz - 2],
				[5, 0, hz - 5],
			],
			"#c7bd9b",
		);
		face(
			[
				[-1, -3.5, hz + 3],
				[2, -4, hz + 4],
				[2.5, -3, hz - 2],
				[0, 0, hz - 4],
			],
			C.shade,
		);
		face(
			[
				[2, 4, hz + 3],
				[-1, 3.5, hz + 3],
				[0, 0, hz - 4],
				[2.5, 3, hz - 2],
			],
			C.ink,
		);
		if (Math.cos(this.facing) * view.fx + Math.sin(this.facing) * view.fy > 0) {
			const width = Math.max(1, Math.round(view.scale * 0.4));
			for (const side of [-1, 1]) {
				const a = [3.8, side * 3, hz + 0.8],
					b = [5.2, side * 0.7, hz];
				line(a, b, C.ink, width + 2, 2);
				if (fall < 0.7) line(a, b, glow, width, 2.1);
			}
		}
		line([5.1, 0, hz - 1.3], [5.1, 0, hz - 3.3], C.darkGold, 1, 2);
		// Detached gauntlets articulate independently; no elbows or human arm swing.
		for (const side of ["L", "R"]) {
			const p = this.J["hand" + side];
			gem(p, 1.6, C.light, 2.6);
			for (let finger = -1; finger <= 1; finger++)
				line(
					[p[0] + 1, p[1] + finger * 0.75, p[2]],
					[p[0] + 3.5, p[1] + finger, p[2] - 1.6],
					C.gold,
				);
		}
		if (this.o.weapon) {
			const a = this.J.handR,
				b = E.V3.add(a, E.V3.mul(this.J.bladeDir, 13)),
				back = E.V3.add(a, E.V3.mul(this.J.bladeDir, -6));
			line(back, b, C.gold, 2);
			line(a, b, accent);
			const wing = [back[0] - 2, back[1] + 3, back[2] + 3];
			face([back, wing, E.V3.lerp(a, b, 0.2), a], C.light, C.darkGold);
			gem(b, 0.9, accent, 1.6);
		}
		// Three manuscript leaves orbit the silhouette and fill with ink as the passive charges.
		for (let i = 0; i < 3; i++) {
			const a = t * (this.state.dash ? 9 : 0.9) + (i * TAU) / 3,
				R = 12 + this.flare * 6;
			const f = Math.cos(a) * R,
				r = Math.sin(a) * R,
				az = 17 + z + Math.sin(a * 1.5 + i) * 3;
			face(
				[
					[f - 1.5, r - 2, az - 2],
					[f + 1.5, r - 2, az - 2],
					[f + 1.5, r + 2, az + 2],
					[f - 1.5, r + 2, az + 2],
				],
				i < (h.manuscript || 0) ? "#ffe5a0" : C.paper,
				C.darkGold,
			);
			line(
				[f, r - 1, az - 1],
				[f, r + 1, az + 1],
				i < (h.manuscript || 0) ? "#a06535" : C.shade,
				1,
				0.1,
			);
		}
		if (h.potionT > 0) {
			const p = this.J.handL;
			gem([p[0] + 2, p[1], p[2] + 2], 2, "#f5779d", 3);
		}
		q.sort((a, b) => a.d - b.d);
		for (const part of q) part.draw();
		if (fold > 0.2) {
			const center = project([0, 0, 12]),
				radius = (5 + fold * 5) * (view.zoom || 1);
			for (let i = 0; i < 6; i++) {
				const a = t * 9 + (i * TAU) / 6,
					b = a + 0.7;
				px.line(
					g,
					center[0] + Math.cos(a) * radius,
					center[1] + Math.sin(a) * radius * 0.45,
					center[0] + Math.cos(b) * radius,
					center[1] + Math.sin(b) * radius * 0.45,
					glow,
				);
			}
		}
	}
	drawSmear(r) {
		const s = this.state;
		if (!s.codexPose && !(s.attack && s.attack.phase === "active")) {
			this.trail.length = 0;
			return;
		}
		const p = this.tip();
		if (
			this.trail.length &&
			Math.hypot(p[0] - this.trail[0][0], p[1] - this.trail[0][1]) > 40
		)
			this.trail.length = 0;
		this.trail.unshift(p);
		this.trail.length = Math.min(5, this.trail.length);
		for (let i = 1; i < this.trail.length; i++) {
			const a = this.trail[i - 1],
				b = this.trail[i];
			r.queue(
				a[0],
				a[1],
				a[2],
				(g) => {
					px.line(g, ...r.w(...a), ...r.w(...b), i < 2 ? "#f9f1c9" : "#83d7cf");
				},
				{ emissive: true },
			);
		}
	}
	drawPortrait(g, x, y, size = 40) {
		const v = new E.View("portrait", "Codex", 0, 15, size / 27);
		this.draw(g, x + size / 2, y + size * 1.2, v);
	}
}

/* Codex as a playable character (18-characters.js): everything the game does differently for it is here. */
def("characters", "codex", {
	name: "Codex",
	title: "The Unwritten",
	color: "#9cebdd",
	desc: "A lost archive that wrote itself a soul. An ivory mask, a brass-bound folio, and pages that refuse to fall.",
	style: "Inertial glide · written magic · foldstep dodge",
	skills: ["cx_quill", "cx_seal", "cx_folio", "cx_revision", "cx_orbit", "cx_finale"],
	speed: 90,
	acceleration: 620,
	dodgeTime: 0.32,
	dodgeSpeed: 245,
	head: 32,
	r: 5,
	stats(h, add) {
		add("ember", 25);
		add("emberRegen", 2);
		add("castSpeed", 10);
	},
	init(h) {
		h.manuscript = 0; // Quillshot's pages (29-codex-skills.js); three illuminate the next signature spell
	},
	kit(h) {
		h.gear.weapon = makeItem({ base: "staff", rarity: 0, ilvl: 1, R: RNG("codex-quill") });
		h.gear.weapon.name = "The First Quill";
		h.gear.weapon.el = "storm";
		h.gear.chest.name = "Archive Bindings";
		h.gear.chest.look.colors.cloth = "#30263f";
		h.gear.cloak.name = "Unwritten Pages";
		h.gear.cloak.look.colors = { cape: "#eee2b9", capeIn: "#83d7cf" };
	},
	rig: (h) => new CodexRig(h),
	ownLayers: true, // the rig folds for the dodge, lifts the flask and sags when wounded on its own
	clips: false,
	dropIn(h, from) {
		// it glides down folded and opens into its orbit with a burst of pages
		return startAction(h, {
			name: "dropin",
			cancel: false,
			moveK: 0,
			rig: { dash: true },
			update(dt) {
				this.t += dt;
				const u = Math.min(1, this.t / 0.9);
				this.z = from * Math.pow(1 - u, 3);
				this.rig = { dash: u < 0.55, codexPose: u > 0.55 ? "orbit" : null };
				if (u === 1 && !this.landed) {
					this.landed = true;
					cxBurst(h.x, h.y, 24, "#83f4df", 0.6);
					sfx("cx_fold", { pitch: 1.4, vol: 0.45 });
				}
				return this.t < 1.15;
			},
		});
	},
	titlePose(t) {
		const ct = t % 12;
		return {
			codexPose: ct > 3 && ct < 5 ? "seal" : ct > 9 ? "finale" : null,
			codexStroke: Math.sin(t * 4),
			dash: ct > 6 && ct < 6.35,
			run: ct > 7 && ct < 9 ? 0.6 : 0,
		};
	},
	preview(h, part) {
		h.manuscript = part === 3 ? 3 : 0;
		return { codexPose: part === 3 ? "finale" : null };
	},
	titleZoom: [0.85, 1.4],
	dollHeight: 43,
	menuNotes(el, C) {
		formElement(
			"p",
			"Manuscript: land three Quillshot hits to illuminate your next Codex spell. Orbiting pages and three gold pips show the charge. Hovering is visual: walls, hazards and chasms still matter.",
			el,
		);
		formElement(
			"p",
			"Starts with all six signature spells. Upgrade their ranks and choose runes in Skills; all shared skills, gear, crafting and passives remain available.",
			el,
		);
		const list = formElement("ul", "", el);
		for (const skill of C.skills) {
			const S = REG.skills[skill];
			if (S) formElement("li", S.name + " — " + S.desc(), list);
		}
	},
});
