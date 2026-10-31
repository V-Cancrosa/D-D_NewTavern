const MODULE_ID = "new-tavern";
const BaseForm = foundry.appv1?.api?.FormApplication ?? globalThis.FormApplication;

class GmEffectItemForm extends BaseForm {
  constructor(options = {}) {
    super({}, options);
    this.targetActor = options.actor ?? null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "new-tavern-form",
      classes: [MODULE_ID],
      title: game.i18n.localize("GMEI.Form.Title"),
      template: \`modules/\${MODULE_ID}/templates/item-form.hbs\`,
      width: 620,
      height: "auto",
      closeOnSubmit: true
    });
  }

  getData() {
    return {
      actors: game.actors.filter(a => a.isOwner).map(a => ({
        id: a.id, name: a.name, selected: a.id === this.targetActor?.id
      })),
      types: ["loot", "equipment", "weapon", "consumable", "tool", "feat"],
      modes: Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([label, value]) => ({label, value}))
    };
  }

  async _updateObject(_event, formData) {
    if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
    const data = foundry.utils.expandObject(formData);
    const actor = game.actors.get(data.actorId);
    if (!actor) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.NoActor"));
    const effect = {
      name: data.effect?.name?.trim() || data.name,
      icon: data.effect?.icon?.trim() || "icons/svg/aura.svg",
      transfer: Boolean(data.effect?.transfer),
      changes: data.effect?.key?.trim() && data.effect.value !== ""
        ? [{key: data.effect.key.trim(), mode: Number(data.effect.mode), value: String(data.effect.value), priority: Number(data.effect.priority) || 20}]
        : []
    };
    const item = {
      name: data.name?.trim() || game.i18n.localize("GMEI.Form.Untitled"),
      type: data.type || "loot",
      img: data.img?.trim() || "icons/svg/item-bag.svg",
      system: {description: {value: data.description || ""}, quantity: Number(data.quantity) || 1},
      effects: effect.changes.length ? [effect] : []
    };
    await actor.createEmbeddedDocuments("Item", [item]);
    ui.notifications.info(game.i18n.format("GMEI.Notifications.Added", {item: item.name, actor: actor.name}));
  }
}

function openForm(actor = null) {
  if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("GMEI.Errors.GmOnly"));
  new GmEffectItemForm({actor}).render(true);
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "createEffectItem", {
    name: "GMEI.Settings.MenuName", label: "GMEI.Settings.MenuLabel",
    hint: "GMEI.Settings.MenuHint", icon: "fas fa-wand-magic-sparkles",
    type: GmEffectItemForm, restricted: true
  });
});

Hooks.on("renderActorSheet", (app, html) => {
  if (!game.user.isGM || !app.actor) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const header = root?.querySelector(".window-header");
  if (!header || header.querySelector("[data-gmei-button]")) return;
  const button = document.createElement("button");
  button.type = "button"; button.className = "header-control icon fa-solid fa-wand-magic-sparkles";
  button.dataset.gmeiButton = "true"; button.title = game.i18n.localize("GMEI.SheetButton");
  button.addEventListener("click", () => openForm(app.actor));
  header.append(button);
});
Hooks.on("renderActorSheetV2", (app, html) => Hooks.callAll("renderActorSheet", app, html));
Hooks.on("getActorDirectoryEntryContext", (_html, options) => {
  if (!game.user.isGM) return;
  options.push({
    name: game.i18n.localize("GMEI.DirectoryAction"), icon: "fas fa-wand-magic-sparkles",
    condition: li => Boolean(game.actors.get(li.data("documentId"))),
    callback: li => openForm(game.actors.get(li.data("documentId")))
  });
});