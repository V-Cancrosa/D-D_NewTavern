/**
 * „Wpływ na postać”: dnd5e liczy postać z nowym przedmiotem na tymczasowej kopii w pamięci.
 * Nic nie jest zapisywane w świecie – kopia znika po obliczeniu.
 */
import { pl, toPolishDice } from "./labels.js";

const get = (obj, path) => foundry.utils.getProperty(obj, path);
const signed = n => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n}` : "—");
const MODE = m => (m > 0 ? "przewaga" : m < 0 ? "utrudnienie" : "");

/** Migawka liczb postaci, które warto porównać. */
function snapshot(actor) {
  const s = actor.system;
  const out = {
    ac: { label: "Klasa Pancerza", value: get(s, "attributes.ac.value") },
    hp: { label: "Maks. punkty wytrzymałości", value: get(s, "attributes.hp.max") },
    walk: { label: "Szybkość", value: get(s, "attributes.movement.walk"), unit: " ft" },
    init: { label: "Inicjatywa", value: get(s, "attributes.init.total"), signed: true },
    spellDC: { label: "ST czarów", value: get(s, "attributes.spell.dc") }
  };
  for ( const [a, abl] of Object.entries(s.abilities ?? {}) ) {
    out[`abl-${a}`] = { label: pl("abilities", a, CONFIG.DND5E.abilities?.[a]), value: abl.value };
    out[`save-${a}`] = { label: `Rzut obronny ${pl("abbr", a, a.toUpperCase())}`,
      value: get(abl, "save.value") ?? abl.save, signed: true, mode: get(abl, "save.roll.mode") };
  }
  for ( const [k, sk] of Object.entries(s.skills ?? {}) ) {
    out[`skill-${k}`] = { label: pl("skills", k, CONFIG.DND5E.skills?.[k]), value: sk.total, signed: true,
      mode: get(sk, "roll.mode") };
  }
  return out;
}

const fmt = e => (e?.value === undefined || e?.value === null ? "—"
  : `${e.signed ? signed(e.value) : e.value}${e.unit ?? ""}${MODE(e.mode) ? `, ${MODE(e.mode)}` : ""}`);

/**
 * Liczy wpływ przedmiotu na postać.
 * @param {Actor} actor
 * @param {object} itemData   Dane przedmiotu (jak do utworzenia).
 * @param {object} [options]
 * @param {string} [options.replaceId]  Id edytowanego przedmiotu (zastępowany kopią).
 * @returns {{ rows: object[], notes: string[], warnings: string[] }|null}
 */
export function computeImpact(actor, itemData, { replaceId = null } = {}) {
  if ( !actor ) return null;
  try {
    const data = actor.toObject();
    const item = foundry.utils.deepClone(itemData);
    item._id = replaceId ?? foundry.utils.randomID();
    foundry.utils.setProperty(item, "system.equipped", true);
    if ( get(item, "system.attunement") === "required" ) foundry.utils.setProperty(item, "system.attuned", true);
    data.items = (data.items ?? []).filter(i => i._id !== item._id).concat(item);
    // Foundry przygotowuje dane dokumentu już przy jego tworzeniu. Drugie wywołanie prepareData()
    // rzuca błąd w dnd5e 6 („Cannot redefine property: walk”), więc go nie robimy.
    const temp = new Actor.implementation(data);

    const before = snapshot(actor);
    const after = snapshot(temp);
    const rows = [];
    for ( const [key, a] of Object.entries(after) ) {
      const b = before[key];
      const changed = (b?.value !== a.value) || ((b?.mode ?? 0) !== (a.mode ?? 0));
      if ( !changed && key !== "ac" ) continue;
      const up = Number(a.value) > Number(b?.value) || (a.mode ?? 0) > (b?.mode ?? 0);
      rows.push({ label: a.label, before: fmt(b), after: fmt(a), cls: !changed ? "same" : up ? "up" : "dn" });
    }

    const notes = [];
    const warnings = [];
    const tempItem = temp.items.get(item._id);
    // Broń: trafienie i obrażenia z aktywności ataku
    const attack = tempItem?.system?.activities?.find?.(a => a.type === "attack");
    if ( attack ) {
      const dmg = (attack.labels?.damage ?? []).map(d => toPolishDice(d.formula ?? d.label ?? "")).filter(Boolean);
      notes.push(`Trafienie: ${attack.labels?.toHit ?? "—"}${dmg.length ? ` · obrażenia: ${dmg.join(" + ")}` : ""}`);
    }
    // Zbroja: skąd KP
    if ( item.type === "equipment" && get(item, "system.armor.value") ) {
      const ac = temp.system.attributes?.ac;
      if ( ac?.armor !== undefined ) notes.push(`KP w zbroi: ${ac.armor} + ZRC ${ac.dex ?? "?"}${ac.shield ? ` + tarcza ${ac.shield}` : ""}${ac.bonus ? ` + premie ${ac.bonus}` : ""}`);
    }
    // Biegłość
    if ( tempItem && ["weapon", "equipment"].includes(item.type) && get(item, "system.armor.value") !== 0
      && tempItem.system?.proficiencyMultiplier === 0 ) {
      warnings.push(item.type === "weapon"
        ? `${actor.name} nie ma biegłości w tej broni – bez premii z biegłości do trafienia.`
        : `${actor.name} nie ma biegłości w tej zbroi – utrudnienie do testów i ataków SIŁ/ZRC, nie może rzucać czarów.`);
    }
    // Siła
    const str = Number(get(item, "system.strength")) || 0;
    if ( str && (Number(get(actor.system, "abilities.str.value")) < str) ) {
      warnings.push(`Wymagana Siła ${str}, a ${actor.name} ma ${get(actor.system, "abilities.str.value")} – szybkość −10 ft.`);
    }
    return { rows, notes, warnings };
  } catch(err) {
    console.warn("new-tavern | Nie udało się policzyć wpływu na postać", err);
    return { rows: [], notes: [], warnings: [], error: err.message };
  }
}
