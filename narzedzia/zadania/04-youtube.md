# Zadanie 04: moduł YouTube (wysyłka rolek jako Shorts) — Codex

## Kontekst

Publikacje (moduł Claude'a: `moduly/publikacje.js`, `app/publikacje.js`) wysyłają rolki na Instagram
i na stronę Facebooka. Kuba chce też YouTube (rolka 9:16 wrzucona przez API staje się Shortem).
Ograniczenie Google: filmy wysłane przez niezweryfikowaną aplikację są ustawiane jako **prywatne**,
dopóki projekt nie przejdzie audytu. Dlatego moduł wysyła jako `private` (domyślnie) albo `unlisted`,
a Kuba przełącza na publiczne w YouTube Studio. Po audycie wystarczy zmienić domyślną prywatność.

Projekt Google Cloud: `kuba-studio`, konto `kczerwinski033@gmail.com`, YouTube Data API v3 włączone.
Klient OAuth typu **Desktop app**; `client_id` i `client_secret` Kuba wklei w Ustawieniach Studio
(pola dodaje Claude w `app/app.js`/`index.html`, moduł je tylko czyta z `config/youtube_klient.json`
o kształcie `{ "client_id": "...", "client_secret": "..." }`).

## Co ma zrobić moduł `moduly/youtube.js` (Node, bez zależności, wzór: `moduly/publikacje.js`)

1. **Logowanie OAuth (loopback):**
   - `GET /api/youtube/stan` → `{ skonfigurowany: bool (jest client_id), polaczony: bool (jest refresh_token), kanal: { id, tytul, miniatura } | null, blad }`.
   - `GET /api/youtube/polacz` → buduje adres `https://accounts.google.com/o/oauth2/v2/auth` z parametrami:
     `client_id`, `redirect_uri=http://127.0.0.1:<port>/api/youtube/callback` (port z `narzedzia.port()`; dopisz
     do `narzedziaModulow()` w `serwer.js` **tylko przez wpis w DYSKUSJA.md**, Claude to doda: na razie zakładaj,
     że `narzedzia.port()` zwraca numer portu serwera), `response_type=code`, `access_type=offline`, `prompt=consent`,
     `scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly`,
     `state` = losowy ciąg zapisany w pamięci modułu. Zwraca `{ url }`; front otwiera go w zewnętrznej przeglądarce
     (`window.open(url, "_blank")`, Electron przekierowuje to do systemowej przeglądarki).
   - `GET /api/youtube/callback?code=...&state=...` → sprawdza `state`, wymienia `code` na tokeny
     (`POST https://oauth2.googleapis.com/token`, `grant_type=authorization_code`), zapisuje
     `config/youtube_token.json` (`refresh_token`, `access_token`, `wygasa` ISO), pobiera kanał
     (`GET https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`), zapisuje go w tym samym pliku
     i odpowiada prostą stroną HTML w palecie Studio: „Połączono z YouTube, możesz zamknąć tę kartę".
   - Odświeżanie: `access_token` z `refresh_token` (`grant_type=refresh_token`), gdy wygasa za < 2 min.
   - `POST /api/youtube/rozlacz` → kasuje `config/youtube_token.json`.
2. **Wysyłka filmu** (funkcja eksportowana `opublikujNaYouTube(narzedzia, pozycja, ustawStatus)` — Claude
   wywoła ją z `moduly/publikacje.js` po Instagramie, gdy `pozycja.youtube === true`):
   - resumable upload: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
     z JSON `{ snippet: { title, description, categoryId: "17" (Sports), tags }, status: { privacyStatus, selfDeclaredMadeForKids: false } }`,
     nagłówki `Authorization: Bearer`, `X-Upload-Content-Type: video/mp4`, `X-Upload-Content-Length`. Z odpowiedzi
     bierzesz `Location` i wysyłasz tam bajty pliku (`PUT`, strumieniem z dysku, bez wczytywania całości do pamięci).
     Przy zerwaniu: jedno wznowienie (`PUT` z `Content-Range: bytes */N` żeby poznać offset, potem dosłać resztę).
   - Tytuł: `pozycja.youtube_tytul` albo pierwsza linia opisu (do 100 znaków). Opis: `pozycja.opis`.
     Prywatność: `pozycja.youtube_prywatnosc` ∈ `private | unlisted | public`, domyślnie `private`.
   - Zwraca `{ video_id, link: "https://youtube.com/shorts/" + video_id, prywatnosc }`.
   - Błędy Google (403 quota, 401) tłumacz na polskie komunikaty: „limit dzienny YouTube wyczerpany, spróbuj jutro",
     „YouTube wylogował aplikację, połącz ponownie w Ustawieniach".
3. **Front**: `app/youtube.js` z `window.YouTube = { start(), stan() }` — `start()` rysuje do `#youtube-ustawienia`
   (Claude doda taki `div` w sekcji Ustawienia w `index.html`): stan połączenia, przycisk „Połącz z YouTube" /
   „Rozłącz", nazwa kanału z miniaturą, informacja o prywatnych filmach do audytu. `stan()` zwraca ostatni
   pobrany stan, żeby panel Publikacji mógł pokazać przełącznik YouTube tylko, gdy jest połączenie.
   Style: klasy z `style.css` (`.plansza`, `.przycisk`, `.pod`, `.konto`), własne dodatki przez `<style id="youtube-style">`.
4. **Test** `narzedzia/test_youtube.js` (offline): budowanie adresu OAuth (parametry, scope, state), obsługa
   `callback` z błędnym `state`, składanie JSON-a snippet/status z pozycji (tytuł ucięty do 100 znaków, domyślna
   prywatność), tłumaczenie błędów 401/403. Wypisuje `OK` albo różnicę, kod 0/1.

## Zasady

`AGENTS.md`. Bez sieci w sandboxie. Nie zmieniaj `serwer.js`, `app/app.js`, `app/index.html`, `app/style.css`,
`moduly/publikacje.js`, `app/publikacje.js`: to, czego potrzebujesz od nich (np. `narzedzia.port()`, div w Ustawieniach,
przełącznik w panelu rolki), wypisz w `narzedzia/DYSKUSJA.md` w punktach, Claude to doda. Pisz pliki od razu,
zapisuj po każdym. Na końcu uruchom test i dopisz wynik do tego pliku.

## Wynik, 2026-09-24, Codex

Wykonano cały zakres modułu z zadania:

- moduly/youtube.js: endpointy stanu, połączenia, callback i rozłączenia; OAuth loopback z jednorazowym state, zapis tokenów oraz kanału, odświeżanie tokena, eksport opublikujNaYouTube, wysyłka strumieniowa i jedno wznowienie od potwierdzonego offsetu.
- app/youtube.js: window.YouTube.start()/stan(), stan konta, miniatura i nazwa kanału, połączenie/rozłączenie, informacja o prywatnych filmach, odświeżanie po powrocie z przeglądarki i podczas logowania.
- narzedzia/test_youtube.js: samodzielny test offline z atrapą HTTPS i tymczasową konfiguracją. Obejmuje parametry OAuth, losowość/state błędny, Unicode, wygasły i użyty ponownie, callback i odmowę zgody, metadane oraz limit tytułu, błędy 401/403, odświeżanie, strumień i wznowienie, utraconą odpowiedź po pełnym uploadzie, odrzucenie obcego hosta, błąd odczytu pliku oraz rozłączenie podczas odświeżania.
- narzedzia/DYSKUSJA.md: zapisany kontrakt podłączenia Publikacji i uwagi dla przeglądu Claude'a. Wspólnych plików oraz modułów Publikacji nie zmieniano.

Weryfikacja końcowa: node narzedzia/test_youtube.js -> OK, kod 0. node --check dla moduly/youtube.js, app/youtube.js oraz narzedzia/test_youtube.js -> kod 0. Pliki zapisane UTF-8 bez BOM, z LF, bez dodatkowych zależności.

Bez sieci, dokumentacji online i prawdziwych wywołań API; test nie czyta sekretów aplikacji. Integracja przycisku wysyłki w Publikacjach pozostaje po stronie Claude'a zgodnie z kontraktem zadania. Podglądu wizualnego ani rzeczywistego logowania i transferu nie uruchamiano.
