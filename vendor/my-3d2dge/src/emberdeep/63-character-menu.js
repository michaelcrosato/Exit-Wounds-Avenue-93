/* Character choice is a native, scrollable dialog for mouse, keyboard, touch and gamepad. */
function selectCharacter(id) {
	CHAR.selected = characterId(id);
	E.store.set("ed:character", CHAR.selected);
	ED.hero = loadHeroOrNew(CHAR.selected);
	ED.savedLevel = null;
	TITLE.confirmNew = false;
	return true;
}
function renderCharacters() {
	const id = CHAR.preview || CHAR.selected,
		C = CHARACTERS[id],
		saved = characterSave(id);
	CHAR.preview = id;
	CHAR.previewHero = newHero(id);
	CHAR.previewTime = 0;
	openForm("Choose your character", (el) => {
		formElement(
			"p",
			"Each character has a separate save. Your existing Wanderer is kept.",
			el,
		);
		const choices = formElement("div", "", el, {
			class: "ed-character-choices",
		});
		for (const profile of Object.values(CHARACTERS)) {
			const b = formButton(choices, profile.name, () => {
				CHAR.preview = profile.id;
				renderCharacters();
			});
			b.setAttribute("aria-pressed", String(profile.id === id));
		}
		const cv = formElement("canvas", "", el, {
			width: 320,
			height: 210,
			class: "ed-character-preview",
			"aria-label": C.name + " animated character preview",
		});
		CHAR.previewCanvas = cv;
		formElement("h3", C.name + " · " + C.title, el);
		formElement("p", C.desc, el);
		formElement("p", C.style, el);
		if (C.menuNotes) C.menuNotes(el, C); // a character's own lines (18-characters.js)
		formElement(
			"p",
			saved
				? "Saved: level " + saved.level + " · deepest floor " + saved.maxDepth
				: "A new journey at level 1.",
			el,
		);
		formButton(el, "PLAY AS " + C.name.toUpperCase(), () => {
			if (!selectCharacter(id)) return;
			UI.closeAll();
			startGame(false);
		});
		formButton(el, "VIEW IN GALLERY", () => {
			if (!selectCharacter(id)) return;
			UI.closeAll();
			game.go("gallery");
		});
	});
}
function updateCharacterPreview(dt) {
	updateForm();
	const cv = CHAR.previewCanvas,
		h = CHAR.previewHero;
	if (!cv || !cv.isConnected || !h) return;
	CHAR.previewTime += dt;
	const g = cv.getContext("2d"),
		t = CHAR.previewTime,
		part = Math.floor(t / 2.5) % 4;
	g.imageSmoothingEnabled = false;
	const s = {
		x: 0,
		y: 0,
		z: 0,
		facing: 0.8 + Math.sin(t * 0.45) * 0.55,
		run: part === 1 ? 1 : 0,
		vx: part === 1 ? 65 : 0,
		vy: 0,
		dash: part === 2 && t % 2.5 < 0.7,
		pose: part === 3 ? "cast" : null,
	};
	const C = characterOf(h);
	if (C.preview) Object.assign(s, C.preview(h, part, t)); // a character's own preview (Codex: its finale, its pages)
	if (!C.ownLayers && s.dash) s.flip = (t % 2.5) / 0.7; // the dodge: the rig's roll
	h.rig.update(dt, s);
	g.fillStyle = "#110e1e";
	g.fillRect(0, 0, cv.width, cv.height);
	px.ell(g, 160, 181, 56, 14, "#282338");
	const V = new E.View("character", "Preview", 0, 20, 3.6);
	h.rig.draw(g, 160, 181, V);
	E.font.text(
		g,
		["IDLE", "GLIDE / RUN", "DODGE", "CAST"][part],
		160,
		197,
		"#83f4df",
		{ align: "center", font: "tiny" },
	);
}
UI.def("characters", {
	dom: true,
	captureKeys: true,
	open() {
		CHAR.preview = CHAR.selected;
		renderCharacters();
	},
	close: closeForm,
	update: updateCharacterPreview,
});
