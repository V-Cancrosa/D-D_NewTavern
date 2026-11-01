import NewTavernWizard from "./wizard.js";

const MODULE_ID = "new-tavern";
const ICON = "fa-solid fa-wand-magic-sparkles";

const EDITABLE_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "feat"]);

/** Otwiera kreator (tylko MG). */
export function openWizard(actor = null) {
  if ( !game.user.isGM ) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
  try {
    return new NewTavernWizard({ actor }).render(true);
  } catch(err) {
    console.error(`${MODULE_ID} |`, err);
    ui.notifications.error(game.i18n.format("GMEI.Errors.OpenFailed", { error: err.message }));
  }
}

/** Otwiera edytor istniejącego przedmiotu (tylko MG). */
export function openEditor(item) {
  if ( !game.user.isGM ) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
  if ( !item || !EDITABLE_TYPES.has(item.type) ) return item?.sheet.render(true);
  try {
    return new NewTavernWizard({ item }).render(true);
  } catch(err) {
    console.error(`${MODULE_ID} |`, err);
    ui.notifications.error(game.i18n.format("GMEI.Errors.OpenFailed", { error: err.message }));
  }
}

const canEdit = item => game.user.isGM && item && EDITABLE_TYPES.has(item.type) && !item.compendium?.locked;

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "createEffectItem", {
    name: "GMEI.Settings.MenuName", label: "GMEI.Settings.MenuLabel",
    hint: "GMEI.Settings.MenuHint", icon: ICON,
    type: NewTavernWizard, restricted: true
  });
  game.settings.register(MODULE_ID, "replaceEdit", {
    name: "GMEI.Settings.ReplaceEditName", hint: "GMEI.Settings.ReplaceEditHint",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = { open: openWizard, edit: openEditor, NewTavernWizard };
  if ( !game.user.isGM ) return;
  const gen = game.release?.generation ?? 0;
  if ( gen < 13 ) ui.notifications.warn(game.i18n.localize("GMEI.Errors.UnsupportedCore"));
  if ( game.system.id !== "dnd5e" ) ui.notifications.warn(game.i18n.localize("GMEI.Errors.UnsupportedSystem"));
  else if ( foundry.utils.isNewerVersion(game.system.version, "5.99.99") && (gen < 14) ) {
    ui.notifications.warn(game.i18n.localize("GMEI.Errors.Dnd6NeedsV14"));
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
  button.dataset.tooltip = game.i18n.localize("GMEI.SheetButton");
  button.setAttribute("aria-label", game.i18n.localize("GMEI.SheetButton"));
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
  const name = game.i18n.localize("GMEI.DirectoryAction");
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
  const label = game.i18n.localize("GMEI.EditInWizard");
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
  const native = menuEntry(game.i18n.localize("GMEI.EditNative"), "fa-solid fa-file-lines", () => item.sheet.render(true));
  menuItems.splice(index + 1, 0, native);
  if ( "onClick" in edit ) edit.onClick = () => openEditor(item);
  if ( "callback" in edit ) edit.callback = () => openEditor(item);
  edit.icon = v14() ? ICON : `<i class="${ICON} fa-fw"></i>`;
});

/** Menu kontekstowe przedmiotu w katalogu przedmiotów. */
function addItemDirectoryContext(_app, options) {
  if ( !game.user.isGM ) return;
  const label = game.i18n.localize("GMEI.EditInWizard");
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
  button.dataset.tooltip = game.i18n.localize("GMEI.EditInWizard");
  button.setAttribute("aria-label", game.i18n.localize("GMEI.EditInWizard"));
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openEditor(item);
  });
  const close = header.querySelector('[data-action="close"]');
  if ( close ) close.before(button);
  else header.append(button);
});
