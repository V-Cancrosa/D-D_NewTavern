# New Tavern

Moduł dla Foundry VTT 13–14 i D&D5e 5.2.5–6.0.6. Kreator przedmiotów dla MG: efekty opisane po polsku zamiast kluczy systemowych.

## Kreator przedmiotów

Kreator otwierasz na trzy sposoby (tylko MG):
- przyciskiem **New Tavern** obok „Create Item” w katalogu przedmiotów,
- ikoną różdżki w nagłówku karty postaci,
- z menu kontekstowego postaci w katalogu aktorów (albo w **Game Settings → Module Settings**).

Cztery kroki, które można przeskakiwać:
1. **Przedmiot**: gotowy szablon albo nazwa, rodzaj, podtyp, rzadkość, dostrojenie, premia magiczna i obrażenia broni.
2. **Efekty**: stały (gdy przedmiot jest założony) albo czasowy (rundy, tury, minuty, godziny, dni; na Foundry 14 także koniec tury i odpoczynki). Każda zmiana to cel z listy (KP, rzuty obronne, umiejętności, ataki, atrybuty, szybkość, zmysły, odporności), działanie (Dodaj, Premia, Pomnóż, Ustaw na, Co najmniej, Co najwyżej, Przewaga, Utrudnienie, Minimum na k20) i wartość: liczba, kości (np. 1k4) albo cecha postaci (biegłość, modyfikator, poziom). Kreator pokazuje tylko kombinacje, które system obsługuje. Efekt może też nadawać stany.
3. **Użycie i ładunki**: brak, nałożenie efektu, leczenie, obrażenia albo rzut obronny; ładunki z odnawianiem i znikanie po zużyciu.
4. **Podsumowanie**: postać albo katalog przedmiotów (folder) i opcjonalne otwarcie karty przedmiotu.

## Edycja istniejących przedmiotów

Na karcie postaci kliknij **⋮** przy przedmiocie i wybierz **Edit**: otworzy się ten sam edytor, wypełniony danymi przedmiotu. Oryginalna karta przedmiotu jest pod pozycją **Karta systemu**. Edytor otworzysz też ikoną różdżki w nagłówku karty przedmiotu albo z menu kontekstowego w katalogu przedmiotów. Zamianę „Edit” można wyłączyć w ustawieniach modułu.

Edytor zmienia tylko to, co pokazuje. Zmiany efektów, których nie rozpoznaje, zostają zachowane i oznaczone jako „Własna zmiana”. Inne aktywności, sformatowany opis (jeśli go nie zmienisz) i pozostałe pola systemu zostają bez zmian. Edycja obejmuje broń, wyposażenie, materiały eksploatacyjne, narzędzia, łup i cechy.

Panel po prawej pokazuje opis efektów tak, jak przeczyta go gracz. Sekcja „Zaawansowane” pokazuje zapis w dnd5e. Kreator zapisuje efekty w formacie właściwym dla wersji: na Foundry 14 / dnd5e 6 `system.changes` z nowymi kluczami (`system.rolls.*`, `movement.speeds.*`, `senses.ranges.*`), na Foundry 13 / dnd5e 5 w dotychczasowym formacie.

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
