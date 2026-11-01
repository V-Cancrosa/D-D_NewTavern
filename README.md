# New Tavern

Moduł dla Foundry VTT 13–14 i D&D5e 5.2.5–6.0.6. Kreator przedmiotów z aktywnymi efektami jest pierwszą funkcją rozwijanego modułu New Tavern.

## Użycie

1. Wypakuj moduł do `Data/modules/new-tavern` i aktywuj go w świecie.
2. Jako MG otwórz **Game Settings → Module Settings → Przedmiot z efektami** lub użyj ikony różdżki na karcie aktora.
3. Wypełnij dane przedmiotu i efektu; przykładowo: klucz `system.attributes.ac.bonus`, tryb `ADD`, wartość `1`.

D&D5e 6.x wymaga Foundry VTT 14.

## Instalacja (Manifest URL)

W Foundry VTT lub na The Forge wybierz **Install Module** i wklej adres manifestu:

```
https://github.com/V-Cancrosa/D-D_NewTavern/releases/latest/download/module.json
```

Następnie uruchom świat i aktywuj New Tavern w **Manage Modules**.

## Wydawanie nowej wersji

1. Podnieś `version` w `module.json` i scal zmiany do `main`.
2. Na GitHubie utwórz wydanie (**Releases → Draft a new release**) z tagiem `vX.Y.Z`, np. `v0.3.0`.
3. Workflow `.github/workflows/release.yml` dołączy do wydania `module.json` i `new-tavern.zip`; od tej chwili Manifest URL wskazuje nową wersję.
