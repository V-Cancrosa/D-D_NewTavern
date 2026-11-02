/**
 * Polskie etykiety dla wartości z dnd5e. Gdy czegoś tu brakuje, używamy etykiety systemu.
 */

export const PL = {
  rarity: { common: "pospolity", uncommon: "niepospolity", rare: "rzadki", veryRare: "bardzo rzadki",
    legendary: "legendarny", artifact: "artefakt" },
  attunement: { required: "wymagane", optional: "opcjonalne" },
  activation: { action: "akcja", bonus: "akcja dodatkowa", reaction: "reakcja", minute: "minuta",
    hour: "godzina", special: "specjalne" },
  periods: { lr: "po długim odpoczynku", sr: "po krótkim odpoczynku", day: "codziennie", dawn: "o świcie",
    dusk: "o zmierzchu" },
  subtypes: {
    // wyposażenie
    light: "zbroja lekka", medium: "zbroja średnia", heavy: "zbroja ciężka", natural: "naturalna",
    shield: "tarcza", clothing: "ubranie", ring: "pierścień", rod: "berło", trinket: "drobiazg",
    vehicle: "wyposażenie pojazdu", wand: "różdżka", wondrous: "cudowny przedmiot",
    // broń
    simpleM: "prosta do walki wręcz", simpleR: "prosta dystansowa", martialM: "wojskowa do walki wręcz",
    martialR: "wojskowa dystansowa", improv: "improwizowana", siege: "oblężnicza",
    // materiały eksploatacyjne
    ammo: "amunicja", potion: "mikstura", poison: "trucizna", food: "jedzenie", scroll: "zwój",
    // narzędzia
    art: "narzędzia rzemieślnicze", game: "gra", music: "instrument",
    // łup
    gear: "ekwipunek", gem: "klejnot", junk: "rupieć", material: "materiał", resource: "surowiec",
    trade: "towar", treasure: "skarb"
  },
  damage: { acid: "kwas", bludgeoning: "obuchowe", cold: "zimno", fire: "ogień", force: "moc",
    lightning: "błyskawice", necrotic: "nekrotyczne", piercing: "kłute", poison: "trucizna",
    psychic: "psychiczne", radiant: "promieniste", slashing: "cięte", thunder: "grom",
    healing: "leczenie", temphp: "tymczasowe PW" },
  conditions: { blinded: "oślepiony", charmed: "zauroczony", deafened: "ogłuszony", exhaustion: "wyczerpanie",
    frightened: "przestraszony", grappled: "pochwycony", incapacitated: "obezwładniony", invisible: "niewidzialny",
    paralyzed: "sparaliżowany", petrified: "spetryfikowany", poisoned: "zatruty", prone: "powalony",
    restrained: "unieruchomiony", stunned: "oszołomiony", unconscious: "nieprzytomny", bleeding: "krwawiący",
    burning: "płonący", cursed: "przeklęty", diseased: "chory", silenced: "uciszony", surprised: "zaskoczony",
    transformed: "przemieniony", dehydration: "odwodnienie", malnutrition: "niedożywienie", falling: "spadający",
    suffocation: "duszący się" },
  statuses: { burrowing: "kopiący", concentrating: "koncentracja", coverHalf: "osłona połowiczna",
    coverThreeQuarters: "osłona ¾", coverTotal: "osłona pełna", dead: "martwy", dodging: "unik",
    ethereal: "eteryczny", flying: "latający", hiding: "ukryty", hovering: "unoszący się", marked: "naznaczony",
    sleeping: "śpiący", stable: "ustabilizowany" },
  abilities: { str: "Siła", dex: "Zręczność", con: "Kondycja", int: "Inteligencja", wis: "Mądrość", cha: "Charyzma" },
  skills: { acr: "Akrobatyka", ani: "Opieka nad zwierzętami", arc: "Wiedza tajemna", ath: "Atletyka",
    dec: "Oszustwo", his: "Historia", ins: "Intuicja", itm: "Zastraszanie", inv: "Śledztwo", med: "Medycyna",
    nat: "Przyroda", prc: "Percepcja", prf: "Występy", per: "Perswazja", rel: "Religia",
    slt: "Zwinne dłonie", ste: "Ukrywanie się", sur: "Sztuka przetrwania" }
};

const sys = v => game.i18n.localize(typeof v === "string" ? v : (v?.label ?? v?.name ?? ""));

/** Etykieta po polsku z zapasową etykietą systemu. */
export function pl(group, key, systemValue) {
  return PL[group]?.[key] ?? (systemValue !== undefined ? sys(systemValue) : key);
}

/** Lista opcji {value,label,selected} z obiektu konfiguracji dnd5e, z polskimi etykietami. */
export function plOptions(group, source, selected) {
  return Object.entries(source ?? {})
    .map(([value, cfg]) => ({ value, label: pl(group, value, cfg), selected: value === selected }));
}

/** Zapis kości: „1k6+1” → „1d6+1” (dla systemu) i odwrotnie (dla użytkownika). */
export const toSystemDice = f => String(f ?? "").replace(/(\d*)\s*[kK](\d+)/g, "$1d$2");
export const toPolishDice = f => String(f ?? "").replace(/(\d*)d(\d+)/g, "$1k$2");
