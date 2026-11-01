import NewTavernWizard from "./wizard.js";

const MODULE_ID = "new-tavern";
const ICON = "fa-solid fa-wand-magic-sparkles";

/** Pokazuje błąd otwarcia kreatora z treścią wyjątku (bez zależności od plików językowych). */
function reportOpenError(err) {
  console.error(`${MODULE_ID} | Nie udało się otworzyć kreatora`, err);
  ui.notifications.error(`New Tavern: nie udało się otworzyć kreatora: ${err?.message ?? err}`, { permanent: true });
}

const EDITABLE_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "feat"]);

/** Otwiera kreator (tylko MG). */
export function openWizard(actor = null) {
  if ( !game.user.isGM ) return ui.notifications.warn("Tylko MG może tworzyć i edytować przedmioty w New Tavern.");
  try {
    const app = new NewTavernWizard({ actor });
    app.render({ force: true })?.catch?.(reportOpenError);
    return app;
  } catch(err) {
    reportOpenError(err);
  }
}

/** Otwiera edytor istniejącego przedmiotu (tylko MG). */
export function openEditor(item) {
  if ( !game.user.isGM ) return ui.notifications.warn("Tylko MG może tworzyć i edytować przedmioty w New Tavern.");
  if ( !item || !EDITABLE_TYPES.has(item.type) ) return item?.sheet.render(true);
  try {
    const app = new NewTavernWizard({ item });
    app.render({ force: true })?.catch?.(reportOpenError);
    return app;
  } catch(err) {
    reportOpenError(err);
  }
}

const canEdit = item => game.user.isGM && item && EDITABLE_TYPES.has(item.type) && !item.compendium?.locked;

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "createEffectItem", {
    name: "Kreator przedmiotów", label: "Otwórz kreator",
    hint: "Jako MG utwórz przedmiot z efektami, czasem trwania, aktywnością i ładunkami – bez znajomości kluczy dnd5e.",
    icon: ICON,
    type: NewTavernWizard, restricted: true
  });
  game.settings.register(MODULE_ID, "replaceEdit", {
    name: "„Edit” otwiera edytor New Tavern",
    hint: "Dla MG: pozycja „Edit” w menu przedmiotu na karcie postaci otwiera edytor New Tavern. Oryginalna karta przedmiotu jest pod pozycją „Karta systemu”.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = { open: openWizard, edit: openEditor, NewTavernWizard };
  if ( !game.user.isGM ) return;
  const gen = game.release?.generation ?? 0;
  if ( gen < 13 ) ui.notifications.warn("New Tavern wspiera Foundry VTT 13 i 14.");
  if ( game.system.id !== "dnd5e" ) ui.notifications.warn("New Tavern wymaga systemu D&D5e.");
  else if ( foundry.utils.isNewerVersion(game.system.version, "5.99.99") && (gen < 14) ) {
    ui.notifications.warn("D&D5e 6.x wymaga Foundry VTT 14; na Foundry 13 użyj D&D5e 5.x.");
  }
});

/* -------------------------------------------- */
/*  Przyciski                                   */
/* -------------------------------------------- */

const asElement = html => (html instanceof HTMLElement ? html : html?.[0]);

/** Przycisk w nagłówku karty postaci. */
function addSheetButton(app, html) {
  if ( !game.user.isGM || !app.actor ) return;
  const header = asElement(html)?.closest?.(".app, .application")?.querySelector(".window-header")
    ?? asElement(html)?.querySelector(".window-header") ?? app.element?.querySelector?.(".window-header");
  if ( !header || header.querySelector("[data-new-tavern]") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `header-control icon ${ICON}`;
  button.dataset.newTavern = "true";
  button.dataset.tooltip = "New Tavern: nowy przedmiot dla tej postaci";
  button.setAttribute("aria-label", "New Tavern: nowy przedmiot dla tej postaci");
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openWizard(app.actor);
  });
  const close = header.querySelector('[data-action="close"]');
  if ( close ) close.before(button);
  else header.append(button);
}
Hooks.on("renderActorSheet", addSheetButton);
Hooks.on("renderActorSheetV2", addSheetButton);

/** Przycisk obok „Create Item” w katalogu przedmiotów. */
Hooks.on("renderItemDirectory", (app, html) => {
  if ( !game.user.isGM ) return;
  const root = asElement(html);
  const actions = root?.querySelector(".header-actions");
  if ( !actions || actions.querySelector("[data-new-tavern]") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "new-tavern-directory-button";
  button.dataset.newTavern = "true";
  button.innerHTML = `<i class="${ICON}" inert></i> New Tavern`;
  button.addEventListener("click", () => openWizard());
  actions.append(button);
});

/** Opcja w menu kontekstowym postaci w katalogu aktorów. */
function addActorContext(_app, options) {
  if ( !game.user.isGM ) return;
  const actorFrom = li => {
    const el = asElement(li);
    const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
    return game.actors.get(id);
  };
  const name = "New Tavern: nowy przedmiot";
  if ( options.some(o => (o.name ?? o.label) === name) ) return;
  const v14 = (game.release?.generation ?? 13) >= 14;
  options.push({
    name, label: name,
    icon: v14 ? ICON : `<i class="${ICON}"></i>`,
    condition: li => !!actorFrom(li),
    visible: target => !!actorFrom(target),
    callback: li => openWizard(actorFrom(li)),
    onClick: (_event, target) => openWizard(actorFrom(target))
  });
}
Hooks.on("getActorContextOptions", addActorContext);
Hooks.on("getActorDirectoryEntryContext", addActorContext);

/* -------------------------------------------- */
/*  Edycja istniejących przedmiotów             */
/* -------------------------------------------- */

const v14 = () => (game.release?.generation ?? 13) >= 14;

/** Pozycja menu kontekstowego w formacie właściwym dla wersji Foundry. */
function menuEntry(label, icon, run, visible = () => true) {
  return {
    name: label, label,
    icon: v14() ? icon : `<i class="${icon} fa-fw"></i>`,
    condition: li => visible(li), visible: target => visible(target),
    callback: li => run(li), onClick: (_event, target) => run(target)
  };
}

/** Menu „⋮” przedmiotu na karcie postaci (dnd5e). */
Hooks.on("dnd5e.getItemContextOptions", (item, menuItems) => {
  if ( !canEdit(item) ) return;
  const label = "Edytuj w New Tavern";
  if ( !game.settings.get(MODULE_ID, "replaceEdit") ) {
    menuItems.push(menuEntry(label, ICON, () => openEditor(item)));
    return;
  }
  const edit = menuItems.find(m => (m.label ?? m.name) === "DND5E.ContextMenuActionEdit");
  if ( !edit ) {
    menuItems.push(menuEntry(label, ICON, () => openEditor(item)));
    return;
  }
  // „Edit” otwiera kreator; oryginalna karta systemu zostaje pod osobną pozycją.
  const index = menuItems.indexOf(edit);
  const native = menuEntry("Karta systemu", "fa-solid fa-file-lines", () => item.sheet.render(true));
  menuItems.splice(index + 1, 0, native);
  if ( "onClick" in edit ) edit.onClick = () => openEditor(item);
  if ( "callback" in edit ) edit.callback = () => openEditor(item);
  edit.icon = v14() ? ICON : `<i class="${ICON} fa-fw"></i>`;
});

/** Menu kontekstowe przedmiotu w katalogu przedmiotów. */
function addItemDirectoryContext(_app, options) {
  if ( !game.user.isGM ) return;
  const label = "Edytuj w New Tavern";
  if ( options.some(o => (o.name ?? o.label) === label) ) return;
  const itemFrom = li => {
    const el = asElement(li);
    return game.items.get(el?.dataset?.entryId ?? el?.dataset?.documentId);
  };
  options.push(menuEntry(label, ICON, li => openEditor(itemFrom(li)), li => canEdit(itemFrom(li))));
}
Hooks.on("getItemContextOptions", addItemDirectoryContext);
Hooks.on("getItemDirectoryEntryContext", addItemDirectoryContext);

/** Przycisk w nagłówku karty przedmiotu. */
Hooks.on("renderDocumentSheetV2", (app, html) => {
  const item = app.document;
  if ( !(item instanceof Item) || !canEdit(item) ) return;
  const header = app.element?.querySelector?.(".window-header");
  if ( !header || header.querySelector("[data-new-tavern]") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `header-control icon ${ICON}`;
  button.dataset.newTavern = "true";
  button.dataset.tooltip = "Edytuj w New Tavern";
  button.setAttribute("aria-label", "Edytuj w New Tavern");
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openEditor(item);
  });
  const close = header.querySelector('[data-action="close"]');
  if ( close ) close.before(button);
  else header.append(button);
});
