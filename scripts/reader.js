import { FORMULA_REFS, OPERATIONS, getTargets } from "./catalog.js";
import { isV14 } from "./builder.js";

/** Rodzaje aktywności, które kreator potrafi edytować. */
export const MANAGED_ACTIVITY_TYPES = ["utility", "heal", "damage", "save"];

/** Typ zmiany jako tekst („add”, „override”…), niezależnie od wersji Foundry. */
function changeType(c) {
  if ( typeof c.type === "string" ) return c.type;
  const entry = Object.entries(CONST.ACTIVE_EFFECT_MODES ?? {}).find(([, v]) => v === Number(c.mode));
  return entry ? entry[0].toLowerCase() : "custom";
}

/** Zamienia wartość zapisaną w zmianie na część wiersza kreatora (albo null, gdy się nie da). */
function parseValue(value) {
  const v = String(value ?? "").trim();
  if ( /^[-+]?\d+(\.\d+)?$/.test(v) ) return { kind: "number", num: Number(v) };
  const dice = v.match(/^(\d+)d(\d+)$/i);
  if ( dice ) return { kind: "dice", count: Number(dice[1]), die: Number(dice[2]) };
  if ( FORMULA_REFS.some(r => r.value === v) ) return { kind: "formula", ref: v };
  return null;
}

const baseRow = () => ({ op: "add", kind: "number", num: 1, count: 1, die: 4, ref: "@prof", tags: [] });

/**
 * Odtwarza wiersze kreatora z listy zmian efektu. Zmiany, których kreator nie rozpoznaje,
 * zostają jako wiersze „raw” i są zapisywane z powrotem bez zmian.
 * @param {object[]} changes
 * @returns {object[]}
 */
export function changesToRows(changes) {
  const left = changes.map(c => ({ c, key: c.key, type: changeType(c), value: String(c.value ?? ""), used: false }));
  const rows = [];
  const candidates = [];
  for ( const t of getTargets() ) for ( const op of t.ops ) {
    const keys = t.keys[op === "disadvantage" ? "advantage" : op] ?? [];
    if ( keys.length ) candidates.push({ t, op, keys, type: OPERATIONS[op].type });
  }
  candidates.sort((a, b) => b.keys.length - a.keys.length);

  for ( const { t, op, keys, type } of candidates ) {
    if ( op === "grant" ) {
      const hits = left.filter(x => !x.used && keys.includes(x.key) && (x.type === type));
      if ( !hits.length ) continue;
      hits.forEach(x => x.used = true);
      rows.push({ ...baseRow(), target: t.id, op, tags: [...new Set(hits.map(x => x.value))] });
      continue;
    }
    for ( const first of left.filter(x => !x.used && (x.key === keys[0]) && (x.type === type)) ) {
      if ( first.used ) continue;
      if ( (op === "advantage") && (first.value !== "1") ) continue;
      if ( (op === "disadvantage") && (first.value !== "-1") ) continue;
      const group = keys.map(k => left.find(x => !x.used && (x.key === k) && (x.type === type)
        && (x.value === first.value)));
      if ( group.some(x => !x) ) continue;
      let parsed = {};
      if ( !["advantage", "disadvantage"].includes(op) ) {
        parsed = parseValue(first.value);
        if ( !parsed ) continue;
        if ( op === "minimum" && parsed.kind !== "number" ) continue;
      }
      group.forEach(x => x.used = true);
      rows.push({ ...baseRow(), target: t.id, op, ...parsed });
    }
  }
  for ( const x of left.filter(y => !y.used) ) rows.push({ ...baseRow(), target: null, raw: x.c });
  return rows;
}

/** Czas trwania efektu w formacie kreatora. */
function readDuration(src) {
  const d = src.duration ?? {};
  if ( isV14() ) {
    const timed = Number.isFinite(Number(d.value)) && (d.value !== null) || !!d.expiry;
    return { timed, duration: { value: Number(d.value) || 1, units: d.units || "minutes", expiry: d.expiry || "turnStart" } };
  }
  if ( d.rounds ) return { timed: true, duration: { value: d.rounds, units: "rounds", expiry: "turnStart" } };
  if ( d.turns ) return { timed: true, duration: { value: d.turns, units: "turns", expiry: "turnStart" } };
  if ( d.seconds ) {
    const s = Number(d.seconds);
    const [units, div] = (s % 86400 === 0) ? ["days", 86400] : (s % 3600 === 0) ? ["hours", 3600] : ["minutes", 60];
    return { timed: true, duration: { value: Math.max(1, Math.round(s / div)), units, expiry: "turnStart" } };
  }
  return { timed: false, duration: { value: 1, units: "minutes", expiry: "turnStart" } };
}

/** Czyści HTML do zwykłego tekstu. */
function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return div.textContent.trim();
}

/**
 * Buduje stan kreatora z istniejącego przedmiotu.
 * @param {Item} item
 * @param {object} base  Stan domyślny, uzupełniany danymi przedmiotu.
 */
export function readItem(item, base) {
  const s = foundry.utils.deepClone(base);
  const sys = item.system;
  const description = htmlToText(sys.description?.value);
  Object.assign(s.item, {
    name: item.name, img: item.img, type: item.type,
    subtype: sys.type?.value ?? "", rarity: sys.rarity ?? "", attunement: sys.attunement ?? "",
    magical: sys.properties?.has?.("mgc") ?? false, equipped: !!sys.equipped,
    quantity: sys.quantity ?? 1, description, descriptionOriginal: description,
    magicalBonus: Number(item.type === "equipment" ? sys.armor?.magicalBonus : sys.magicalBonus) || 0
  });
  const base0 = sys.damage?.base;
  if ( (item.type === "weapon") && base0 ) Object.assign(s.item.damage, {
    count: base0.number ?? 1, die: base0.denomination ?? 8, type: base0.types?.first?.() ?? [...(base0.types ?? [])][0] ?? "slashing"
  });

  // Ładunki
  const uses = sys.uses;
  if ( uses?.max ) {
    const rec = uses.recovery?.[0];
    Object.assign(s.uses, { enabled: true, max: Number(uses.max) || uses.max, recovery: rec?.period ?? "",
      formula: rec?.type === "formula" ? (rec.formula ?? "") : "", autoDestroy: !!uses.autoDestroy });
  }

  // Efekty (tylko zwykłe, bez zaklęć „enchantment”)
  const effects = item.effects.filter(e => !["enchantment"].includes(e.type));
  s.effects = effects.map(e => {
    const src = e.toObject();
    const changes = (isV14() ? src.system?.changes : src.changes) ?? [];
    const { duration } = readDuration(src);
    return {
      id: e.id, name: e.name, mode: e.transfer ? "passive" : "timed",
      rows: changesToRows(changes), statuses: [...(e.statuses ?? [])], duration
    };
  });

  // Aktywność, którą kreator umie edytować
  const activity = (sys.activities?.contents ?? [...(sys.activities?.values?.() ?? [])])
    .find(a => MANAGED_ACTIVITY_TYPES.includes(a.type));
  if ( activity ) {
    const u = s.usage;
    u.kind = activity.type;
    u.activation = activity.activation?.type || "action";
    const target = activity.consumption?.targets?.find?.(t => t.type === "itemUses")
      ?? [...(activity.consumption?.targets ?? [])].find(t => t.type === "itemUses");
    u.cost = Number(target?.value) || 1;
    u.scaling = !!activity.consumption?.scaling?.allowed;
    if ( activity.type === "heal" ) Object.assign(u.heal, {
      count: activity.healing?.number ?? 0, die: activity.healing?.denomination ?? 4, bonus: activity.healing?.bonus ?? ""
    });
    const part = activity.damage?.parts?.[0];
    if ( part ) Object.assign(u.damage, {
      count: part.number ?? 0, die: part.denomination ?? 6, bonus: part.bonus ?? "",
      type: [...(part.types ?? [])][0] ?? u.damage.type
    });
    if ( activity.type === "save" ) Object.assign(u.save, {
      ability: [...(activity.save?.ability ?? [])][0] ?? "dex",
      dc: Number(activity.save?.dc?.formula) || Number(activity.save?.dc?.value) || 15,
      onSave: activity.damage?.onSave ?? "half"
    });
    if ( activity.type === "save" && !part ) u.damage.count = 0;
  }

  s.editing = {
    uuid: item.uuid,
    effectIds: effects.map(e => e.id),
    activityId: activity?.id ?? null,
    activityType: activity?.type ?? null,
    hadUses: !!uses?.max,
    otherActivities: (sys.activities?.size ?? 0) - (activity ? 1 : 0)
  };
  return s;
}
