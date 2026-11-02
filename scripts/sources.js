/**
 * Wersja zasad (2014/2024) i przedmioty z kompendiów (SRD 5.1, SRD 5.2, podręczniki z innych modułów).
 */

/** Wersja zasad ustawiona w świecie: „2024” (modern) albo „2014” (legacy). */
export function worldRules() {
  const v = globalThis.dnd5e?.settings?.rulesVersion
    ?? (() => { try { return game.settings.get("dnd5e", "rulesVersion"); } catch { return "modern"; } })();
  return v === "legacy" ? "2014" : "2024";
}

/** Kolejność rzadkości do sortowania. */
const RARITY_ORDER = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

/** Wersja zasad całego kompendium na podstawie metadanych dnd5e (SRD 5.1 → 2014, SRD 5.2 → 2024). */
function packRules(pack) {
  const book = pack.metadata?.flags?.dnd5e?.sourceBook ?? "";
  if ( /5\.1/.test(book) ) return "2014";
  if ( /5\.2/.test(book) ) return "2024";
  return "";
}

let indexPromise = null;

/**
 * Wczytuje (raz) indeks wszystkich kompendiów z przedmiotami.
 * @returns {Promise<object[]>}  { uuid, name, img, type, rarity, rules, magical, price, denomination, pack }
 */
export function loadIndex({ force = false } = {}) {
  if ( indexPromise && !force ) return indexPromise;
  const fields = ["type", "img", "system.rarity", "system.source.rules", "system.properties", "system.price"];
  indexPromise = (async () => {
    const out = [];
    for ( const pack of game.packs ?? [] ) {
      if ( pack.documentName !== "Item" ) continue;
      let index;
      try {
        index = await pack.getIndex({ fields });
      } catch(err) {
        console.warn("new-tavern | Nie udało się wczytać kompendium", pack.collection, err);
        continue;
      }
      const fallbackRules = packRules(pack);
      for ( const e of index ) {
        const props = e.system?.properties;
        const magical = Array.isArray(props) ? props.includes("mgc") : !!props?.has?.("mgc");
        out.push({
          uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`,
          name: e.name, img: e.img, type: e.type,
          rarity: e.system?.rarity ?? "",
          rules: e.system?.source?.rules || fallbackRules,
          magical: magical || !!e.system?.rarity,
          price: Number(e.system?.price?.value) || 0,
          denomination: e.system?.price?.denomination ?? "gp",
          pack: pack.metadata?.label ?? pack.collection
        });
      }
    }
    return out;
  })();
  return indexPromise;
}

/**
 * Wyszukuje przedmioty magiczne danego typu, zgodne z wersją zasad (lub bez określonej wersji).
 * @param {object[]} index
 * @param {object} options
 */
export function searchIndex(index, { type, rules, query = "", limit = 40 } = {}) {
  const q = query.trim().toLocaleLowerCase();
  const hits = index.filter(e => (e.type === type) && e.magical && (!e.rules || !rules || (e.rules === rules))
    && (!q || e.name.toLocaleLowerCase().includes(q)));
  hits.sort((a, b) => (RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    || a.name.localeCompare(b.name, game.i18n?.lang ?? "pl"));
  return { total: hits.length, results: hits.slice(0, limit) };
}

/**
 * Mediana ceny (w sztukach złota) przedmiotów o tej samej rzadkości i wersji zasad.
 * @returns {{ median: number, count: number }|null}
 */
export function medianPrice(index, { rarity, rules, consumable = null } = {}) {
  if ( !rarity ) return null;
  const values = index.filter(e => (e.rarity === rarity) && e.price && (e.denomination === "gp")
    && (!rules || !e.rules || (e.rules === rules))
    && ((consumable === null) || ((e.type === "consumable") === consumable)))
    .map(e => e.price).sort((a, b) => a - b);
  if ( !values.length ) return null;
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
  return { median, count: values.length };
}
