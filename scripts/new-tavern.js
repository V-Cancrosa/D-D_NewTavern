import NewTavernWizard from "./wizard.js";

const MODULE_ID = "new-tavern";
const ICON = "fa-solid fa-wand-magic-sparkles";

/** Otwiera kreator (tylko MG). */
export function openWizard(actor = null) {
  if ( !game.user.isGM ) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
  return new NewTavernWizard({ actor }).render(true);
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "createEffectItem", {
    name: "GMEI.Settings.MenuName", label: "GMEI.Settings.MenuLabel",
    hint: "GMEI.Settings.MenuHint", icon: ICON,
    type: NewTavernWizard, restricted: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = { open: openWizard, NewTavernWizard };
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
  button.innerHTML = `<i class="${ICON}" inert></i> ${game.i18n.localize("GMEI.DirectoryButton")}`;
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
