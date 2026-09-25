# Prompt do przekazania Fable

Przejmij dalszy rozwój zakładki Research w aplikacji Studio. Ja z Codexem zajmuję się teraz pisaniem skryptów rolek.

Najpierw przeczytaj cały raport:
**C:/Users/pc/Desktop/studio/HANDOFF-RESEARCH-FABLE.md**

Repozytorium jest w:
**C:/Users/pc/Desktop/studio**

Raport jest samowystarczalny: zawiera wymagania, historię prób i błędnych założeń, aktualny stan danych z datą, mapę kodu z liniami, komendy uruchomienia i testów, konfigurację bez sekretów, stan Git oraz uporządkowany backlog. Przeczytaj też AGENTS.md w repozytorium.

## Twoje zadanie

Doprowadź bezpłatne wyszukiwanie rolek na Instagramie do możliwie skutecznego i wiarygodnego działania. Wpisuję np. „hipertrofia”, a aplikacja sama odkrywa nieznanych twórców i ich ponadprzeciętne rolki. Nie chcę obowiązkowej listy kont.

Wymagam celu minimum 30 potwierdzonych rolek i możliwości wyboru 60/100, języka PL/EN/oba, okresu 7/30 dni oraz progu 3×/4×/5× ponad medianę wcześniejszych wyświetleń autora. Nie zaliczaj braków danych ani nie obniżaj filtrów dla dobicia liczby.

Najważniejsze fakty:
- Oficjalne API działało po dodaniu Instagram Public Content Access w trybie Ready for testing. Nie wysłano pełnego App Review.
- Problem nie został rozwiązany do końca. Wczorajsza próba PL+EN dała 12 potwierdzonych wyników; stan z 25.09.2026 o 15:07, przy samym PL, dawał 1 z 839 kandydatów. Nie porównuj tych liczb bez ustawień wyszukiwania.
- Meta zwraca limit zapytań. Najpierw sprawdź kolejkę, koszt zapytań, cache i kontynuowanie częściowych historii. Nie zaczynaj od kolejnej masowej próby.
- GET lokalnego API Research może wznowić pracę; do samego rozpoznania przeczytaj najpierw zapisany plik danych.
- Większość nowego Research jest lokalna i niescommitowana. Nie resetuj repo i nie odtwarzaj go z GitHuba.
- Szczegółowa analiza obecnie obejmuje opis/statystyki. Obraz, audio i cudze udostępnienia pozostają niedokończone.
- Bez płatnych usług, bez instalowania nowych zależności npm, bez ujawniania tokenów i bez naruszania równoległych zmian Publikacji.

Zacznij od audytu najważniejszych problemów z raportu, następnie wykonaj uzasadnione poprawki i sprawdź je testami oraz kontrolowaną próbą rzeczywistą. Nie przedstawiaj testów na mockach jako sukcesu zdobycia 30 prawdziwych rolek.

Wynik pracy ma zawierać: co poprawiłeś, ile prawdziwych trafień uzyskałeś przy jakich filtrach, ile trwało wyszukiwanie, ile zużyło zapytań i co nadal ogranicza działanie. Jeśli bezpłatne źródła nie wystarczą, wyjaśnij to na podstawie pomiarów. Nie udawaj pełnego przeszukania Instagrama.

Przejmuj czynności techniczne samodzielnie w zakresie tego zadania. Pisz do mnie po polsku i krótko. Gdy mój udział jest konieczny, podaj jeden prosty krok. Nie uruchamiaj dodatkowych agentów bez mojej wyraźnej prośby. Zmiany wyglądu pokaż przed wdrożeniem.

Jeśli nie masz dostępu do mojego dysku, przeczytaj załączony raport i wskaż konkretnie brakujące pliki. Sam adres GitHuba nie zawiera aktualnej lokalnej wersji. Nie proś o przesyłanie katalogu config ani tokenów.
