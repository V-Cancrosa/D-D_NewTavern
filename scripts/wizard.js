import { FORMULA_REFS, OPERATIONS, VALUE_KINDS, ABILITIES, allowedKinds, getSetOptions, getTarget, getTargets }
  from "./catalog.js";
import { DURATION_UNITS, EXPIRY, buildItemData, describeDuration, describeRow, isV14, saveItem } from "./builder.js";
import { readItem } from "./reader.js";
import { PRESETS } from "./presets.js";
import { PL, pl, plOptions } from "./labels.js";

const MODULE_ID = "new-tavern";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ITEM_TYPES = [
  { value: "equipment", label: "Wyposażenie", hint: "pierścienie, płaszcze, różdżki, zbroje" },
  { value: "weapon", label: "Broń", hint: "miecze, łuki, broń +1" },
  { value: "consumable", label: "Materiał eksploatacyjny", hint: "mikstury, zwoje, amunicja" },
  { value: "tool", label: "Narzędzie", hint: "zestawy, instrumenty" },
  { value: "loot", label: "Łup", hint: "skarby, klejnoty – bez użycia" },
  { value: "feat", label: "Cecha / zdolność", hint: "tatuaże, błogosławieństwa, dary" }
];

const INTENTS = [
  { id: "passive", icon: "fa-solid fa-shield-halved", label: "Daje premie, gdy jest noszony",
    hint: "np. +1 KP, odporność na ogień, widzenie w ciemności" },
  { id: "use", icon: "fa-solid fa-hand-sparkles", label: "Można go użyć",
    hint: "leczy, zadaje obrażenia, wymusza rzut obronny" },
  { id: "charges", icon: "fa-solid fa-battery-half", label: "Ma ładunki lub jest jednorazowy",
    hint: "np. 7 ładunków odnawianych o świcie; mikstura znika" },
  { id: "timed", icon: "fa-solid fa-hourglass-half", label: "Po użyciu działa przez jakiś czas",
    hint: "np. szybkość ×2 na 10 minut, Siła 21 na godzinę" }
];

const USAGE_KINDS = [
  { value: "heal", label: "Leczy" },
  { value: "damage", label: "Zadaje obrażenia" },
  { value: "save", label: "Cel wykonuje rzut obronny" },
  { value: "utility", label: "Tylko nakłada efekt" }
];

const STEP_LABELS = {
  start: "Co tworzysz?", basics: "Podstawy", intents: "Co robi ten przedmiot?", effects: "Premie i efekty",
  usage: "Co się dzieje po użyciu?", charges: "Ładunki", done: "Gotowe – tak zobaczy to gracz",
  overview: "Kliknij sekcję, aby ją zmienić"
};

const DICE = [4, 6, 8, 10, 12, 20];

/* -------------------------------------------- */
/*  Stan                                        */
/* -------------------------------------------- */

export function newRow(target = "ac") {
  return { target, op: getTarget(target)?.ops[0] ?? "add", kind: "number", num: 1, count: 1, die: 4,
    ref: "@prof", tags: [] };
}

export function newEffect(name = "Efekt", mode = "passive", rows = [newRow()]) {
  return { id: foundry.utils.randomID(), name, mode, rows, statuses: [],
    duration: { value: mode === "timed" ? 10 : 1, units: "minutes", expiry: "turnStart" } };
}

function defaultState(actor) {
  return {
    step: "start",
    current: 0,
    openRow: 0,
    intents: { passive: false, use: false, charges: false, timed: false },
    item: { name: "", img: "", type: "equipment", subtype: "", rarity: "", attunement: "", magical: false,
      equipped: true, quantity: 1, description: "", magicalBonus: 0, damage: { count: 1, die: 8, type: "slashing" } },
    effects: [],
    usage: { kind: "none", activation: "action", cost: 1, scaling: false,
      heal: { count: 2, die: 4, bonus: "" }, damage: { count: 1, die: 6, bonus: "", type: "fire" },
      save: { ability: "dex", dc: 15, onSave: "half" } },
    uses: { enabled: false, max: 1, recovery: "", formula: "", autoDestroy: false },
    destination: { actorId: actor?.id ?? "", folder: "", openSheet: false },
    preset: null
  };
}

/** Odczytuje zamiary („co robi przedmiot”) z danych. */
function deriveIntents(s) {
  const has = mode => s.effects.some(e => e.mode === mode && (e.rows.length || e.statuses.length));
  s.intents = {
    passive: has("passive"),
    timed: has("timed"),
    use: !["none", "utility"].includes(s.usage.kind),
    charges: !!s.uses.enabled
  };
}

/** Domyślna wartość liczbowa dla celu i działania. */
function defaultNum(t, op) {
  if ( op === "minimum" ) return 10;
  if ( op === "multiply" ) return 2;
  if ( t?.id?.startsWith("sense-") ) return 60;
  if ( t?.unit ) return op === "add" ? 10 : 30;
  if ( t?.id?.startsWith("abl-") && op !== "add" ) return 19;
  return 1;
}

const typeIcon = type => Item.implementation.getDefaultArtwork?.({ type })?.img
  ?? `systems/dnd5e/icons/svg/items/${type === "feat" ? "feature" : type}.svg`;
const activityIcon = kind => `systems/dnd5e/icons/svg/activity/${kind}.svg`;

/* -------------------------------------------- */

export default class NewTavernWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    const item = options.item ?? null;
    const title = item ? `New Tavern · edycja: ${item.name}` : "New Tavern · kreator przedmiotu";
    options = { ...options, window: { ...(options.window ?? {}), title } };
    if ( item ) options.id = `new-tavern-edit-${item.id}`;
    super(options);
    this.item = item;
    if ( item ) {
      this.nt = readItem(item, defaultState(item.parent));
      Object.assign(this.nt, { step: "overview", current: 0, openRow: null, preset: null });
      deriveIntents(this.nt);
    } else this.nt = defaultState(options.actor);
  }

  static DEFAULT_OPTIONS = {
    id: "new-tavern-wizard",
    classes: ["new-tavern", "nt-wizard"],
    tag: "div",
    window: { title: "New Tavern · kreator przedmiotu", icon: "fa-solid fa-wand-magic-sparkles", resizable: true },
    position: { width: 470, height: 780 },
    actions: {
      go: NewTavernWizard.#onGo,
      next: NewTavernWizard.#onNext,
      prev: NewTavernWizard.#onPrev,
      preset: NewTavernWizard.#onPreset,
      itemType: NewTavernWizard.#onItemType,
      intent: NewTavernWizard.#onIntent,
      pickImage: NewTavernWizard.#onPickImage,
      addEffect: NewTavernWizard.#onAddEffect,
      removeEffect: NewTavernWizard.#onRemoveEffect,
      openRow: NewTavernWizard.#onOpenRow,
      addRow: NewTavernWizard.#onAddRow,
      removeRow: NewTavernWizard.#onRemoveRow,
      rowSet: NewTavernWizard.#onRowSet,
      rowStep: NewTavernWizard.#onRowStep,
      toggleTag: NewTavernWizard.#onToggleTag,
      toggleStatus: NewTavernWizard.#onToggleStatus,
      usageKind: NewTavernWizard.#onUsageKind,
      chargesPreset: NewTavernWizard.#onChargesPreset,
      create: NewTavernWizard.#onCreate,
      openSheet: NewTavernWizard.#onOpenSheet
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/wizard.hbs`, scrollable: [".nt-scroll"] }
  };

  /* -------------------------------------------- */
  /*  Kroki i stan                                */
  /* -------------------------------------------- */

  get editing() {
    return !!this.item;
  }

  /** Kroki widoczne dla obecnych zamiarów. */
  get steps() {
    const { intents, item } = this.nt;
    const steps = ["start", "basics", "intents"];
    if ( intents.passive || intents.timed ) steps.push("effects");
    if ( item.type !== "loot" && (intents.use || intents.timed) ) steps.push("usage");
    if ( item.type !== "loot" && intents.charges ) steps.push("charges");
    steps.push("done");
    return steps;
  }

  /** Efekty widoczne w kroku „Premie i efekty” (zgodne z zamiarami). */
  get visibleEffects() {
    const { intents, effects } = this.nt;
    return effects.filter(e => (e.mode === "passive" ? intents.passive : intents.timed));
  }

  get effect() {
    const list = this.visibleEffects;
    return list[Math.clamp(this.nt.current, 0, Math.max(list.length - 1, 0))] ?? null;
  }

  /** Stan „do zapisu”: pomija to, co MG wyłączył w kroku „Co robi ten przedmiot?”. */
  effectiveState() {
    const s = foundry.utils.deepClone(this.nt);
    s.effects = this.visibleEffects.map(e => foundry.utils.deepClone(e));
    const loot = s.item.type === "loot";
    if ( loot || (!s.intents.use && !s.intents.timed) ) s.usage.kind = "none";
    else if ( !s.intents.use ) s.usage.kind = "utility";
    if ( loot || !s.intents.charges ) s.uses.enabled = false;
    s.editing = this.nt.editing;
    return s;
  }

  /** Dba o spójność danych z zamiarami. */
  #ensureIntentData() {
    const s = this.nt;
    for ( const mode of ["passive", "timed"] ) {
      if ( s.intents[mode] && !s.effects.some(e => e.mode === mode) ) {
        s.effects.push(newEffect(mode === "timed" ? "Efekt czasowy" : "Efekt", mode));
      }
    }
    if ( s.intents.use && ["none", "utility"].includes(s.usage.kind) ) s.usage.kind = "heal";
    if ( !s.intents.use && s.intents.timed ) s.usage.kind = "utility";
    s.uses.enabled = s.intents.charges;
  }

  #sanitize() {
    for ( const e of this.nt.effects ) for ( const r of e.rows ) {
      const t = getTarget(r.target);
      if ( !t ) continue;
      if ( !t.ops.includes(r.op) ) r.op = t.ops[0];
      const kinds = allowedKinds(t, r.op);
      if ( kinds.length && !kinds.includes(r.kind) ) r.kind = kinds[0];
    }
  }

  /* -------------------------------------------- */
  /*  Renderowanie                                */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    this.#sanitize();
    const s = this.nt;
    const D = CONFIG.DND5E;
    const steps = this.steps;
    if ( !steps.includes(s.step) && (s.step !== "overview") ) s.step = steps.at(-1);
    const index = steps.indexOf(s.step);

    const subtypeSource = { equipment: D.equipmentTypes, weapon: D.weaponTypes, consumable: D.consumableTypes,
      tool: D.toolTypes, loot: D.lootTypes }[s.item.type];
    const ctx = {
      s, editing: this.editing,
      step: s.step, stepLabel: STEP_LABELS[s.step],
      is: Object.fromEntries([...Object.keys(STEP_LABELS)].map(k => [k, s.step === k])),
      dots: this.editing ? [] : steps.map((st, i) => ({ cls: i < index ? "done" : i === index ? "on" : "" })),
      isFirst: index === 0, isLast: s.step === "done",
      name: s.item.name || "Nowy przedmiot",
      img: s.item.img || typeIcon(s.item.type),
      typeLabel: ITEM_TYPES.find(t => t.value === s.item.type)?.label ?? s.item.type
    };

    // 1. Co tworzysz?
    ctx.itemTypes = ITEM_TYPES.map(t => ({ ...t, icon: typeIcon(t.value), active: t.value === s.item.type }));
    ctx.presets = PRESETS.filter(p => p.item.type === s.item.type)
      .map(p => ({ ...p, active: p.id === s.preset }));
    ctx.folders = game.folders.filter(f => f.type === "Item")
      .map(f => ({ id: f.id, name: f.name, selected: f.id === s.destination.folder }));
    ctx.showFolder = !this.editing && !s.destination.actorId && ctx.folders.length;

    // 2. Podstawy
    ctx.subtypes = plOptions("subtypes", subtypeSource, s.item.subtype)
      .filter(o => !["sim", "mar", "lgt", "med", "hvy", "shl", "cleave"].includes(o.value));
    ctx.rarities = plOptions("rarity", D.itemRarity, s.item.rarity);
    ctx.attunements = plOptions("attunement", D.attunementTypes, s.item.attunement);
    ctx.dieOptions = d => DICE.map(x => ({ value: x, label: `k${x}`, selected: x === Number(d) }));
    ctx.weaponDice = ctx.dieOptions(s.item.damage.die);
    ctx.weaponDamageTypes = plOptions("damage", D.damageTypes, s.item.damage.type);
    ctx.isWeapon = s.item.type === "weapon";
    ctx.isArmor = s.item.type === "equipment" && ["light", "medium", "heavy", "shield", "natural"].includes(s.item.subtype);
    ctx.hasMagicalBonus = ctx.isWeapon || ctx.isArmor;

    // 3. Zamiary
    const loot = s.item.type === "loot";
    ctx.intents = INTENTS.map(i => ({ ...i, active: s.intents[i.id],
      disabled: loot && ["use", "charges", "timed"].includes(i.id) }));
    ctx.isLoot = loot;
    ctx.plannedSteps = steps.filter(st => ["effects", "usage", "charges"].includes(st)).map(st => STEP_LABELS[st]);

    // 4. Efekty
    const vis = this.visibleEffects;
    const effect = this.effect;
    ctx.effect = effect;
    ctx.effects = vis.map((e, i) => ({ index: i, name: e.name || "Efekt", selected: e === effect }));
    ctx.effectModes = [
      { value: "passive", label: "Stale, gdy założony", selected: effect?.mode === "passive", disabled: !s.intents.passive },
      { value: "timed", label: "Przez czas po użyciu", selected: effect?.mode === "timed", disabled: !s.intents.timed }
    ];
    ctx.timed = effect?.mode === "timed";
    ctx.v14 = isV14();
    ctx.durationUnits = Object.entries(DURATION_UNITS)
      .map(([value, u]) => ({ value, label: u.label, selected: value === effect?.duration.units }));
    ctx.expiries = Object.entries(EXPIRY)
      .map(([value, e]) => ({ value, label: e.label, selected: value === effect?.duration.expiry }));
    ctx.showDurationValue = !(ctx.v14 && EXPIRY[effect?.duration.expiry]?.durationless);
    ctx.effectIndex = effect ? s.effects.indexOf(effect) : 0;
    ctx.rows = this.#prepareRows(effect);
    const statuses = (CONFIG.statusEffects ?? []).filter(se => se.id && (se.name ?? se.label));
    ctx.statuses = statuses.map(se => ({ id: se.id, label: PL.statuses[se.id] ?? PL.conditions[se.id]
      ?? game.i18n.localize(se.name ?? se.label), active: effect?.statuses.includes(se.id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));
    ctx.statusText = effect?.statuses.length
      ? effect.statuses.map(id => ctx.statuses.find(x => x.id === id)?.label ?? id).join(", ") : "brak";

    // 5. Użycie
    const u = s.usage;
    ctx.usageKinds = USAGE_KINDS.filter(k => s.intents.use || k.value === "utility")
      .map(k => ({ ...k, icon: activityIcon(k.value), active: k.value === u.kind }));
    ctx.onlyUtility = !s.intents.use;
    ctx.u = { heal: u.kind === "heal", damage: u.kind === "damage" || u.kind === "save", save: u.kind === "save",
      utility: u.kind === "utility" };
    ctx.healDice = ctx.dieOptions(u.heal.die);
    ctx.damageDice = ctx.dieOptions(u.damage.die);
    ctx.usageDamageTypes = plOptions("damage", D.damageTypes, u.damage.type)
      .filter(o => !["healing", "temphp"].includes(o.value));
    ctx.activations = ["action", "bonus", "reaction", "minute", "hour", "special"]
      .map(v => ({ value: v, label: PL.activation[v], selected: v === u.activation }));
    ctx.abilities = ABILITIES.map(a => ({ value: a, label: PL.abilities[a], selected: a === u.save.ability }));
    ctx.onSaveHalf = u.save.onSave === "half";
    ctx.hasCharges = s.intents.charges && !loot;

    // 6. Ładunki
    ctx.periods = ["dawn", "lr", "sr", "day", "dusk"]
      .map(v => ({ value: v, label: PL.periods[v], selected: v === s.uses.recovery }));
    ctx.chargeDots = Array.from({ length: Math.clamp(Number(s.uses.max) || 0, 0, 20) });
    ctx.isConsumable = s.item.type === "consumable";

    // 7. Gotowe / przegląd
    const tags = [pl("rarity", s.item.rarity, "")];
    if ( s.item.attunement === "required" ) tags.push("wymaga dostrojenia");
    if ( s.item.magical || Number(s.item.magicalBonus) ) tags.push("magiczny");
    ctx.tags = tags.filter(Boolean);
    ctx.subtypeLabel = s.item.subtype ? pl("subtypes", s.item.subtype, subtypeSource?.[s.item.subtype]) : "";
    ctx.summary = this.#summary();
    ctx.actors = game.actors.filter(a => ["character", "npc"].includes(a.type))
      .map(a => ({ id: a.id, name: a.name, selected: a.id === s.destination.actorId }));
    ctx.selectedActor = game.actors.get(s.destination.actorId)?.name ?? "";
    ctx.ownerName = this.item?.parent?.name ?? "";
    ctx.overview = this.#overview();
    return ctx;
  }

  #prepareRows(effect) {
    const targets = getTargets();
    const groups = [...new Set(targets.map(t => t.group))];
    return (effect?.rows ?? []).map((r, index) => {
      const open = index === this.nt.openRow;
      if ( r.raw ) return { index, isRaw: true, sentence: describeRow(r), open };
      const t = getTarget(r.target);
      const kinds = allowedKinds(t, r.op);
      const value = r.op === "grant" ? `${r.tags.length}`
        : ["advantage", "disadvantage"].includes(r.op) ? "✓"
          : r.kind === "dice" ? `+${r.count}k${r.die}`
            : r.kind === "formula" ? "@" : `${["add", "bonus"].includes(r.op) && r.num >= 0 ? "+" : ""}${r.num}`;
      return {
        ...r, index, open, label: t?.label ?? "—", opLabel: OPERATIONS[r.op]?.label ?? r.op, value,
        groups: open ? groups.map(g => ({ label: g, options: targets.filter(x => x.group === g)
          .map(x => ({ value: x.id, label: x.label, selected: x.id === r.target })) })) : [],
        ops: (t?.ops ?? []).map(o => ({ value: o, label: OPERATIONS[o].label, active: o === r.op })),
        kinds: kinds.map(k => ({ value: k, label: VALUE_KINDS[k], active: k === r.kind })),
        showKinds: kinds.length > 1,
        isNumber: kinds.length > 0 && r.kind === "number",
        isDice: r.kind === "dice" && kinds.includes("dice"),
        isFormula: r.kind === "formula" && kinds.includes("formula"),
        isSet: t?.cls === "set",
        dice: DICE.map(d => ({ value: d, label: `k${d}`, active: d === r.die })),
        refs: FORMULA_REFS.map(f => ({ ...f, active: f.value === r.ref })),
        tags: t?.cls === "set" ? getSetOptions(t.options).map(o => ({ ...o, active: r.tags.includes(o.value) })) : [],
        sentence: describeRow(r)
      };
    });
  }

  /** Linie podglądu „jak zobaczy to gracz”. */
  #summary() {
    const s = this.effectiveState();
    const lines = [];
    for ( const e of s.effects ) {
      const rows = e.rows.map(describeRow);
      if ( !rows.length && !e.statuses.length ) continue;
      lines.push({ label: e.mode === "timed" ? `${e.name} (${describeDuration(e)})` : `${e.name} (stale)`,
        text: [...rows, ...(e.statuses.length ? [`Stany: ${e.statuses.map(id => PL.statuses[id] ?? PL.conditions[id] ?? id).join(", ")}.`] : [])].join(" ") });
    }
    const u = s.usage;
    const dice = d => `${d.count}k${d.die}${d.bonus ? ` + ${d.bonus}` : ""}`;
    const cost = s.uses.enabled ? ` Zużywa ${u.cost} ład.${u.scaling ? "; każdy dodatkowy wzmacnia efekt." : ""}` : "";
    const act = PL.activation[u.activation] ?? u.activation;
    if ( u.kind === "heal" ) lines.push({ label: act, text: `Leczy ${dice(u.heal)} PW.${cost}`, step: "usage" });
    if ( u.kind === "damage" ) lines.push({ label: act, text: `Zadaje ${dice(u.damage)} obrażeń (${pl("damage", u.damage.type)}).${cost}`, step: "usage" });
    if ( u.kind === "save" ) lines.push({ label: act, text: `Rzut obronny: ${PL.abilities[u.save.ability]}, ST ${u.save.dc}.${Number(u.damage.count) ? ` ${dice(u.damage)} obrażeń, ${u.save.onSave === "half" ? "połowa" : "nic"} przy sukcesie.` : ""}${cost}`, step: "usage" });
    if ( u.kind === "utility" ) lines.push({ label: act, text: `Nakłada efekty czasowe.${cost}`, step: "usage" });
    if ( s.uses.enabled ) {
      const back = s.uses.recovery ? `, odnawia ${s.uses.formula || "wszystkie"} ${PL.periods[s.uses.recovery] ?? ""}` : "";
      lines.push({ label: "Ładunki", text: `${s.uses.max}${back}.${s.uses.autoDestroy ? " Znika po zużyciu." : ""}`, step: "charges" });
    }
    for ( const l of lines ) l.step ??= "effects";
    return lines;
  }

  /** Sekcje ekranu „Przegląd” (tryb edycji). */
  #overview() {
    const s = this.effectiveState();
    const subtype = s.item.subtype ? pl("subtypes", s.item.subtype) : "";
    const basics = [ITEM_TYPES.find(t => t.value === s.item.type)?.label, subtype, pl("rarity", s.item.rarity, ""),
      s.item.attunement === "required" ? "wymaga dostrojenia" : ""].filter(Boolean).join(" · ");
    const eff = s.effects.filter(e => e.rows.length || e.statuses.length)
      .map(e => `${e.name}: ${e.rows.map(r => describeRow(r).replace(/\.$/, "")).join(" · ")}`).join(" | ");
    const sum = this.#summary();
    return [
      { step: "basics", icon: "fa-solid fa-ring", label: "Podstawy", hint: basics, empty: false },
      { step: "intents", icon: "fa-solid fa-list-check", label: "Co robi ten przedmiot?",
        hint: INTENTS.filter(i => s.intents[i.id]).map(i => i.label.toLowerCase()).join(", ") || "nic nie wybrano" },
      { step: "effects", icon: "fa-solid fa-shield-halved", label: "Premie i efekty", hint: eff || "brak",
        empty: !eff, intent: "passive" },
      { step: "usage", icon: "fa-solid fa-hand-sparkles", label: "Użycie",
        hint: sum.find(l => l.step === "usage")?.text ?? "brak – przedmiot się tylko nosi",
        empty: s.usage.kind === "none", intent: "use" },
      { step: "charges", icon: "fa-solid fa-battery-half", label: "Ładunki",
        hint: sum.find(l => l.step === "charges")?.text ?? "brak", empty: !s.uses.enabled, intent: "charges" }
    ];
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);
    this.element.addEventListener("change", this.#onChangeField.bind(this));
  }

  #onChangeField(event) {
    const el = event.target;
    const path = el.dataset?.field;
    if ( !path ) return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if ( el.dataset.dtype === "Number" ) value = Number(value) || 0;
    if ( path === "current" ) {
      this.nt.current = Number(value);
      this.nt.openRow = null;
      return this.render();
    }
    if ( path === "effectMode" ) {
      const e = this.effect;
      if ( e ) e.mode = value;
      this.nt.intents[value] = true;
      this.#ensureIntentData();
      this.nt.current = this.visibleEffects.indexOf(e);
      return this.render();
    }
    foundry.utils.setProperty(this.nt, path, value);
    if ( path.endsWith(".target") ) {
      const row = foundry.utils.getProperty(this.nt, path.replace(/\.target$/, ""));
      const t = getTarget(value);
      Object.assign(row, { op: t.ops[0], kind: "number", tags: [], num: defaultNum(t, t.ops[0]), count: 1 });
    }
    if ( path === "item.type" ) this.nt.item.subtype = "";
    if ( (el.tagName === "TEXTAREA") || (el.type === "text") ) {
      if ( path === "item.name" ) this.element.querySelectorAll(".nt-name").forEach(n => n.textContent = value);
      return;
    }
    this.render();
  }

  #row(target) {
    return this.effect?.rows[Number(target.closest("[data-row]")?.dataset.row)];
  }

  /* -------------------------------------------- */
  /*  Akcje                                       */
  /* -------------------------------------------- */

  static #onGo(event, target) {
    const step = target.dataset.step;
    const intent = target.dataset.intent;
    if ( intent && !this.nt.intents[intent] ) {
      this.nt.intents[intent] = true;
      this.#ensureIntentData();
    }
    this.nt.step = step;
    this.nt.openRow = null;
    this.render();
  }

  static #onNext() {
    const steps = this.steps;
    this.nt.step = steps[Math.min(steps.indexOf(this.nt.step) + 1, steps.length - 1)];
    this.render();
  }

  static #onPrev() {
    if ( this.editing ) this.nt.step = "overview";
    else {
      const steps = this.steps;
      this.nt.step = steps[Math.max(steps.indexOf(this.nt.step) - 1, 0)];
    }
    this.render();
  }

  static #onPreset(event, target) {
    const p = PRESETS.find(x => x.id === target.dataset.preset);
    if ( !p ) return;
    const base = defaultState();
    const s = this.nt;
    s.item = foundry.utils.mergeObject(base.item, foundry.utils.deepClone(p.item));
    s.effects = foundry.utils.deepClone(p.effects).map(e => ({ ...e, id: foundry.utils.randomID() }));
    s.usage = foundry.utils.mergeObject(base.usage, foundry.utils.deepClone(p.usage ?? {}));
    s.uses = foundry.utils.mergeObject(base.uses, foundry.utils.deepClone(p.uses ?? {}));
    s.current = 0;
    s.openRow = null;
    s.preset = p.id;
    deriveIntents(s);
    this.render();
  }

  static #onItemType(event, target) {
    this.nt.item.type = target.dataset.value;
    this.nt.item.subtype = "";
    this.nt.preset = null;
    this.render();
  }

  static #onIntent(event, target) {
    const id = target.dataset.value;
    if ( target.disabled ) return;
    this.nt.intents[id] = !this.nt.intents[id];
    this.#ensureIntentData();
    this.render();
  }

  static #onPickImage() {
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "image", current: this.nt.item.img, callback: path => {
      this.nt.item.img = path;
      this.render();
    } }).render(true);
  }

  /** Rodzaj nowego efektu: zgodny z zaznaczonymi zamiarami (domyślnie stały). */
  #newEffectMode() {
    const { intents } = this.nt;
    const mode = intents.passive || !intents.timed ? "passive" : "timed";
    intents[mode] = true;
    return mode;
  }

  static #onAddEffect() {
    const mode = this.#newEffectMode();
    this.nt.effects.push(newEffect(`Efekt ${this.visibleEffects.length + 1}`, mode));
    this.nt.current = this.visibleEffects.length - 1;
    this.nt.openRow = 0;
    this.render();
  }

  static #onRemoveEffect() {
    const e = this.effect;
    if ( !e ) return;
    this.nt.effects.splice(this.nt.effects.indexOf(e), 1);
    this.nt.current = 0;
    this.render();
  }

  static #onOpenRow(event, target) {
    const i = Number(target.closest("[data-row]").dataset.row);
    this.nt.openRow = this.nt.openRow === i ? null : i;
    this.render();
  }

  static #onAddRow() {
    if ( !this.effect ) {
      this.nt.effects.push(newEffect("Efekt", this.#newEffectMode(), []));
      this.nt.current = this.visibleEffects.length - 1;
    }
    this.effect.rows.push(newRow("init"));
    this.nt.openRow = this.effect.rows.length - 1;
    this.render();
  }

  static #onRemoveRow(event, target) {
    this.effect?.rows.splice(Number(target.closest("[data-row]").dataset.row), 1);
    this.nt.openRow = null;
    this.render();
  }

  static #onRowSet(event, target) {
    const row = this.#row(target);
    if ( !row ) return;
    const { key, value } = target.dataset;
    row[key] = key === "die" ? Number(value) : value;
    if ( key === "op" ) row.num = defaultNum(getTarget(row.target), value);
    this.render();
  }

  static #onRowStep(event, target) {
    const row = this.#row(target);
    if ( !row ) return;
    const dir = Number(target.dataset.dir);
    const t = getTarget(row.target);
    if ( row.kind === "dice" ) row.count = Math.clamp(row.count + dir, 1, 20);
    else {
      const step = t?.unit && row.op !== "multiply" ? 5 : 1;
      row.num += dir * step;
      if ( row.op === "minimum" ) row.num = Math.clamp(row.num, 1, 20);
      if ( row.op === "multiply" ) row.num = Math.max(row.num, 0);
    }
    this.render();
  }

  static #onToggleTag(event, target) {
    const row = this.#row(target);
    if ( !row ) return;
    const v = target.dataset.value;
    row.tags = row.tags.includes(v) ? row.tags.filter(x => x !== v) : [...row.tags, v];
    this.render();
  }

  static #onToggleStatus(event, target) {
    const e = this.effect;
    if ( !e ) return;
    const v = target.dataset.value;
    e.statuses = e.statuses.includes(v) ? e.statuses.filter(x => x !== v) : [...e.statuses, v];
    this.render();
  }

  static #onUsageKind(event, target) {
    this.nt.usage.kind = target.dataset.value;
    this.render();
  }

  static #onChargesPreset(event, target) {
    const presets = {
      once: { max: 1, recovery: "", formula: "", autoDestroy: true },
      long3: { max: 3, recovery: "lr", formula: "", autoDestroy: false },
      day1: { max: 1, recovery: "dawn", formula: "", autoDestroy: false }
    };
    Object.assign(this.nt.uses, presets[target.dataset.value] ?? {});
    this.render();
  }

  static #onOpenSheet() {
    this.item?.sheet.render(true);
  }

  static async #onCreate() {
    if ( !game.user.isGM ) return ui.notifications.warn("Tylko MG może tworzyć i edytować przedmioty w New Tavern.");
    const s = this.effectiveState();
    if ( !s.item.name?.trim() ) {
      this.nt.step = this.editing ? "overview" : "start";
      this.render();
      return ui.notifications.warn("Podaj nazwę przedmiotu.");
    }
    if ( this.item ) {
      try {
        await saveItem(this.item, s);
        ui.notifications.info(`Zapisano zmiany w „${this.item.name}”.`);
        this.close();
      } catch(err) {
        console.error(`${MODULE_ID} |`, err, s);
        ui.notifications.error(`New Tavern: nie udało się zapisać przedmiotu: ${err.message}`);
      }
      return;
    }
    const actor = game.actors.get(s.destination.actorId) ?? null;
    const data = buildItemData(s, { forActor: !!actor });
    try {
      let item;
      if ( actor ) [item] = await actor.createEmbeddedDocuments("Item", [data]);
      else item = await Item.implementation.create({ ...data, folder: s.destination.folder || null });
      ui.notifications.info(actor ? `Dodano „${item.name}” do karty: ${actor.name}.`
        : `Utworzono „${item.name}” w katalogu przedmiotów.`);
      if ( s.destination.openSheet ) item.sheet.render(true);
      this.close();
    } catch(err) {
      console.error(`${MODULE_ID} |`, err, data);
      ui.notifications.error(`New Tavern: nie udało się utworzyć przedmiotu: ${err.message}`);
    }
  }
}
