/**
 * Przedmioty bazowe (długi miecz, zbroja łuskowa…) z konfiguracji dnd5e – tak samo jak w karcie systemu.
 */

const cache = new Map();

/** Identyfikatory przedmiotów bazowych dla typu przedmiotu. */
function baseIds(type) {
  const D = CONFIG.DND5E ?? {};
  if ( type === "equipment" ) return { ...(D.armorIds ?? {}), ...(D.shieldIds ?? {}) };
  return D[`${type}Ids`] ?? null;
}

/** Wpis przedmiotu bazowego (indeks kompendium) – przez API systemu, z zapasowym `fromUuid`. */
async function getBase(id, options = {}) {
  const Trait = globalThis.dnd5e?.documents?.Trait;
  try {
    if ( Trait?.getBaseItem ) return await Trait.getBaseItem(id, options);
    return await fromUuid(id);
  } catch(err) {
    console.warn("new-tavern | Brak przedmiotu bazowego", id, err);
    return null;
  }
}

/**
 * Opcje przedmiotów bazowych pasujące do typu i podtypu (np. broń wojskowa do walki wręcz).
 * @returns {Promise<{value: string, label: string}[]>}
 */
export async function getBaseItemOptions(type, subtype) {
  const ids = baseIds(type);
  if ( !ids || !subtype ) return [];
  const key = `${type}:${subtype}`;
  if ( cache.has(key) ) return cache.get(key);
  const options = [];
  for ( const [value, id] of Object.entries(ids) ) {
    const base = await getBase(id);
    if ( base?.system?.type?.value !== subtype ) continue;
    options.push({ value, label: base.name });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang ?? "pl"));
  cache.set(key, options);
  return options;
}

/**
 * Dane z przedmiotu bazowego do uzupełnienia kreatora (obrażenia, KP, właściwości, zasięg, waga, cena).
 * @returns {Promise<object|null>}  Fragment `state.item`.
 */
export async function loadBaseItem(type, key) {
  const id = baseIds(type)?.[key];
  if ( !id ) return null;
  const doc = await getBase(id, { fullItem: true });
  const sys = doc?.system;
  if ( !sys ) return null;
  const patch = {
    baseItem: key,
    properties: [...(sys.properties ?? [])],
    weight: Number(sys.weight?.value ?? sys.weight) || 0,
    price: Number(sys.price?.value) || 0,
    priceDenomination: sys.price?.denomination ?? "gp",
    proficient: sys.proficient ?? null
  };
  if ( type === "weapon" ) {
    const b = sys.damage?.base ?? {};
    const v = sys.damage?.versatile ?? {};
    Object.assign(patch, {
      damage: { count: b.number ?? 1, die: b.denomination ?? 6, type: [...(b.types ?? [])][0] ?? "slashing" },
      versatile: { count: v.number ?? 0, die: v.denomination ?? 0 },
      range: { value: sys.range?.value ?? null, long: sys.range?.long ?? null, reach: sys.range?.reach ?? null,
        units: sys.range?.units ?? "ft" },
      mastery: sys.mastery ?? ""
    });
  }
  if ( type === "equipment" ) Object.assign(patch, {
    armor: { value: sys.armor?.value ?? 0, dex: sys.armor?.dex ?? "", strength: sys.strength ?? 0 }
  });
  return patch;
}
