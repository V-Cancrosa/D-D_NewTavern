# …and Taverns, Oh My!

*Dungeons and Dragons… and Taverns, Oh My!* – nazwa dopełnia cytat z „Czarnoksiężnika z Krainy Oz” razem z nazwą systemu. Identyfikator modułu to nadal `new-tavern`, więc dotychczasowe instalacje aktualizują się normalnie.

Moduł dla Foundry VTT 13–14 i D&D5e 5.2.5–6.0.6. Zestaw narzędzi dla MG. Pierwsza funkcja: kreator i edytor przedmiotów z efektami opisanymi po polsku zamiast kluczy systemowych.

## Kreator przedmiotów

Kreator otwierasz na trzy sposoby (tylko MG):
- przyciskiem **Taverns, Oh My!** obok „Create Item” w katalogu przedmiotów,
- ikoną różdżki w nagłówku karty postaci,
- z menu kontekstowego postaci w katalogu aktorów (albo w **Game Settings → Module Settings**).

Kreator prowadzi krok po kroku, w oknie w stylu systemowego „Create Item”. Wszystkie etykiety są po polsku, a kości wpisuje się jak na sesji (1k6+1).
1. **Co tworzysz?**: nazwa, folder i rodzaj przedmiotu z ikonami systemu albo gotowy szablon.
2. **Podstawy**: podtyp, rzadkość, dostrojenie, ilość, „magiczny”; dla broni kości obrażeń, dla broni i zbroi premia magiczna.
3. **Co robi ten przedmiot?**: daje premie, gdy jest noszony / można go użyć / ma ładunki / po użyciu działa przez jakiś czas. Kreator pokazuje potem tylko potrzebne kroki.
4. **Premie i efekty**: tabela zmian jak w zakładce „Changes” systemu. Wiersz rozwija się w miejscu: cel (KP, rzuty obronne, umiejętności, ataki, atrybuty, szybkość, zmysły, odporności), działanie (Dodaj, Premia, Pomnóż, Ustaw na, Co najmniej, Co najwyżej, Przewaga, Utrudnienie, Minimum na k20) i wartość: liczba, kości albo cecha postaci. Efekt może być stały albo czasowy i nadawać stany.
5. **Użycie**: leczenie, obrażenia, rzut obronny albo samo nałożenie efektu; koszt w ładunkach i czas użycia.
6. **Ładunki**: liczba, odnawianie (np. 1k6+1 o świcie), znikanie po zużyciu, szybkie ustawienia.
7. **Gotowe**: podgląd w stylu dymka przedmiotu, wybór postaci albo katalogu przedmiotów.

## Więcej opcji i wpływ na postać

- **Przedmiot bazowy** (np. długi miecz, zbroja łuskowa) z list systemu uzupełnia obrażenia, wersję oburęczną, właściwości, zasięg, wagę, cenę, a dla zbroi KP, limit ZRC i utrudnienie do Skradania.
- **Więcej opcji** w kroku „Podstawy”: właściwości (po polsku), biegłość, zasięg (wręcz albo normalny/daleki), waga. Broń wszechstronna ma pole obrażeń oburęcznych.
- **Wpływ na postać**: gdy przedmiot jest dla konkretnej postaci (albo edytujesz przedmiot z jej karty), kreator pokazuje zmiany przed → po (KP, rzuty obronne, umiejętności, szybkość, inicjatywa…), trafienie i obrażenia broni oraz ostrzeżenia (brak biegłości, wymagana Siła). Liczy to dnd5e na tymczasowej kopii postaci w pamięci – nic nie jest zapisywane.

## Przeklęte przedmioty i identyfikacja

- W kroku „Podstawy” → **Identyfikacja i klątwa**: przedmiot niezidentyfikowany (nazwa i opis widoczne dla graczy przed identyfikacją) oraz przeklęty (opis klątwy widoczny tylko dla MG).
- Klątwa może **blokować zdjęcie, odłączenie dostrojenia i wyrzucenie** przedmiotu przez gracza (gracz widzi tylko „coś nie pozwala ci…”, MG dostaje szept) oraz nadawać postaci stan „przeklęty” z dnd5e. Skutki klątwy (np. kary) dodajesz jak zwykłe efekty.
- Ustawienie **„Tylko MG identyfikuje przedmioty”** (domyślnie włączone): próba identyfikacji przez gracza wysyła prośbę do MG.
- Menu ⋮ przy przedmiocie (dla MG): **Zidentyfikuj (MG)**, **Zidentyfikuj i ujawnij klątwę**, **Ujawnij klątwę**, **Zdejmij klątwę**. Przeklęte przedmioty mają na karcie postaci ikonę czaszki widoczną tylko dla MG.

## Zasady 2014 i 2024

- Kreator czyta wybór zasad świata (ustawienie dnd5e „Rules Version”) i oznacza tworzone przedmioty właściwym źródłem zasad. W kroku „Podstawy” można to zmienić dla pojedynczego przedmiotu; gdy różni się od świata, kreator pokazuje ostrzeżenie i niczego nie przerabia sam.
- **Przedmioty z kompendiów jako punkt wyjścia**: w pierwszym kroku można wyszukać magiczny przedmiot w kompendiach – SRD 5.1 dla zasad 2014, SRD 5.2 dla 2024 oraz w zainstalowanych podręcznikach (także płatnych, dla ich posiadaczy). Kreator robi kopię, jak przy przeciągnięciu z kompendium; oryginał zostaje bez zmian.
- Pola zależne od zasad: mistrzostwo broni tylko w 2024; szablony mikstur – akcja (2014) albo akcja dodatkowa (2024).
- Cena z podpowiedzią: mediana cen przedmiotów o tej samej rzadkości i wersji zasad w Twoich kompendiach.

## Polskie znaki w nagłówkach

Czcionka nagłówków Foundry i dnd5e (Modesto Condensed) nie ma polskich liter. Moduł uzupełnia ją literami z czcionki Grenze (licencja SIL OFL, plik w `fonts/grenze`). Pozostałe litery zostają oryginalne. Działa w całym świecie i można to wyłączyć w ustawieniach modułu.

## Edycja istniejących przedmiotów

Na karcie postaci kliknij **⋮** przy przedmiocie i wybierz **Edit**: otworzy się edytor z przeglądem przedmiotu; kliknięcie sekcji przenosi do jej kroku. Oryginalna karta przedmiotu jest pod pozycją **Karta systemu**. Edytor otworzysz też ikoną różdżki w nagłówku karty przedmiotu albo z menu kontekstowego w katalogu przedmiotów. Zamianę „Edit” można wyłączyć w ustawieniach modułu.

Edytor zmienia tylko to, co pokazuje. Zmiany efektów, których nie rozpoznaje, zostają zachowane i oznaczone jako „Własna zmiana”. Inne aktywności, sformatowany opis (jeśli go nie zmienisz) i pozostałe pola systemu zostają bez zmian. Edycja obejmuje broń, wyposażenie, materiały eksploatacyjne, narzędzia, łup i cechy.

Kreator zapisuje efekty w formacie właściwym dla wersji: na Foundry 14 / dnd5e 6 `system.changes` z nowymi kluczami (`system.rolls.*`, `movement.speeds.*`, `senses.ranges.*`), na Foundry 13 / dnd5e 5 w dotychczasowym formacie.

D&D5e 6.x wymaga Foundry VTT 14.

## Instalacja (Manifest URL)

W Foundry VTT lub na The Forge wybierz **Install Module** i wklej adres manifestu:

```
https://github.com/V-Cancrosa/D-D_NewTavern/releases/latest/download/module.json
```

Następnie uruchom świat i aktywuj „…and Taverns, Oh My!” w **Manage Modules**.

## Wydawanie nowej wersji

1. Podnieś `version` w `module.json` i scal zmiany do `main`.
2. Na GitHubie utwórz wydanie (**Releases → Draft a new release**) z tagiem `vX.Y.Z`, np. `v0.3.0`, albo uruchom workflow **Release** ręcznie (**Actions → Release → Run workflow**) z tym tagiem.
3. Workflow `.github/workflows/release.yml` dołączy do wydania `module.json` i `new-tavern.zip`; od tej chwili Manifest URL wskazuje nową wersję.

## Współpraca z innymi modułami

- Typy przedmiotów, podtypy, atrybuty, umiejętności, rodzaje ruchu, zmysły, obrażenia i stany kreator czyta z konfiguracji systemu, więc widzi też to, co dodają moduły z podręcznikami.
- Gdy Foundry działa po polsku i aktywne jest tłumaczenie „dnd5e pl”, nazwy w kreatorze pochodzą z tego tłumaczenia (zgodne z kartami postaci). W pozostałych przypadkach kreator używa własnych polskich nazw.
- Każdą funkcję modułu można wyłączyć w ustawieniach.

### API

```js
const api = game.modules.get("new-tavern").api;
api.open(actor);          // kreator (opcjonalnie dla postaci)
api.edit(item);           // edytor istniejącego przedmiotu
api.registerTarget({ id: "my-bonus", label: "Moja premia", short: "mojej premii", group: "Inne",
  cls: "roll", dice: true, ops: ["bonus"], keys: { bonus: ["system.bonuses.my.value"] } });
api.registerPreset({ id: "my-ring", label: "Mój pierścień", hint: "+2 KP",
  item: { name: "Mój pierścień", type: "equipment", subtype: "ring" }, effects: [] });
```

Hook `tavernsOhMy.ready` (z obiektem API) wywoływany jest po załadowaniu modułu – to dobre miejsce na rejestrację.
