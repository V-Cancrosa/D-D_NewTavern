/**
 * Przeklęte przedmioty i identyfikacja sterowana przez MG.
 *
 * Klątwa żyje we flagach przedmiotu (`flags.new-tavern.curse`):
 *   { active, revealed, sticky, note, status, effectId }
 * - sticky: gracz nie może zdjąć, odłączyć dostrojenia ani wyrzucić przedmiotu, dopóki klątwa trwa,
 * - status: przedmiot nakłada na postać stan „przeklęty” z dnd5e (osobny efekt oznaczony flagą),
 * - note: opis klątwy widoczny tylko w kreatorze MG.
 */

export const MODULE_ID = "new-tavern";
const BRAND = "Taverns, Oh My!";

/** Klątwa przedmiotu albo null. */
export function getCurse(item) {
  const c = item?.flags?.[MODULE_ID]?.curse ?? item?.getFlag?.(MODULE_ID, "curse");
  return c?.active ? c : null;
}

/** Czy efekt to efekt klątwy dodany przez moduł (nie pokazujemy go w zwykłych efektach kreatora). */
export const isCurseEffect = effect => !!(effect?.flags?.[MODULE_ID]?.curseEffect
  ?? effect?.getFlag?.(MODULE_ID, "curseEffect"));

/** Dane efektu „Klątwa” nadającego stan „przeklęty”. */
export function curseEffectData(curse, img) {
  const data = {
    _id: curse.effectId || foundry.utils.randomID(),
    name: "Klątwa",
    img: CONFIG.statusEffects?.find?.(s => s.id === "cursed")?.img ?? img ?? "icons/svg/skull.svg",
    transfer: true,
    disabled: false,
    statuses: ["cursed"],
    flags: { [MODULE_ID]: { curseEffect: true } }
  };
  if ( (game.release?.generation ?? 13) >= 14 ) Object.assign(data, { type: "base", system: { changes: [] } });
  else data.changes = [];
  return data;
}

const gmIds = () => game.users.filter(u => u.isGM && u.active).map(u => u.id);

/** Szepcze do MG (np. prośba o identyfikację). */
function whisperGM(content) {
  const whisper = gmIds();
  if ( !whisper.length ) return;
  ChatMessage.implementation.create({ content, whisper, speaker: ChatMessage.implementation.getSpeaker() });
}

const isWorn = item => !!(item.system?.equipped || item.system?.attuned);

/* -------------------------------------------- */
/*  Blokady dla graczy                          */
/* -------------------------------------------- */

export function registerCurseHooks() {
  Hooks.on("preUpdateItem", (item, changes) => {
    if ( game.user.isGM ) return;

    // Identyfikacja tylko przez MG
    if ( game.settings.get(MODULE_ID, "gmIdentify")
      && (foundry.utils.getProperty(changes, "system.identified") === true) && (item.system?.identified === false) ) {
      ui.notifications.info("Tylko MG może zidentyfikować ten przedmiot. Wysłano prośbę do MG.");
      whisperGM(`<p><b>${game.user.name}</b> chce zidentyfikować przedmiot <b>${item.name}</b>`
        + `${item.actor ? ` (${item.actor.name})` : ""}.</p><p>Na karcie postaci: ⋮ przy przedmiocie → „Zidentyfikuj (MG)”.</p>`);
      return false;
    }

    // Klątwa: nie da się zdjąć ani odłączyć
    const curse = getCurse(item);
    if ( !curse?.sticky || !item.actor ) return;
    const unequip = (foundry.utils.getProperty(changes, "system.equipped") === false) && item.system?.equipped;
    const unattune = (foundry.utils.getProperty(changes, "system.attuned") === false) && item.system?.attuned;
    if ( unequip || unattune ) {
      ui.notifications.warn(`Coś nie pozwala ci ${unattune ? "zerwać więzi z przedmiotem" : "zdjąć przedmiotu"} „${item.name}”.`);
      whisperGM(`<p><b>${item.actor.name}</b> próbował(a) ${unattune ? "odłączyć" : "zdjąć"} przeklęty przedmiot <b>${item.name}</b>.</p>`);
      return false;
    }
  });

  Hooks.on("preDeleteItem", item => {
    if ( game.user.isGM ) return;
    const curse = getCurse(item);
    if ( curse?.sticky && item.actor && isWorn(item) ) {
      ui.notifications.warn(`Coś nie pozwala ci pozbyć się przedmiotu „${item.name}”.`);
      whisperGM(`<p><b>${item.actor.name}</b> próbował(a) pozbyć się przeklętego przedmiotu <b>${item.name}</b>.</p>`);
      return false;
    }
  });
}

/* -------------------------------------------- */
/*  Akcje MG                                    */
/* -------------------------------------------- */

/** Identyfikuje przedmiot; opcjonalnie od razu ujawnia klątwę. */
export async function identifyItem(item, { revealCurse = false } = {}) {
  const update = { "system.identified": true };
  const curse = getCurse(item);
  if ( revealCurse && curse ) update[`flags.${MODULE_ID}.curse.revealed`] = true;
  await item.update(update);
  if ( revealCurse && curse ) await announceCurse(item);
}

/** Ujawnia klątwę właścicielom przedmiotu (wiadomość na czacie). */
export async function revealCurse(item) {
  await item.update({ [`flags.${MODULE_ID}.curse.revealed`]: true });
  await announceCurse(item);
}

async function announceCurse(item) {
  const owners = item.actor ? game.users.filter(u => item.actor.testUserPermission(u, "OWNER")).map(u => u.id) : [];
  const whisper = [...new Set([...owners, ...gmIds()])];
  await ChatMessage.implementation.create({ whisper,
    content: `<p><b>${item.name}</b> jest przeklęty.</p>` });
}

/** Zdejmuje klątwę (np. czar Remove Curse): koniec blokady i stanu „przeklęty”. */
export async function removeCurse(item) {
  const effects = item.effects.filter(isCurseEffect).map(e => e.id);
  if ( effects.length ) await item.deleteEmbeddedDocuments("ActiveEffect", effects);
  await item.update({ [`flags.${MODULE_ID}.curse.active`]: false });
  ui.notifications.info(`Klątwa zdjęta z „${item.name}”.`);
}

/** Pozycje menu ⋮ przedmiotu dla MG. */
export function curseMenuEntries(item, menuEntry) {
  if ( !game.user.isGM ) return [];
  const entries = [];
  const curse = getCurse(item);
  if ( item.system?.identified === false ) {
    entries.push(menuEntry("Zidentyfikuj (MG)", "fa-solid fa-magnifying-glass", () => identifyItem(item)));
    if ( curse && !curse.revealed ) entries.push(menuEntry("Zidentyfikuj i ujawnij klątwę", "fa-solid fa-skull",
      () => identifyItem(item, { revealCurse: true })));
  }
  if ( curse && !curse.revealed ) entries.push(menuEntry("Ujawnij klątwę", "fa-solid fa-eye", () => revealCurse(item)));
  if ( curse ) entries.push(menuEntry("Zdejmij klątwę", "fa-solid fa-hand-sparkles", () => removeCurse(item)));
  return entries;
}

/** Ikona czaszki przy przeklętych przedmiotach na karcie postaci (tylko dla MG). */
export function markCursedRows(app, root) {
  if ( !game.user.isGM || !app.actor || !root?.querySelectorAll ) return;
  for ( const row of root.querySelectorAll("[data-item-id]") ) {
    const item = app.actor.items.get(row.dataset.itemId);
    const curse = getCurse(item);
    if ( !curse || row.querySelector(".nt-curse-mark") ) continue;
    const name = row.querySelector(".item-name .title, .item-name h4, .name .title, .item-name") ?? row;
    const mark = document.createElement("i");
    mark.className = "fa-solid fa-skull nt-curse-mark";
    mark.dataset.tooltip = `Przeklęty${curse.revealed ? " (ujawniony)" : " – gracz nie wie"}${curse.sticky ? ", nie da się zdjąć" : ""}`;
    name.append(mark);
  }
}

export { BRAND };
