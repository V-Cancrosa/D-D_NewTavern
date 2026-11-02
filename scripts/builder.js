import { toSystemDice } from "./labels.js";
import { getFormulaRefs, OPERATIONS, getSetOptions, getTarget, allowedKinds } from "./catalog.js";

/** Właściwości przedmiotu (zestaw z kreatora + „magiczny”). */
export function itemProperties(i) {
  const props = new Set(i.properties ?? []);
  if ( i.magical || Number(i.magicalBonus) ) props.add("mgc");
  else props.delete("mgc");
  return [...props];
}

/** Zbroje i tarcze – podtypy wyposażenia, które liczą się do KP. */
export const ARMOR_SUBTYPES = ["light", "medium", "heavy", "natural", "shield"];
export const isArmorItem = i => (i.type === "equipment") && ARMOR_SUBTYPES.includes(i.subtype);

export const isV14 = () => (game.release?.generation ?? 13) >= 14;

/** Jednostki czasu trwania: klucz Foundry 14 → liczba sekund (dla Foundry 13). */
export const DURATION_UNITS = {
  rounds: { label: "rund", seconds: null },
  turns: { label: "tur", seconds: null },
  minutes: { label: "minut", seconds: 60 },
  hours: { label: "godzin", seconds: 3600 },
  days: { label: "dni", seconds: 86400 }
};

/** Moment wygaśnięcia (tylko Foundry 14 / dnd5e 6). */
export const EXPIRY = {
  turnStart: { label: "na początku tury", durationless: false },
  turnEnd: { label: "na końcu tury", durationless: false },
  targetEnd: { label: "na końcu następnej tury celu", durationless: true },
  sourceEnd: { label: "na końcu następnej tury używającego", durationless: true },
  shortRest: { label: "po krótkim odpoczynku", durationless: true },
  longRest: { label: "po długim odpoczynku", durationless: true }
};

/* -------------------------------------------- */
/*  Opisy słowne                                */
/* -------------------------------------------- */

const signed = n => (Number(n) >= 0 ? "+" : "") + n;

/** Tekst wartości wiersza zmiany, np. „+1”, „1k4”, „premia z biegłości”. */
export function valueText(row, target) {
  const unit = target?.unit ? ` ${target.unit}` : "";
  switch ( row.kind ) {
    case "dice": return `${row.count}k${row.die}`;
    case "formula": return (getFormulaRefs().find(r => r.value === row.ref)?.label ?? row.ref).toLowerCase();
    default: return `${row.num}${unit}`;
  }
}

/** Zdanie opisujące jedną zmianę. */
export function describeRow(row) {
  if ( row.raw ) return `Własna zmiana: ${row.raw.key} (${row.raw.type ?? row.raw.mode}) ${row.raw.value}`;
  const t = getTarget(row.target);
  if ( !t ) return "Wybierz, co zmienia efekt.";
  const v = valueText(row, t);
  switch ( row.op ) {
    case "grant": {
      const opts = getSetOptions(t.options);
      const names = row.tags.map(tag => opts.find(o => o.value === tag)?.label ?? tag);
      return names.length ? `${t.short}: ${names.join(", ")}.` : `${t.short}: (wybierz)`;
    }
    case "add": return row.kind === "number" ? `${t.short} ${signed(row.num)}${t.unit ? ` ${t.unit}` : ""}.`
      : `${t.short} + ${v}.`;
    case "bonus": return `${row.kind === "number" ? signed(row.num) : `+ ${v}`} do ${t.short}.`;
    case "multiply": return `${t.short} × ${row.num}.`;
    case "override": return `${t.short} wynosi ${v}.`;
    case "upgrade": return `${t.short} wynosi co najmniej ${v}.`;
    case "downgrade": return `${t.short} wynosi co najwyżej ${v}.`;
    case "advantage": return `Przewaga do ${t.short}.`;
    case "disadvantage": return `Utrudnienie do ${t.short}.`;
    case "minimum": return `Wynik k20 przy ${t.short} to co najmniej ${row.num}.`;
  }
  return "";
}

/** Opis czasu trwania efektu. */
export function describeDuration(effect) {
  if ( effect.mode !== "timed" ) return "stały, gdy przedmiot jest założony";
  const d = effect.duration;
  const exp = EXPIRY[d.expiry];
  if ( isV14() && exp?.durationless ) return exp.label;
  const unit = DURATION_UNITS[d.units]?.label ?? d.units;
  return isV14() && exp ? `${d.value} ${unit}, kończy się ${exp.label}` : `${d.value} ${unit}`;
}

/* -------------------------------------------- */
/*  Budowanie danych                            */
/* -------------------------------------------- */

/** Wartość zapisywana w zmianie. */
function rawValue(row) {
  switch ( row.op ) {
    case "advantage": return "1";
    case "disadvantage": return "-1";
    case "minimum": return String(row.num);
  }
  if ( row.kind === "dice" ) return `${row.count}d${row.die}`;
  if ( row.kind === "formula" ) return row.ref;
  return String(row.num);
}

/** Tworzy zmianę w formacie właściwym dla wersji Foundry. */
function makeChange(key, op, value) {
  const type = OPERATIONS[op].type;
  // Foundry 14: natywne okno zmiany zapisuje liczby jako liczby (JSON.parse), robimy to samo.
  if ( isV14() ) return { key, type, value: /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value };
  return { key, mode: CONST.ACTIVE_EFFECT_MODES[type.toUpperCase()], value };
}

/** Zamienia wiersz kreatora na listę zmian (jeden wiersz może dać kilka kluczy). */
export function rowToChanges(row) {
  if ( row.raw ) return [foundry.utils.deepClone(row.raw)];
  const t = getTarget(row.target);
  if ( !t ) return [];
  const opKey = row.op === "disadvantage" ? "advantage" : row.op;
  const keys = t.keys[opKey] ?? [];
  if ( row.op === "grant" ) return keys.flatMap(k => row.tags.map(tag => makeChange(k, row.op, tag)));
  if ( row.kind && !allowedKinds(t, row.op).includes(row.kind) && allowedKinds(t, row.op).length ) {
    row = { ...row, kind: "number" };
  }
  return keys.map(k => makeChange(k, row.op, rawValue(row)));
}

/** Dane czasu trwania efektu. */
function effectDuration(effect) {
  if ( effect.mode !== "timed" ) return {};
  const { value, units, expiry } = effect.duration;
  if ( isV14() ) {
    if ( EXPIRY[expiry]?.durationless ) return { expiry, value: null };
    return { value: Number(value) || 1, units, expiry };
  }
  const v = Number(value) || 1;
  if ( units === "rounds" ) return { rounds: v };
  if ( units === "turns" ) return { turns: v };
  return { seconds: v * (DURATION_UNITS[units]?.seconds ?? 60) };
}

/** Buduje dane jednego efektu. */
export function buildEffect(effect, img) {
  const changes = effect.rows.flatMap(rowToChanges);
  const data = {
    _id: effect.id,
    name: effect.name?.trim() || "Efekt",
    img: img || "icons/svg/aura.svg",
    transfer: effect.mode !== "timed",
    disabled: false,
    statuses: [...(effect.statuses ?? [])],
    duration: effectDuration(effect)
  };
  if ( isV14() ) Object.assign(data, { type: "base", system: { changes } });
  else data.changes = changes;
  return data;
}

/** Buduje aktywność („co się dzieje po użyciu”). */
export function buildActivity(state, timedIds) {
  const u = state.usage;
  let kind = u.kind;
  if ( kind === "none" && timedIds.length ) kind = "utility";
  if ( kind === "none" ) return null;
  const consumption = {
    targets: state.uses.enabled ? [{ type: "itemUses", target: "", value: String(u.cost || 1) }] : [],
    scaling: { allowed: state.uses.enabled && u.scaling, max: "" }
  };
  const scaling = { mode: state.uses.enabled && u.scaling ? "whole" : "", number: 1 };
  const activity = {
    _id: state.editing?.activityType === kind ? state.editing.activityId : foundry.utils.randomID(),
    type: kind === "attack" ? "attack" : kind,
    activation: { type: u.activation || "action" },
    consumption,
    effects: timedIds.map(_id => ({ _id })),
    target: { affects: { type: "creature", count: "1" } }
  };
  const dice = (d, types) => ({
    number: Number(d.count) || 0, denomination: Number(d.die) || 0, bonus: toSystemDice(d.bonus ?? ""), types, scaling
  });
  if ( kind === "heal" ) {
    activity.healing = dice(u.heal, ["healing"]);
    activity.range = { units: "touch" };
  } else if ( kind === "damage" ) {
    activity.damage = { parts: [dice(u.damage, [u.damage.type])] };
  } else if ( kind === "save" ) {
    activity.save = { ability: [u.save.ability], dc: { calculation: "", formula: String(u.save.dc) } };
    activity.damage = { onSave: u.save.onSave, parts: Number(u.damage.count) ? [dice(u.damage, [u.damage.type])] : [] };
  }
  return activity;
}

/** Buduje kompletne dane przedmiotu gotowe dla `Item.create` / `createEmbeddedDocuments`. */
export function buildItemData(state, { forActor = false } = {}) {
  const i = state.item;
  const effects = state.effects.filter(e => e.rows.length || e.statuses?.length).map(e => buildEffect(e, i.img));
  const timedIds = effects.filter(e => !e.transfer).map(e => e._id);
  const system = {
    description: { value: i.description ? `<p>${foundry.utils.escapeHTML?.(i.description) ?? i.description}</p>` : "" },
    quantity: Number(i.quantity) || 1,
    rarity: i.rarity || "",
    attunement: i.attunement || "",
    identified: true,
    properties: itemProperties(i)
  };
  if ( i.subtype || i.baseItem ) system.type = { value: i.subtype || "", baseItem: i.baseItem || "" };
  if ( (i.proficient !== null) && (i.proficient !== undefined) && (i.proficient !== "") ) system.proficient = Number(i.proficient);
  if ( Number(i.weight) > 0 ) system.weight = { value: Number(i.weight), units: "lb" };
  if ( i.type === "weapon" ) {
    const r = i.range ?? {};
    const num = v => (v === "" || v === null || v === undefined) ? null : Number(v);
    system.range = { value: num(r.value), long: num(r.long), reach: num(r.reach), units: r.units || "ft" };
  }
  if ( i.rules ) system.source = { rules: i.rules };
  if ( Number(i.price) > 0 ) system.price = { value: Number(i.price), denomination: i.priceDenomination || "gp" };
  if ( (i.type === "weapon") && (i.rules === "2024") && i.mastery ) system.mastery = i.mastery;
  if ( forActor ) {
    if ( i.equipped ) system.equipped = true;
    if ( i.equipped && i.attunement === "required" ) system.attuned = true;
  }
  if ( isArmorItem(i) ) {
    system.armor = { value: Number(i.armor?.value) || 0, dex: i.armor?.dex === "" || i.armor?.dex === null
      ? null : Number(i.armor?.dex), magicalBonus: Number(i.magicalBonus) || null };
    if ( Number(i.armor?.strength) ) system.strength = Number(i.armor.strength);
  } else if ( Number(i.magicalBonus) ) {
    if ( i.type === "equipment" ) system.armor = { magicalBonus: Number(i.magicalBonus) };
    else system.magicalBonus = Number(i.magicalBonus);
  }
  if ( i.type === "weapon" && Number(i.damage.count) ) {
    system.damage = { base: { number: Number(i.damage.count), denomination: Number(i.damage.die),
      types: [i.damage.type] } };
    if ( Number(i.versatile?.count) && Number(i.versatile?.die) ) system.damage.versatile = {
      number: Number(i.versatile.count), denomination: Number(i.versatile.die), types: [i.damage.type] };
  }
  if ( state.uses.enabled ) {
    const u = state.uses;
    system.uses = { max: String(u.max || 1), spent: 0, recovery: u.recovery
      ? [{ period: u.recovery, type: u.formula ? "formula" : "recoverAll", formula: toSystemDice(u.formula || "") }] : [] };
    if ( i.type === "consumable" ) system.uses.autoDestroy = Boolean(u.autoDestroy);
  }
  const activity = i.type === "loot" ? null : buildActivity(state, timedIds);
  if ( activity ) system.activities = { [activity._id]: activity };
  // Broń zawsze ma atak. dnd5e dodaje go sam tylko wtedy, gdy przedmiot nie ma żadnej aktywności.
  if ( (i.type === "weapon") && activity && (activity.type !== "attack") ) {
    const attackId = foundry.utils.randomID();
    system.activities[attackId] = { _id: attackId, type: "attack", activation: { type: "action" }, sort: -1 };
  }

  return {
    name: i.name?.trim() || "Nowy przedmiot",
    type: i.type,
    img: i.img || globalThis.Item?.implementation?.getDefaultArtwork?.({ type: i.type })?.img || "icons/svg/item-bag.svg",
    system,
    effects
  };
}

/* -------------------------------------------- */
/*  Zapis zmian w istniejącym przedmiocie       */
/* -------------------------------------------- */

/**
 * Zapisuje stan kreatora w istniejącym przedmiocie. Zmienia tylko to, czym kreator zarządza:
 * nieznane zmiany efektów, inne aktywności i sformatowany opis zostają nietknięte.
 * @param {Item} item
 * @param {object} state
 */
export async function saveItem(item, state) {
  const i = state.item;
  const built = buildItemData(state, { forActor: item.isEmbedded });
  const sys = built.system;
  const ed = state.editing ?? {};

  // Pola przedmiotu
  const properties = new Set(itemProperties(i));
  const update = {
    name: built.name, img: built.img,
    "system.quantity": sys.quantity, "system.rarity": sys.rarity, "system.attunement": sys.attunement,
    "system.properties": [...properties],
    "system.price.value": Number(i.price) || 0,
    "system.price.denomination": i.priceDenomination || "gp"
  };
  if ( i.rules ) update["system.source.rules"] = i.rules;
  if ( "baseItem" in (item.system.type ?? {}) ) update["system.type.baseItem"] = i.baseItem || "";
  if ( "proficient" in item.system ) update["system.proficient"] = (i.proficient === null || i.proficient === "" || i.proficient === undefined) ? null : Number(i.proficient);
  if ( "weight" in item.system ) update["system.weight.value"] = Number(i.weight) || 0;
  if ( sys.range ) update["system.range"] = sys.range;
  if ( sys.damage?.versatile ) {
    update["system.damage.versatile.number"] = sys.damage.versatile.number;
    update["system.damage.versatile.denomination"] = sys.damage.versatile.denomination;
  }
  if ( (item.type === "weapon") && ("mastery" in item.system) ) update["system.mastery"] = (i.rules === "2024") ? (i.mastery || "") : (item.system.mastery ?? "");
  if ( "type" in item.system && (typeof item.system.type === "object") ) update["system.type.value"] = i.subtype || "";
  if ( i.description !== i.descriptionOriginal ) update["system.description.value"] = sys.description.value;
  if ( item.isEmbedded && ("equipped" in item.system) ) {
    update["system.equipped"] = !!i.equipped;
    if ( i.equipped && (i.attunement === "required") ) update["system.attuned"] = true;
  }
  if ( item.type === "equipment" ) update["system.armor.magicalBonus"] = Number(i.magicalBonus) || null;
  if ( isArmorItem(i) ) {
    update["system.armor.value"] = Number(i.armor?.value) || 0;
    update["system.armor.dex"] = (i.armor?.dex === "" || i.armor?.dex === null) ? null : Number(i.armor?.dex);
    update["system.strength"] = Number(i.armor?.strength) || null;
  }
  else if ( "magicalBonus" in item.system ) update["system.magicalBonus"] = Number(i.magicalBonus) || null;
  if ( sys.damage ) {
    update["system.damage.base.number"] = sys.damage.base.number;
    update["system.damage.base.denomination"] = sys.damage.base.denomination;
    update["system.damage.base.types"] = sys.damage.base.types;
  }
  if ( sys.uses ) {
    update["system.uses.max"] = sys.uses.max;
    update["system.uses.recovery"] = sys.uses.recovery;
    if ( "autoDestroy" in sys.uses ) update["system.uses.autoDestroy"] = sys.uses.autoDestroy;
  } else if ( ed.hadUses ) update["system.uses.max"] = "";
  await item.update(update);

  // Efekty
  const keep = new Set(state.effects.map(e => e.id));
  const toDelete = (ed.effectIds ?? []).filter(id => !keep.has(id) && item.effects.has(id));
  if ( toDelete.length ) await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  const allEffects = state.effects.map(e => buildEffect(e, item.img));
  const toUpdate = [];
  const toCreate = [];
  for ( const data of allEffects ) {
    if ( item.effects.has(data._id) ) {
      const { img, ...rest } = data;
      if ( !Object.keys(rest.duration).length ) rest.duration = isV14()
        ? { value: null, expiry: null } : { seconds: null, rounds: null, turns: null };
      toUpdate.push(rest);
    } else toCreate.push(data);
  }
  if ( toUpdate.length ) {
    try {
      await item.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    } catch(err) {
      // Na wypadek gdyby schemat nie przyjął pustego „expiry” – zapis bez czyszczenia momentu wygaśnięcia.
      for ( const u of toUpdate ) if ( u.duration && ("expiry" in u.duration) && (u.duration.expiry === null) ) {
        delete u.duration.expiry;
      }
      await item.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    }
  }
  if ( toCreate.length ) await item.createEmbeddedDocuments("ActiveEffect", toCreate, { keepId: true });

  // Aktywność
  if ( item.type === "loot" || !item.system.activities ) return item;
  const timedIds = allEffects.filter(e => !e.transfer).map(e => e._id);
  const activity = buildActivity(state, timedIds);
  const existing = ed.activityId && item.system.activities.get(ed.activityId);
  if ( existing && (!activity || (existing.type !== activity.type)) ) await item.deleteActivity(ed.activityId);
  if ( activity ) {
    const { _id, ...data } = activity;
    if ( existing && (existing.type === activity.type) ) await item.updateActivity(_id, data);
    else await item.update({ [`system.activities.${_id}`]: activity });
  }
  return item;
}
