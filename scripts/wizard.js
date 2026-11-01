import { ABILITIES, FORMULA_REFS, OPERATIONS, VALUE_KINDS, allowedKinds, getSetOptions, getTarget, getTargets }
  from "./catalog.js";
import { DURATION_UNITS, EXPIRY, buildItemData, describeDuration, describeRow, isV14, rowToChanges, saveItem }
  from "./builder.js";
import { readItem } from "./reader.js";
import { PRESETS } from "./presets.js";

const MODULE_ID = "new-tavern";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STEPS = [
  { id: 1, label: "Przedmiot" },
  { id: 2, label: "Efekty" },
  { id: 3, label: "Użycie i ładunki" },
  { id: 4, label: "Podsumowanie" }
];

const ITEM_TYPES = [
  { value: "equipment", label: "Wyposażenie" },
  { value: "weapon", label: "Broń" },
  { value: "consumable", label: "Materiał eksploatacyjny" },
  { value: "tool", label: "Narzędzie" },
  { value: "loot", label: "Łup" },
  { value: "feat", label: "Cecha / zdolność" }
];

const USAGE_KINDS = [
  { value: "none", label: "Brak", hint: "przedmiot się tylko nosi" },
  { value: "utility", label: "Nakłada efekt", hint: "np. buty, mikstura" },
  { value: "heal", label: "Leczenie", hint: "przywraca PW" },
  { value: "damage", label: "Obrażenia", hint: "rzut obrażeń" },
  { value: "save", label: "Rzut obronny", hint: "cel rzuca przeciw ST" }
];

const DICE = [4, 6, 8, 10, 12, 20];

/* -------------------------------------------- */

const loc = v => game.i18n.localize(typeof v === "string" ? v : (v?.label ?? ""));
const options = (obj, selected) => Object.entries(obj ?? {})
  .map(([value, cfg]) => ({ value, label: loc(cfg), selected: value === selected }));

export function newRow(target = "ac") {
  return { target, op: getTarget(target)?.ops[0] ?? "add", kind: "number", num: 1, count: 1, die: 4,
    ref: "@prof", tags: [] };
}

export function newEffect(name = "Efekt", rows = [newRow()]) {
  return { id: foundry.utils.randomID(), name, mode: "passive", rows, statuses: [],
    duration: { value: 1, units: "minutes", expiry: "turnStart" } };
}

function defaultState(actor) {
  return {
    step: 1,
    current: 0,
    item: { name: "", img: "", type: "equipment", subtype: "", rarity: "", attunement: "", magical: false,
      equipped: true, quantity: 1, description: "", magicalBonus: 0, damage: { count: 1, die: 8, type: "slashing" } },
    effects: [newEffect("Efekt", [])],
    usage: { kind: "none", activation: "action", cost: 1, scaling: false,
      heal: { count: 2, die: 4, bonus: "" }, damage: { count: 1, die: 6, bonus: "", type: "fire" },
      save: { ability: "dex", dc: 15, onSave: "half" } },
    uses: { enabled: false, max: 1, recovery: "", formula: "", autoDestroy: false },
    destination: { actorId: actor?.id ?? "", folder: "", openSheet: false }
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

/* -------------------------------------------- */

export default class NewTavernWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    const item = options.item ?? null;
    if ( item ) options = { ...options, id: `new-tavern-edit-${item.id}` };
    super(options);
    this.item = item;
    if ( item ) {
      this.state = readItem(item, defaultState(item.parent));
      this.state.step = 2;
    } else this.state = defaultState(options.actor);
  }

  /** @override */
  get title() {
    return this.item ? `New Tavern · edycja: ${this.item.name}` : "New Tavern · kreator przedmiotu";
  }

  static DEFAULT_OPTIONS = {
    id: "new-tavern-wizard",
    classes: ["new-tavern", "nt-wizard"],
    tag: "div",
    window: { title: "New Tavern · kreator przedmiotu", icon: "fa-solid fa-wand-magic-sparkles", resizable: true },
    position: { width: 1120, height: 780 },
    actions: {
      step: NewTavernWizard.#onStep,
      next: NewTavernWizard.#onNext,
      prev: NewTavernWizard.#onPrev,
      preset: NewTavernWizard.#onPreset,
      itemType: NewTavernWizard.#onItemType,
      pickImage: NewTavernWizard.#onPickImage,
      selectEffect: NewTavernWizard.#onSelectEffect,
      addEffect: NewTavernWizard.#onAddEffect,
      removeEffect: NewTavernWizard.#onRemoveEffect,
      effectMode: NewTavernWizard.#onEffectMode,
      addRow: NewTavernWizard.#onAddRow,
      removeRow: NewTavernWizard.#onRemoveRow,
      rowSet: NewTavernWizard.#onRowSet,
      rowStep: NewTavernWizard.#onRowStep,
      toggleTag: NewTavernWizard.#onToggleTag,
      toggleStatus: NewTavernWizard.#onToggleStatus,
      usageKind: NewTavernWizard.#onUsageKind,
      create: NewTavernWizard.#onCreate,
      openSheet: NewTavernWizard.#onOpenSheet
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/wizard.hbs`, scrollable: [".nt-main", ".nt-aside"] }
  };

  /* -------------------------------------------- */
  /*  Pomocnicze                                  */
  /* -------------------------------------------- */

  get effect() {
    return this.state.effects[this.state.current] ?? null;
  }

  /** Doprowadza wiersze do poprawnego stanu po zmianach. */
  #sanitize() {
    for ( const e of this.state.effects ) for ( const r of e.rows ) {
      const t = getTarget(r.target);
      if ( !t ) continue;
      if ( !t.ops.includes(r.op) ) r.op = t.ops[0];
      const kinds = allowedKinds(t, r.op);
      if ( kinds.length && !kinds.includes(r.kind) ) r.kind = kinds[0];
    }
    this.state.current = Math.clamp(this.state.current, 0, Math.max(this.state.effects.length - 1, 0));
  }

  /* -------------------------------------------- */
  /*  Renderowanie                                */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext() {
    this.#sanitize();
    const s = this.state;
    const D = CONFIG.DND5E;
    const v14 = isV14();

    const subtypeSource = { equipment: D.equipmentTypes, weapon: D.weaponTypes, consumable: D.consumableTypes,
      tool: D.toolTypes, loot: D.lootTypes }[s.item.type];

    const targets = getTargets();
    const groups = [...new Set(targets.map(t => t.group))];
    const statuses = (CONFIG.statusEffects ?? []).filter(se => se.id && (se.name ?? se.label))
      .map(se => ({ id: se.id, label: loc(se.name ?? se.label), active: this.effect?.statuses.includes(se.id) }));

    const effect = this.effect;
    const rows = (effect?.rows ?? []).map((r, index) => {
      if ( r.raw ) return { index, isRaw: true, sentence: describeRow(r), groups: [], ops: [], kinds: [], dice: [],
        refs: [], tags: [], tech: rowToChanges(r).map(c => `${c.key} · ${c.type ?? c.mode} · ${c.value}`) };
      const t = getTarget(r.target);
      const kinds = allowedKinds(t, r.op);
      return {
        ...r, index,
        groups: groups.map(g => ({ label: g, options: targets.filter(x => x.group === g)
          .map(x => ({ value: x.id, label: x.label, selected: x.id === r.target })) })),
        ops: (t?.ops ?? []).map(o => ({ value: o, label: OPERATIONS[o].label, active: o === r.op })),
        kinds: kinds.map(k => ({ value: k, label: VALUE_KINDS[k], active: k === r.kind })),
        showKinds: kinds.length > 1,
        isNumber: kinds.length > 0 && r.kind === "number",
        isDice: r.kind === "dice" && kinds.includes("dice"),
        isFormula: r.kind === "formula" && kinds.includes("formula"),
        isSet: t?.cls === "set",
        numText: (["add", "bonus"].includes(r.op) && r.num >= 0 ? "+" : "") + r.num + (t?.unit ? ` ${t.unit}` : ""),
        dice: DICE.map(d => ({ value: d, label: `k${d}`, active: d === r.die })),
        refs: FORMULA_REFS.map(f => ({ ...f, active: f.value === r.ref })),
        tags: t?.cls === "set" ? getSetOptions(t.options).map(o => ({ ...o, active: r.tags.includes(o.value) })) : [],
        sentence: describeRow(r),
        tech: rowToChanges(r).map(c => `${c.key} · ${c.type ?? c.mode} · ${c.value}`)
      };
    });

    const actors = game.actors.filter(a => ["character", "npc"].includes(a.type))
      .map(a => ({ id: a.id, name: a.name, selected: a.id === s.destination.actorId }));
    const folders = game.folders.filter(f => f.type === "Item")
      .map(f => ({ id: f.id, name: f.name, selected: f.id === s.destination.folder }));

    const usage = s.usage;
    const activationTypes = Object.entries(D.activityActivationTypes ?? D.abilityActivationTypes ?? {})
      .filter(([k]) => ["action", "bonus", "reaction", "minute", "hour", "special"].includes(k))
      .map(([value, cfg]) => ({ value, label: loc(cfg), selected: value === usage.activation }));
    const periods = Object.entries(D.limitedUsePeriods ?? {})
      .filter(([k]) => ["lr", "sr", "day", "dawn", "dusk"].includes(k))
      .map(([value, cfg]) => ({ value, label: loc(cfg), selected: value === s.uses.recovery }));

    const summary = s.effects.map(e => ({
      name: e.name, duration: describeDuration(e),
      lines: e.rows.map(describeRow),
      statuses: e.statuses.map(id => loc(CONFIG.statusEffects.find(se => se.id === id)?.name ?? id))
    })).filter(e => e.lines.length || e.statuses.length);

    return {
      state: s,
      v14,
      steps: STEPS.map(st => ({ ...st, active: st.id === s.step, done: st.id < s.step })),
      step1: s.step === 1, step2: s.step === 2, step3: s.step === 3, step4: s.step === 4,
      isLast: s.step === 4, isFirst: s.step === 1,
      presets: PRESETS,
      itemTypes: ITEM_TYPES.map(t => ({ ...t, active: t.value === s.item.type })),
      subtypes: options(subtypeSource, s.item.subtype),
      hasSubtypes: !!subtypeSource && Object.keys(subtypeSource).length > 0,
      rarities: options(D.itemRarity, s.item.rarity),
      attunements: options(D.attunementTypes, s.item.attunement),
      damageTypes: options(D.damageTypes, null),
      weaponDamageTypes: options(D.damageTypes, s.item.damage.type),
      usageDamageTypes: options(D.damageTypes, usage.damage.type),
      dieOptions: DICE.map(d => ({ value: d, label: `k${d}` })),
      isWeapon: s.item.type === "weapon",
      hasMagicalBonus: ["weapon", "equipment", "consumable"].includes(s.item.type),
      isConsumable: s.item.type === "consumable",
      isLoot: s.item.type === "loot",
      img: s.item.img || Item.implementation.getDefaultArtwork?.({ type: s.item.type })?.img || "icons/svg/item-bag.svg",
      effects: s.effects.map((e, i) => ({ index: i, name: e.name || "Efekt", active: i === s.current })),
      effect, rows, statuses,
      timed: effect?.mode === "timed",
      durationUnits: Object.entries(DURATION_UNITS)
        .map(([value, u]) => ({ value, label: u.label, selected: value === effect?.duration.units })),
      expiries: Object.entries(EXPIRY)
        .map(([value, e]) => ({ value, label: e.label, selected: value === effect?.duration.expiry })),
      showDurationValue: !(v14 && EXPIRY[effect?.duration.expiry]?.durationless),
      durationText: effect ? describeDuration(effect) : "",
      usageKinds: USAGE_KINDS.map(k => ({ ...k, active: k.value === usage.kind })),
      usageHeal: usage.kind === "heal", usageDamage: usage.kind === "damage", usageSave: usage.kind === "save",
      usageAny: usage.kind !== "none",
      usageHasDamage: ["damage", "save"].includes(usage.kind),
      activationTypes, periods,
      abilities: ABILITIES.map(a => ({ value: a, label: loc(D.abilities[a]), selected: a === usage.save.ability })),
      onSaveHalf: usage.save.onSave === "half",
      actors, folders,
      toWorld: !s.destination.actorId,
      summary,
      usageSummary: this.#describeUsage(),
      selectedActor: game.actors.get(s.destination.actorId)?.name ?? "",
      editing: !!this.item,
      ownerName: this.item?.parent?.name ?? "",
      otherActivities: s.editing?.otherActivities ?? 0
    };
  }

  #describeUsage() {
    const { usage: u, uses } = this.state;
    const dice = d => `${d.count}k${d.die}${d.bonus ? ` + ${d.bonus}` : ""}`;
    const parts = [];
    if ( u.kind === "heal" ) parts.push(`Leczy ${dice(u.heal)} PW.`);
    if ( u.kind === "damage" ) parts.push(`Zadaje ${dice(u.damage)} obrażeń.`);
    if ( u.kind === "save" ) parts.push(`Cel wykonuje rzut obronny ${u.save.ability.toUpperCase()} ST ${u.save.dc}.`);
    if ( u.kind === "utility" ) parts.push("Po użyciu nakłada efekty czasowe.");
    if ( uses.enabled ) {
      const period = loc(CONFIG.DND5E.limitedUsePeriods?.[uses.recovery]) || "";
      parts.push(`Ładunki: ${uses.max}${uses.recovery ? `, odnawia ${uses.formula || "wszystkie"} (${period})` : ""}.`);
      if ( uses.autoDestroy ) parts.push("Znika po zużyciu.");
    }
    return parts;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);
    this.element.addEventListener("change", this.#onChangeField.bind(this));
  }

  /** Obsługa pól formularza oznaczonych `data-field`. */
  #onChangeField(event) {
    const el = event.target;
    const path = el.dataset?.field;
    if ( !path ) return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if ( el.dataset.dtype === "Number" ) value = Number(value) || 0;
    foundry.utils.setProperty(this.state, path, value);
    if ( path.endsWith(".target") ) {
      const row = foundry.utils.getProperty(this.state, path.replace(/\.target$/, ""));
      const t = getTarget(value);
      Object.assign(row, { op: t.ops[0], kind: "number", tags: [], num: defaultNum(t, t.ops[0]), count: 1 });
    }
    if ( path === "item.type" ) this.state.item.subtype = "";
    // Pola tekstowe nie wymagają przerysowania – unikamy utraty fokusu przy przechodzeniu Tabem.
    if ( (el.tagName === "TEXTAREA") || (el.type === "text") ) {
      if ( path === "item.name" ) this.element.querySelector(".nt-name").textContent = value || "Nowy przedmiot";
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

  static #onStep(event, target) {
    this.state.step = Number(target.dataset.step);
    this.render();
  }

  static #onNext() {
    this.state.step = Math.min(4, this.state.step + 1);
    this.render();
  }

  static #onPrev() {
    this.state.step = Math.max(1, this.state.step - 1);
    this.render();
  }

  static #onPreset(event, target) {
    const p = PRESETS.find(x => x.id === target.dataset.preset);
    if ( !p ) return;
    const base = defaultState();
    const s = this.state;
    s.item = foundry.utils.mergeObject(base.item, foundry.utils.deepClone(p.item));
    s.effects = foundry.utils.deepClone(p.effects).map(e => ({ ...e, id: foundry.utils.randomID() }));
    if ( !s.effects.length ) s.effects = [];
    s.usage = foundry.utils.mergeObject(base.usage, foundry.utils.deepClone(p.usage ?? {}));
    s.uses = foundry.utils.mergeObject(base.uses, foundry.utils.deepClone(p.uses ?? {}));
    s.current = 0;
    this.render();
  }

  static #onItemType(event, target) {
    this.state.item.type = target.dataset.value;
    this.state.item.subtype = "";
    this.render();
  }

  static #onPickImage() {
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "image", current: this.state.item.img, callback: path => {
      this.state.item.img = path;
      this.render();
    } }).render(true);
  }

  static #onSelectEffect(event, target) {
    this.state.current = Number(target.dataset.index);
    this.render();
  }

  static #onAddEffect() {
    this.state.effects.push(newEffect(`Efekt ${this.state.effects.length + 1}`));
    this.state.current = this.state.effects.length - 1;
    this.render();
  }

  static #onRemoveEffect() {
    this.state.effects.splice(this.state.current, 1);
    this.render();
  }

  static #onEffectMode(event, target) {
    if ( !this.effect ) return;
    this.effect.mode = target.dataset.value;
    if ( this.effect.mode === "timed" && this.state.usage.kind === "none" ) this.state.usage.kind = "utility";
    this.render();
  }

  static #onAddRow() {
    if ( !this.effect ) this.state.effects.push(newEffect());
    this.effect.rows.push(newRow("init"));
    this.render();
  }

  static #onRemoveRow(event, target) {
    this.effect?.rows.splice(Number(target.closest("[data-row]").dataset.row), 1);
    this.render();
  }

  /** Ustawia pole wiersza: data-key + data-value. */
  static #onRowSet(event, target) {
    const row = this.#row(target);
    if ( !row ) return;
    const { key, value } = target.dataset;
    row[key] = ["die"].includes(key) ? Number(value) : value;
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
    this.state.usage.kind = target.dataset.value;
    this.render();
  }

  static #onOpenSheet() {
    this.item?.sheet.render(true);
  }

  static async #onCreate() {
    if ( !game.user.isGM ) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
    const s = this.state;
    if ( !s.item.name?.trim() ) {
      s.step = 1;
      this.render();
      return ui.notifications.warn("Podaj nazwę przedmiotu.");
    }
    if ( this.item ) {
      try {
        await saveItem(this.item, s);
        ui.notifications.info(game.i18n.format("GMEI.Notifications.Saved", { item: this.item.name }));
        this.close();
      } catch(err) {
        console.error(`${MODULE_ID} |`, err, s);
        ui.notifications.error(game.i18n.format("GMEI.Errors.CreateFailed", { error: err.message }));
      }
      return;
    }
    const actor = game.actors.get(s.destination.actorId) ?? null;
    const data = buildItemData(s, { forActor: !!actor });
    try {
      let item;
      if ( actor ) [item] = await actor.createEmbeddedDocuments("Item", [data]);
      else item = await Item.implementation.create({ ...data, folder: s.destination.folder || null });
      ui.notifications.info(actor
        ? game.i18n.format("GMEI.Notifications.Added", { item: item.name, actor: actor.name })
        : game.i18n.format("GMEI.Notifications.Created", { item: item.name }));
      if ( s.destination.openSheet ) item.sheet.render(true);
      this.close();
    } catch(err) {
      console.error(`${MODULE_ID} |`, err, data);
      ui.notifications.error(game.i18n.format("GMEI.Errors.CreateFailed", { error: err.message }));
    }
  }
}
