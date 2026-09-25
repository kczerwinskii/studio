# Audyt wyników dla „hipertrofia”, 24.09.2026

## Odtworzenie zgłoszenia

Zapisane wyszukiwanie obejmowało 36 rolek z trzech fraz: hipertrofia, hypertrophy, muscle growth. Heurystyka języka odrzuciła 9 jako inne języki. Pozostało 27 kandydatów: 19 oznaczonych EN i 8 z nieznanym językiem. Wszystkie 36 miały licznik wyświetleń i autora, żadna nie miała daty. To dawało dokładnie komunikat użytkownika: 27 z niepełnymi danymi, zero spełniających filtry 30 dni / 3×.

Przyczyna była częściowo w naszej implementacji: odczytywała wyłącznie stronę wyników, nie odwiedzała rolki ani profilu. Wcześniejsza informacja, że dat i liczb reakcji nie da się uzyskać z tego źródła, była za szeroka.

## Sprawdzone publicznie

W odizolowanym Electronie, bez logowania i pobierania obrazów/filmów, odwiedzono wszystkie 27 rolek. Odczytano:

- 27 dokładnych dat publikacji z elementu time przy linku do konkretnej rolki.
- 26 liczników polubień i 26 komentarzy z publicznego opisu strony. Wartości skrócone K/M są oznaczane jako przybliżone.
- 4 rolki opublikowane w ostatnich 30 dniach, 0 w ostatnich 7 dniach, według czasu audytu.
- Najstarsza publikacja: 11.12.2023. Wyniki „popularne” nie są listą najnowszych trendów.
- Udostępnień nie znaleziono; pozostają nieznane.

Odczytano po 12 rolek z publicznych profili czterech autorów świeżych wyników oraz sprawdzono daty każdej z tych publikacji. Zwykłe przewijanie jednego profilu nie udostępniło dalszych wyników; nie obchodzono ograniczeń i logowania.

| Autor | Data znalezionej rolki | Dostępne wcześniejsze rolki | Wynik |
|---|---|---:|---|
| _akiyamaxx | 01.09.2026 | 3 | Poniżej minimum 5, mnożnik nieznany; również niepotwierdzony język |
| coach.krush | 11.09.2026 | 0 | Widoczne 12 publikacji jest nowsze od ocenianej rolki |
| brenley.fit | 02.09.2026 | 0 | Widoczne 12 publikacji jest nowsze od ocenianej rolki |
| musclebuildingsimplified | 04.09.2026 | 9 | Około 473 000 / 67 200 = 7,04× |

Ostatnia rolka: https://www.instagram.com/reel/Dc3BH5GMKgg/ . Bazowe wyświetlenia 9 wcześniejszych rolek: 5124, 171000, 119000, 6359, 8185, 67200, 660000, 59200, 1200000. Mediana wynosi 67200; badana rolka i nowsze publikacje są wykluczone. Liczniki są odczytem publicznym, częściowo zaokrąglonym. To mnożnik wobec dostępnej próby, nie dowód przyczyny sukcesu ani pomiar tempa wzrostu.

## Poprawki

- Adapter publiczny odwiedza teraz również rolkę, odczytuje jej datę oraz polubienia i komentarze. Nie bierze dat komentarzy ani daty z opisu marketingowego.
- Pierwsza wersja parsera zwracała odpowiedź przed dorysowaniem daty. Usunięto ten błąd: czeka na datę właściwego permalinku; jeżeli brak jej w limicie, może oddać wyłącznie dostępne liczniki, bez zmyślonej daty.
- Wyszukiwanie uzupełnia szczegóły kandydatów; dla autorów wyników z ostatnich 30 dni odczytuje publiczną historię (do 20 dostępnych pozycji, faktycznie w audycie 12). Sprawdza daty historii i przechowuje ją oddzielnie. Cache trwa 6 godzin, postęp jest pokazywany w panelu.
- Mediana korzysta wyłącznie z próby pobranej z profilu. Same trafienia wyszukiwarki popularnych tematów są selekcją hitów i nie wolno traktować ich jako historii typowych wyników autora.
- Zachowano minimum 5 wcześniejszych rolek oraz ścisłe filtry. Pokazywana jest liczba dostępnych pozycji i przybliżenie liczników/mnożnika.
- Uzupełniono istniejące dane Kuby wynikami audytu, z kopią zapasową poprzedniego JSON. Zachowano profil, notatki i zapisane. Po ponownym otwarciu aplikacji filtr PL+EN / 30 dni / 3× lub 5× daje 1 potwierdzony wynik; przy 7 dniach poprawnie daje zero dla tej próby.

## Weryfikacja

- `node narzedzia/test_research_odkrywanie.js`: rozszerzenie, daty i reakcje, asynchroniczne uzupełnianie, historia osobno od trafień, mnożnik, błędy, cache, zapisy.
- `node narzedzia/test_research.js`: 9 grup regresji starego panelu.
- `node narzedzia/test_research_dom.cjs`: Playwright z runtime testowego; poprawny permalink, odrzucenie dat komentarzy i obcej rolki, skrócone liczniki.
- `node narzedzia/test_research_panel.cjs`: panel, filtry, notatki, zapisane, brak pobierania filmu przed kliknięciem.
- Audyty online są w `narzedzia/audyt_research_*.js`; prywatne wyniki odczytów w ignorowanym katalogu `dane/`. Nie są częścią automatycznego uruchamiania aplikacji.

## Granice rozwiązania

Nie ma gwarancji pełnej historii, kompletnego indeksu Instagram ani dostępu przy ograniczeniach platformy. Język nadal jest szacowany z opisu, nie z mowy. Dane porównują bieżące łączne wyświetlenia filmów o różnym wieku. Zakres automatycznej historii dotyczy obecnie kandydatów do 30 dni; starsze wyniki nie uruchamiają kosztownego odczytu profili. Pełna analiza obrazu/dźwięku i udostępnienia nadal nie są zrealizowane.
