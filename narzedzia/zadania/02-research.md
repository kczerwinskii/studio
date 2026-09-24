# Zadanie 02: zakładka Research (cudze rolki z niszy, detektor odstających)

## Cel

Kuba chce widzieć, co w jego niszy (trening siłowy, sylwetka, trenerzy online) robi wynik ponad normę
u danego twórcy, żeby mieć od czego zacząć własną rolkę. Nie kopiuje, szuka kąta. Aplikacja ViralCat
odpadła (wyniki generyczne, brak liczb). Budujemy własny detektor na **Instagram Business Discovery**:
lista kont do obserwowania, pobieranie ich ostatnich postów, flagowanie tych, które robią
kilka razy więcej niż mediana danego konta.

## Co już jest

- `serwer.js` ładuje moduły z `moduly/*.js`. Moduł eksportuje `obsluz(req, res, url, narzedzia)`
  i zwraca `true`, gdy obsłużył żądanie (inaczej `false`, serwer szuka dalej). `narzedzia` to:
  `sciezki` (m.in. `sciezki.dane`), `graph(sciezka, parametry, token)`, `wszystkieStrony`, `pobierzJson`,
  `czytajJson(plik, domyslne)`, `zapiszJson(plik, dane)` (atomowy), `czytajCialo(req)`,
  `odpowiedzJson(res, kod, dane)`, `token()` (aktualny token użytkownika), `ustawienia()` (m.in. `ig_id`
  = id konta IG Kuby, potrzebne w zapytaniu business_discovery). Zobacz `narzedziaModulow()` w `serwer.js`.
- `app/research.js` to pusty plik z kontraktem: `window.Research = { start() }`; `app.js` woła
  `Research.start()` po załadowaniu. Rysuj do `#research-tresc` w `app/index.html`
  (sekcja `#widok-research`). Style bierz z `app/style.css` (klasy `.plansza`, `.tabela`, `.tabela-obszar`,
  `.przycisk`, `.przycisk.zloty`, `.kafelki/.kafelek`, `.sygnal`, `.filtry`, `.pod`, `.karta` przez `#tlo-karty`
  jest zajęte przez Analizę, zrób własny prosty panel szczegółów w obrębie zakładki). Jeśli potrzebujesz
  dodatkowych stylów, wstrzyknij je z `research.js` jako `<style id="research-style">`, **nie edytuj style.css**.
- Próbka prawdziwej odpowiedzi API: `narzedzia/probki/business_discovery.json` (konto karolina.trenuje,
  25 postów). Zapytanie, które ją dało (ig_id to konto Kuby):
  `GET /v25.0/{ig_id}?fields=business_discovery.username({username}){id,username,name,followers_count,media_count,profile_picture_url,media.limit(50){id,caption,media_product_type,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url}}`
  Uwaga: `like_count` bywa `null` (konto ukrywa polubienia), konta prywatne i zwykłe (nie biznesowe) zwracają
  błąd `(#110)`/`(#100)`, pokaż to przy koncie zamiast wywalać całość. Wyświetleń cudzych rolek API nie daje.

## Do zrobienia

### `moduly/research.js` (Node, bez zależności)

Dane w `dane/research.json`: `{ konta: [{ username, nazwa, obserwujacy, media_count, avatar, dodano, ostatnie_pobranie, blad }], posty: { [username]: [post…] } }`.
Post: `{ id, username, data, tytul (pierwsza linia opisu, do 80 znaków), opis, typ ("rolka"|"post"|"karuzela"), polubienia, komentarze, permalink, miniatura }`.

Trasy:
- `GET /api/research` → `{ konta, posty }` **z policzonymi polami**: dla każdego posta `zaangazowanie = polubienia + komentarze`
  (gdy polubienia null: tylko komentarze i flaga `bez_polubien`), `mediana_konta` (mediana zaangażowania z rolek tego konta,
  gdy rolek < 5 to z wszystkich postów), `krotnosc = zaangazowanie / mediana_konta`, `odstajacy = krotnosc >= prog`
  (prog domyślnie 3, zapisany w `dane/research.json` jako `ustawienia.prog`), `swiezy = < 14 dni`.
- `POST /api/research/konto` `{ username }` → dodaje konto (od razu próbuje pobrać, żeby zweryfikować, czy to konto biznesowe);
  `DELETE /api/research/konto?username=…` → usuwa konto i jego posty.
- `POST /api/research/pobierz` → pobiera posty wszystkich kont po kolei (limit 50 na konto), łączy z tym, co już było
  (nowe posty dochodzą, stare zostają, po `id`), zapisuje `ostatnie_pobranie`. Postęp jak w Analizie: `GET /api/research/postep`
  → `{ w_toku, zrobione, razem, konto, blad }`. Odstęp 400 ms między kontami (limity Mety).
- `POST /api/research/prog` `{ prog }` → zapisuje próg.
- `POST /api/research/notatka` `{ id, tekst }` → notatka do posta (w `dane/research_notatki.json`, jak w Analizie).

### `app/research.js` (przeglądarka, bez zależności)

Układ zakładki (wygląd jak Analiza, ta sama paleta, minimalizm):
1. Pasek u góry: pole „@nazwa konta" + „Dodaj konto", przycisk „Pobierz nowe dane", próg (select 2×, 2,5×, 3×, 4×), przełącznik „tylko rolki" (domyślnie tak), pasek postępu.
2. Lista kont jako małe kafelki: avatar, @nazwa, obserwujący, liczba postów, data pobrania, błąd (jeśli jest), przycisk usuń (x, z potwierdzeniem `confirm`).
3. Tabela „Odstające": data, konto, tytuł, typ, polubienia, komentarze, krotność (np. „4,2×"), sygnał (`.sygnal.dobry` gdy ≥ próg, „świeże" gdy < 14 dni). Sortowanie po kliknięciu nagłówka (domyślnie krotność malejąco), filtr konta, szukaj w tytule.
4. Kliknięcie w wiersz rozwija pod nim panel: pełny opis, miniatura (jeśli jest), link „otwórz na Instagramie" (target _blank), pole notatki (zapis z opóźnieniem 600 ms, jak w Analizie).
5. Stan pusty: krótki tekst, co dodać (np. „dodaj 10-20 kont trenerów z Twojej niszy") i przycisk.

Zasady: sentence case, bez „—", liczby przez `toLocaleString("pl-PL")`, wszystkie teksty po polsku.
Nie edytuj `serwer.js`, `app/app.js`, `app/index.html`, `app/style.css`, `app/analiza.js`.

### Test

`narzedzia/test_research.js` (Node): wczytuje próbkę z `narzedzia/probki/`, przepuszcza przez funkcje liczące
z `moduly/research.js` (wyeksportuj je obok `obsluz`: `przeliczKonto`, `mediana`, `tytulZOpisu`) i sprawdza:
medianę, krotność, flagi, obsługę `like_count: null`, próg. Wypisuje `OK` albo różnicę, kod wyjścia 0/1.
Sieć w Twoim sandboxie może być zablokowana, dlatego testujesz na próbce; żywy test zrobi Claude.

Na końcu dopisz do tego pliku: co zrobiłeś, wynik testu, czego nie udało się sprawdzić.

## Wynik Codexa, 2026-09-24

- Zapisano kolejno `moduly/research.js`, `app/research.js`, `narzedzia/test_research.js`. Bez dodatkowych zależności i zmian w plikach wspólnych aplikacji.
- Backend: wszystkie trasy zadania, normalizacja danych, mediana rolek (poniżej 5 rolek mediana wszystkich postów), próg, świeżość, ukryte polubienia, łączenie po ID, postęp, odstęp 400 ms i błędy przypisane do kont. Zapisy przez atomowy helper serwera. Notatki oraz ustawienia są również zwracane przez GET /api/research.
- Frontend: dodawanie i usuwanie kont z potwierdzeniem, kafelki, pobieranie i postęp, próg, filtry, sortowana tabela odstających publikacji, rozwijane szczegóły i notatki zapisywane po 600 ms. Osobne style w research-style, wspólna paleta i klasy jak w Publikacjach.
- Przy medianie 0 krotność jest null, a odstajacy false (brak podstawy do dzielenia). Nieudane pobranie zachowuje dotychczasowe posty i datę ostatniego udanego pobrania. Dodawanie, usuwanie i kolejne pobieranie są blokowane podczas pobierania; zmiana progu nie ginie po odpowiedzi transportu.
- `node narzedzia/test_research.js`: **OK: 9 grup testów Research (próbka, obliczenia i trasy offline)**, kod wyjścia 0. Sprawdzono również składnię app/research.js oraz LF i brak BOM w trzech plikach JS.
- Testy obejmują próbkę 25 postów (20 rolek, mediana 334,5), progi, granice 14 dni, null, zerową medianę, walidację, notatki, blokady, łączenie i aktualizację postów, izolację błędów kont oraz odstęp między pobraniami. Transport i zapis w testach są atrapami w pamięci, bez sieci i zmian danych użytkownika.
- Nie sprawdzono żywego API Mety, uprawnień/tokena, pobierania obrazów ani wyglądu i interakcji w uruchomionym Electronie. Test żywy pozostaje do wykonania przez Claude zgodnie z zadaniem. Nie uruchamiano aplikacji ani przeglądarki.
