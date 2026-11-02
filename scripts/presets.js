/**
 * Gotowe szablony przedmiotów. Każdy zwraca fragment stanu kreatora,
 * który MG może dalej zmieniać.
 */

const row = (target, op, extra = {}) => ({
  target, op, kind: "number", num: 1, count: 1, die: 4, ref: "@prof", tags: [], ...extra
});
const effect = (name, rows, extra = {}) => ({
  id: foundry.utils.randomID(), name, mode: "passive", rows, statuses: [],
  duration: { value: 1, units: "minutes", expiry: "turnStart" }, ...extra
});

export const PRESETS = [
  {
    id: "ring-protection", label: "Pierścień ochrony", hint: "+1 KP, +1 rzuty obronne",
    item: { name: "Pierścień ochrony", type: "equipment", subtype: "ring", rarity: "rare", attunement: "required",
      magical: true,
      description: "Noszący ten pierścień zyskuje +1 do KP i rzutów obronnych." },
    effects: [effect("Ochrona", [row("ac", "add"), row("saves", "bonus")])]
  },
  {
    id: "cloak-protection", label: "Płaszcz ochrony", hint: "+1 KP, +1 rzuty obronne",
    item: { name: "Płaszcz ochrony", type: "equipment", subtype: "clothing", rarity: "uncommon",
      attunement: "required", magical: true,
      description: "Noszący ten płaszcz zyskuje +1 do KP i rzutów obronnych." },
    effects: [effect("Ochrona", [row("ac", "add"), row("saves", "bonus")])]
  },
  {
    id: "gauntlets-ogre", label: "Rękawice siły ogra", hint: "Siła co najmniej 19",
    item: { name: "Rękawice siły ogra", type: "equipment", subtype: "wondrous", rarity: "uncommon",
      attunement: "required", magical: true,
      description: "Siła noszącego wynosi 19, chyba że jest już wyższa." },
    effects: [effect("Siła ogra", [row("abl-str", "upgrade", { num: 19 })])]
  },
  {
    id: "goggles-night", label: "Gogle nocy", hint: "Widzenie w ciemności 60 ft",
    item: { name: "Gogle nocy", type: "equipment", subtype: "wondrous", rarity: "uncommon", magical: true,
      description: "Noszący widzi w ciemności na 60 stóp." },
    effects: [effect("Widzenie w ciemności", [row("sense-darkvision", "upgrade", { num: 60 })])]
  },
  {
    id: "boots-speed", label: "Buty szybkości", hint: "Szybkość ×2 na 10 minut",
    item: { name: "Buty szybkości", type: "equipment", subtype: "wondrous", rarity: "rare", attunement: "required",
      magical: true,
      description: "Akcją dodatkową noszący podwaja swoją szybkość na 10 minut." },
    effects: [effect("Szybkość", [row("move-walk", "multiply", { num: 2 })], {
      mode: "timed", duration: { value: 10, units: "minutes", expiry: "turnStart" }
    })],
    usage: { kind: "utility", activation: "bonus" }
  },
  {
    id: "potion-healing", label: "Mikstura leczenia", hint: "2k4+2 PW, jednorazowa",
    item: { name: "Mikstura leczenia", type: "consumable", subtype: "potion", rarity: "common", magical: true,
      description: "Pijący odzyskuje 2k4 + 2 punkty wytrzymałości." },
    effects: [],
    usage: { kind: "heal", activation: "action", heal: { count: 2, die: 4, bonus: "2" } },
    uses: { enabled: true, max: 1, recovery: "", formula: "", autoDestroy: true },
    // Zasady 2024: wypicie mikstury to akcja dodatkowa.
    rules: { "2024": { usage: { activation: "bonus" } } }
  },
  {
    id: "potion-giant", label: "Mikstura siły olbrzyma", hint: "Siła 21 na 1 godzinę",
    item: { name: "Mikstura siły olbrzyma wzgórz", type: "consumable", subtype: "potion", rarity: "uncommon",
      magical: true,
      description: "Przez godzinę Siła pijącego wynosi 21." },
    effects: [effect("Siła olbrzyma", [row("abl-str", "upgrade", { num: 21 })], {
      mode: "timed", duration: { value: 1, units: "hours", expiry: "turnStart" }
    })],
    usage: { kind: "utility", activation: "action" },
    uses: { enabled: true, max: 1, recovery: "", formula: "", autoDestroy: true },
    // Zasady 2024: wypicie mikstury to akcja dodatkowa.
    rules: { "2024": { usage: { activation: "bonus" } } }
  },
  {
    id: "wand-cure", label: "Różdżka leczenia", hint: "7 ładunków, 1k6+1 o świcie",
    item: { name: "Różdżka leczenia", type: "equipment", subtype: "wand", rarity: "rare", attunement: "required",
      magical: true,
      description: "Wydaj ładunek, aby przywrócić 2k4 + 2 PW istocie, której dotykasz." },
    effects: [],
    usage: { kind: "heal", activation: "action", heal: { count: 2, die: 4, bonus: "2" }, scaling: true },
    uses: { enabled: true, max: 7, recovery: "dawn", formula: "1d6+1", autoDestroy: false }
  },
  {
    id: "weapon-plus1", label: "Broń +1", hint: "+1 do trafienia i obrażeń",
    item: { name: "Długi miecz +1", type: "weapon", subtype: "martialM", rarity: "uncommon", magical: true,
      magicalBonus: 1,
      damage: { count: 1, die: 8, type: "slashing" },
      description: "Magiczna broń daje +1 do trafienia i obrażeń." },
    effects: []
  },
  {
    id: "amulet-resist-fire", label: "Amulet odporności na ogień", hint: "Odporność na ogień",
    item: { name: "Amulet odporności na ogień", type: "equipment", subtype: "wondrous", rarity: "uncommon",
      attunement: "required", magical: true,
      description: "Noszący ma odporność na obrażenia od ognia." },
    effects: [effect("Odporność na ogień", [row("dr", "grant", { tags: ["fire"] })])]
  }
];

/**
 * Dodaje szablon przedmiotu (API dla innych modułów i MG). Szablon o tym samym `id` zostaje zastąpiony.
 * @param {object} preset  { id, label, hint, item: {...}, effects?: [], usage?: {}, uses?: {} }
 */
export function registerPreset(preset) {
  if ( !preset?.id || !preset.item?.type ) throw new Error("…and Taverns, Oh My!: registerPreset wymaga id i item.type.");
  const i = PRESETS.findIndex(p => p.id === preset.id);
  if ( i >= 0 ) PRESETS.splice(i, 1);
  PRESETS.push({ effects: [], ...preset });
}
