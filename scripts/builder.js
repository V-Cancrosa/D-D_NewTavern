import { FORMULA_REFS, OPERATIONS, getSetOptions, getTarget, allowedKinds } from "./catalog.js";

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
    case "formula": return (FORMULA_REFS.find(r => r.value === row.ref)?.label ?? row.ref).toLowerCase();
    default: return `${row.num}${unit}`;
  }
}

/** Zdanie opisujące jedną zmianę. */
export function describeRow(row) {
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
function buildActivity(state, timedIds) {
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
    _id: foundry.utils.randomID(),
    type: kind === "attack" ? "attack" : kind,
    activation: { type: u.activation || "action" },
    consumption,
    effects: timedIds.map(_id => ({ _id })),
    target: { affects: { type: "creature", count: "1" } }
  };
  const dice = (d, types) => ({
    number: Number(d.count) || 0, denomination: Number(d.die) || 0, bonus: d.bonus ?? "", types, scaling
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
    properties: i.magical || Number(i.magicalBonus) ? ["mgc"] : []
  };
  if ( i.subtype ) system.type = { value: i.subtype };
  if ( forActor ) {
    if ( i.equipped ) system.equipped = true;
    if ( i.equipped && i.attunement === "required" ) system.attuned = true;
  }
  if ( Number(i.magicalBonus) ) {
    if ( i.type === "equipment" ) system.armor = { magicalBonus: Number(i.magicalBonus) };
    else system.magicalBonus = Number(i.magicalBonus);
  }
  if ( i.type === "weapon" && Number(i.damage.count) ) {
    system.damage = { base: { number: Number(i.damage.count), denomination: Number(i.damage.die),
      types: [i.damage.type] } };
  }
  if ( state.uses.enabled ) {
    const u = state.uses;
    system.uses = { max: String(u.max || 1), spent: 0, recovery: u.recovery
      ? [{ period: u.recovery, type: u.formula ? "formula" : "recoverAll", formula: u.formula || "" }] : [] };
    if ( i.type === "consumable" ) system.uses.autoDestroy = Boolean(u.autoDestroy);
  }
  const activity = i.type === "loot" ? null : buildActivity(state, timedIds);
  if ( activity ) system.activities = { [activity._id]: activity };

  return {
    name: i.name?.trim() || "Nowy przedmiot",
    type: i.type,
    img: i.img || "icons/svg/item-bag.svg",
    system,
    effects
  };
}
