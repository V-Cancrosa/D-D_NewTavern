/**
 * Katalog „celów” efektów: polskie nazwy zamiast kluczy dnd5e.
 * Każdy cel wie, jakie działania i rodzaje wartości są dozwolone
 * oraz jak przełożyć je na klucze dnd5e 5.x (Foundry 13) i 6.x (Foundry 14).
 */

import { PL, pl } from "./labels.js";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_PL = { str: "Siła", dex: "Zręczność", con: "Kondycja", int: "Inteligencja", wis: "Mądrość", cha: "Charyzma" };
const ABILITY_GEN = { str: "SIŁ", dex: "ZRC", con: "KON", int: "INT", wis: "MDR", cha: "CHA" };

/** Czy działamy na dnd5e 6.x (nowe ścieżki `system.rolls.*`, `movement.speeds.*`). */
export const isDnd6 = () => foundry.utils.isNewerVersion(game.system.version, "5.99.99");

/** Działania dostępne w kreatorze. `type` to typ zmiany w Foundry. */
export const OPERATIONS = {
  add: { label: "Dodaj", type: "add" },
  bonus: { label: "Premia", type: "add" },
  multiply: { label: "Pomnóż ×", type: "multiply" },
  override: { label: "Ustaw na", type: "override" },
  upgrade: { label: "Co najmniej", type: "upgrade" },
  downgrade: { label: "Co najwyżej", type: "downgrade" },
  advantage: { label: "Przewaga", type: "add" },
  disadvantage: { label: "Utrudnienie", type: "add" },
  minimum: { label: "Minimum na k20", type: "upgrade" },
  grant: { label: "Nadaj", type: "add" }
};

export const VALUE_KINDS = {
  number: "Liczba",
  dice: "Kości",
  formula: "Z cech postaci"
};

export const FORMULA_REFS = [
  { value: "@prof", label: "Premia z biegłości" },
  { value: "@details.level", label: "Poziom postaci" },
  ...ABILITIES.map(a => ({ value: `@abilities.${a}.mod`, label: `Mod. ${ABILITY_GEN[a]}` }))
];

const skillKeys = () => Object.keys(CONFIG.DND5E?.skills ?? {});
const label = v => game.i18n.localize(typeof v === "string" ? v : (v?.label ?? ""));

/**
 * Cel „rzutowy” (premia z kośćmi, przewaga, minimum).
 * @param {object} def
 */
function roll(def) {
  return { cls: "roll", dice: true, ops: ["bonus", "advantage", "disadvantage", "minimum"], ...def };
}

/** Lista wszystkich celów. Wywoływana w czasie działania, bo korzysta z CONFIG. */
export function getTargets() {
  const v6 = isDnd6();
  const T = [];
  const push = (group, t) => T.push({ group, ...t });

  // Obrona
  push("Obrona", { id: "ac", cls: "stat", label: "Klasa Pancerza", short: "KP", ops: ["add"],
    keys: { add: ["system.attributes.ac.bonus"] } });
  push("Obrona", { id: "hp", cls: "stat", label: "Maks. punkty wytrzymałości", short: "Maks. PW", ops: ["add"],
    keys: { add: ["system.attributes.hp.bonuses.overall"] } });
  push("Obrona", { id: "dr", cls: "set", label: "Odporność na obrażenia", short: "Odporność na", ops: ["grant"],
    options: "damage", keys: { grant: ["system.traits.dr.value"] } });
  push("Obrona", { id: "di", cls: "set", label: "Niewrażliwość na obrażenia", short: "Niewrażliwość na", ops: ["grant"],
    options: "damage", keys: { grant: ["system.traits.di.value"] } });
  push("Obrona", { id: "dv", cls: "set", label: "Podatność na obrażenia", short: "Podatność na", ops: ["grant"],
    options: "damage", keys: { grant: ["system.traits.dv.value"] } });
  push("Obrona", { id: "ci", cls: "set", label: "Niewrażliwość na stany", short: "Niewrażliwość na stan", ops: ["grant"],
    options: "condition", keys: { grant: ["system.traits.ci.value"] } });

  // Rzuty obronne
  push("Rzuty obronne", roll({ id: "saves", label: "Wszystkie rzuty obronne", short: "wszystkich rzutów obronnych",
    keys: v6 ? {
      bonus: ["system.rolls.ability.save.bonus"], advantage: ["system.rolls.ability.save.mode"],
      minimum: ["system.rolls.ability.save.min"]
    } : {
      bonus: ["system.bonuses.abilities.save"],
      advantage: ABILITIES.map(a => `system.abilities.${a}.save.roll.mode`),
      minimum: ABILITIES.map(a => `system.abilities.${a}.save.roll.min`)
    } }));
  for ( const a of ABILITIES ) push("Rzuty obronne", roll({
    id: `save-${a}`, label: `Rzut obronny ${ABILITY_GEN[a]}`, short: `rzutów obronnych ${ABILITY_GEN[a]}`,
    keys: {
      bonus: [v6 ? `system.abilities.${a}.save.roll.bonus` : `system.abilities.${a}.bonuses.save`],
      advantage: [`system.abilities.${a}.save.roll.mode`],
      minimum: [`system.abilities.${a}.save.roll.min`]
    }
  }));

  // Testy
  push("Testy", roll({ id: "checks", label: "Testy atrybutów", short: "testów atrybutów",
    keys: v6 ? {
      bonus: ["system.rolls.ability.check.bonus"], advantage: ["system.rolls.ability.check.mode"],
      minimum: ["system.rolls.ability.check.min"]
    } : {
      bonus: ["system.bonuses.abilities.check"],
      advantage: ABILITIES.map(a => `system.abilities.${a}.check.roll.mode`),
      minimum: ABILITIES.map(a => `system.abilities.${a}.check.roll.min`)
    } }));
  push("Testy", roll({ id: "skills", label: "Wszystkie umiejętności", short: "testów umiejętności",
    keys: v6 ? {
      bonus: ["system.rolls.ability.skill.bonus"], advantage: ["system.rolls.ability.skill.mode"],
      minimum: ["system.rolls.ability.skill.min"]
    } : {
      bonus: ["system.bonuses.abilities.skill"],
      advantage: skillKeys().map(s => `system.skills.${s}.roll.mode`),
      minimum: skillKeys().map(s => `system.skills.${s}.roll.min`)
    } }));
  for ( const [s, cfg] of Object.entries(CONFIG.DND5E?.skills ?? {}) ) push("Umiejętności", roll({
    id: `skill-${s}`, label: PL.skills[s] ?? label(cfg), short: `testów: ${PL.skills[s] ?? label(cfg)}`,
    keys: {
      bonus: [v6 ? `system.skills.${s}.roll.bonus` : `system.skills.${s}.bonuses.check`],
      advantage: [`system.skills.${s}.roll.mode`],
      minimum: [`system.skills.${s}.roll.min`]
    }
  }));
  push("Testy", roll({ id: "init", label: "Inicjatywa", short: "inicjatywy",
    keys: {
      bonus: [v6 ? "system.attributes.init.roll.bonus" : "system.attributes.init.bonus"],
      advantage: ["system.attributes.init.roll.mode"],
      minimum: ["system.attributes.init.roll.min"]
    } }));

  // Walka
  const attacks = { mwak: "bronią wręcz", rwak: "bronią dystansową", msak: "czarem wręcz", rsak: "czarem dystansowym" };
  push("Walka", roll({ id: "atk-all", label: "Wszystkie ataki", short: "trafienia wszystkimi atakami",
    ops: v6 ? ["bonus", "advantage", "disadvantage", "minimum"] : ["bonus"],
    keys: v6 ? {
      bonus: ["system.rolls.attack.bonus"], advantage: ["system.rolls.attack.mode"], minimum: ["system.rolls.attack.min"]
    } : { bonus: Object.keys(attacks).map(k => `system.bonuses.${k}.attack`) } }));
  for ( const [k, pl] of Object.entries(attacks) ) push("Walka", roll({
    id: `atk-${k}`, label: `Trafienie ${pl}`, short: `trafienia ${pl}`,
    ops: v6 ? ["bonus", "advantage", "disadvantage", "minimum"] : ["bonus"],
    keys: v6 ? {
      bonus: [`system.rolls.attack.${k}.bonus`], advantage: [`system.rolls.attack.${k}.mode`],
      minimum: [`system.rolls.attack.${k}.min`]
    } : { bonus: [`system.bonuses.${k}.attack`] }
  }));
  for ( const [k, pl] of Object.entries(attacks) ) push("Walka", {
    id: `dmg-${k}`, cls: "roll", dice: true, ops: ["bonus"], label: `Obrażenia ${pl}`, short: `obrażeń ${pl}`,
    keys: { bonus: [v6 ? `system.rolls.damage.${k}.bonus` : `system.bonuses.${k}.damage`] }
  });
  push("Walka", { id: "spell-dc", cls: "stat", label: "ST czarów", short: "ST czarów", ops: ["add"],
    keys: { add: ["system.bonuses.spell.dc"] } });

  // Atrybuty
  for ( const a of ABILITIES ) push("Atrybuty", {
    id: `abl-${a}`, cls: "stat", label: ABILITY_PL[a], short: ABILITY_PL[a],
    ops: ["add", "override", "upgrade", "downgrade"],
    keys: Object.fromEntries(["add", "override", "upgrade", "downgrade"].map(o => [o, [`system.abilities.${a}.value`]]))
  });

  // Ruch i zmysły
  const moves = { walk: "Szybkość", fly: "Szybkość lotu", swim: "Szybkość pływania", climb: "Szybkość wspinaczki",
    burrow: "Szybkość kopania" };
  for ( const [k, pl] of Object.entries(moves) ) {
    const key = v6 ? `system.attributes.movement.speeds.${k}` : `system.attributes.movement.${k}`;
    push("Ruch i zmysły", { id: `move-${k}`, cls: "stat", unit: "ft", label: pl, short: pl,
      ops: ["add", "multiply", "override", "upgrade"],
      keys: { add: [key], multiply: [key], override: [key], upgrade: [key] } });
  }
  const senses = { darkvision: "Widzenie w ciemności", blindsight: "Ślepowidzenie", tremorsense: "Wyczucie drgań",
    truesight: "Prawdziwe widzenie" };
  for ( const [k, pl] of Object.entries(senses) ) {
    const key = v6 ? `system.attributes.senses.ranges.${k}` : `system.attributes.senses.${k}`;
    push("Ruch i zmysły", { id: `sense-${k}`, cls: "stat", unit: "ft", label: pl, short: pl,
      ops: ["upgrade", "add", "override"], keys: { upgrade: [key], add: [key], override: [key] } });
  }
  return T;
}

/** Opcje dla celów typu „set” (rodzaje obrażeń, stany). */
export function getSetOptions(kind) {
  if ( kind === "damage" ) return Object.entries(CONFIG.DND5E?.damageTypes ?? {})
    .map(([value, cfg]) => ({ value, label: pl("damage", value, cfg) }));
  return Object.entries(CONFIG.DND5E?.conditionTypes ?? {})
    .filter(([, cfg]) => !cfg.pseudo)
    .map(([value, cfg]) => ({ value, label: pl("conditions", value, cfg) }));
}

export function getTarget(id) {
  return getTargets().find(t => t.id === id) ?? null;
}

/** Dozwolone rodzaje wartości dla danego celu i działania. */
export function allowedKinds(target, op) {
  if ( !target || target.cls === "set" || ["advantage", "disadvantage"].includes(op) ) return [];
  if ( op === "minimum" ) return ["number"];
  if ( target.cls === "roll" && op === "bonus" ) return ["number", "dice", "formula"];
  return ["number", "formula"];
}
