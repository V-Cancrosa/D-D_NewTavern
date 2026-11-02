# New Tavern

Moduł dla Foundry VTT 13–14 i D&D5e 5.2.5–6.0.6. Kreator przedmiotów dla MG: efekty opisane po polsku zamiast kluczy systemowych.

## Kreator przedmiotów

Kreator otwierasz na trzy sposoby (tylko MG):
- przyciskiem **New Tavern** obok „Create Item” w katalogu przedmiotów,
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

Następnie uruchom świat i aktywuj New Tavern w **Manage Modules**.

## Wydawanie nowej wersji

1. Podnieś `version` w `module.json` i scal zmiany do `main`.
2. Na GitHubie utwórz wydanie (**Releases → Draft a new release**) z tagiem `vX.Y.Z`, np. `v0.3.0`, albo uruchom workflow **Release** ręcznie (**Actions → Release → Run workflow**) z tym tagiem.
3. Workflow `.github/workflows/release.yml` dołączy do wydania `module.json` i `new-tavern.zip`; od tej chwili Manifest URL wskazuje nową wersję.
