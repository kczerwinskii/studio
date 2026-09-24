# Zadanie 08: widok „Konta" (Codex)

Kuba zaakceptował makietę (24.09.2026): w pasku po lewej, nad „Ustawienia", przycisk **Konta**. Widok pokazuje
wszystkie jego konta z liczbą obserwujących/subskrybentów, zmianą w wybranym okresie (7 / 30 / 90 dni),
miniaturowym wykresem, a niżej wspólny wykres 90 dni dla Instagrama i trzy kafelki wskaźników.
**Wymóg Kuby: prawdziwe zdjęcia profilowe z każdej platformy**, nie ikony.

## Dane

- Instagram (token użytkownika Mety, `narzedzia.token()`, `ustawienia().ig_id`):
  `GET /{ig_id}?fields=followers_count,media_count,profile_picture_url,username`;
  historia: `GET /{ig_id}/insights?metric=follower_count&period=day&since=<unix 29 dni temu>&until=<unix dziś>`
  (API daje do 30 dni wstecz), zasięg i odwiedziny profilu: `metric=reach,profile_views&period=day` (te same
  granice), suma za okres. Uwaga: `follower_count` bywa niedostępne dla kont < 100 obserwujących; obsłuż błąd.
- Facebook (token strony z `config/meta_page_token.json`, `strona_id` z ustawień):
  `GET /{strona_id}?fields=followers_count,fan_count,picture{url},name`; zasięg: `GET /{strona_id}/insights?metric=page_impressions_unique&period=day&since&until`.
- YouTube (moduł `moduly/youtube.js`, token z `config/youtube_token.json`): `channels?part=snippet,statistics&mine=true`
  → `subscriberCount`, `viewCount`, `videoCount`, `snippet.thumbnails.default.url`. Dzienne przyrosty:
  YouTube Analytics API (`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate&endDate&metrics=subscribersGained,subscribersLost,views&dimensions=day`)
  wymaga zakresu `https://www.googleapis.com/auth/yt-analytics.readonly`: dodaj go do listy scope w `moduly/youtube.js`
  (Kuba połączy YouTube ponownie, Claude go o to poprosi) i włącz API „YouTube Analytics API" (Claude włączy w Google Cloud).
  Jeśli zakresu brak w tokenie, pokaż tylko stan bieżący i napis „dzienne przyrosty po ponownym połączeniu".
- TikTok (moduł 05, gdy połączony): `user/info/?fields=open_id,display_name,avatar_url,follower_count,likes_count,video_count`.
- **Dzienne zapisy własne:** `dane/konta_historia.json`: `{ "instagram": { "2026-09-24": { obserwujacy, zasieg, odwiedziny } }, "youtube": {...}, "facebook": {...}, "tiktok": {...} }`.
  Moduł zapisuje snapshot raz dziennie (przy pierwszym odczycie danego dnia i w `setInterval` co 6 h, gdy Studio
  jest otwarte). Historia z API (Instagram 30 dni) uzupełnia luki wstecz przy pierwszym uruchomieniu.

## Trasy (`moduly/konta.js`)

- `GET /api/konta?okres=7|30|90` → `{ konta: [ { platforma, nazwa, uchwyt, avatar, polaczone, obserwujacy, zmiana, seria: [{dzien, wartosc}], dodatkowe: { zasieg, wyswietlenia, filmy, odwiedziny } } ], wykres: { platforma: "instagram", seria: [...], lacznie, srednio_dziennie, najlepszy_tydzien: {od, do, przyrost} }, wskazniki: [ { etykieta, wartosc, zmiana_proc, dopisek } ] }`.
  Awatary: zwracaj adresy z API (są publiczne, CDN); front ładuje je bezpośrednio. Bez tokenów w odpowiedzi.
- `POST /api/konta/odswiez` → pobiera na nowo wszystkie konta i zapisuje snapshot; postęp jak w Publikacjach.
- Błąd jednej platformy nie psuje reszty: karta dostaje `blad` i wyświetla go szaro.

## Front (`app/konta.js`)

- `window.Konta = { start() }`, rysuje do `#konta-tresc` (Claude doda sekcję `#widok-konta`, przycisk `.zakladka[data-widok="konta"]`
  w `.pasek-dol` nad Ustawieniami z ikoną i wpis w `index.html`; do tego czasu jeśli kontenera nie ma, `start()` nic nie robi).
- Układ 1:1 z makietą: nagłówek z przełącznikiem 7/30/90 dni, cztery karty (Instagram, YouTube, Facebook, TikTok;
  niepołączona = przerywana ramka i przycisk „Połącz" prowadzący do Ustawień: `document.querySelector('.zakladka[data-widok="ustawienia"]').click()`),
  awatar 30 px okrągły ze złotym obrysem przy karcie z największym wzrostem, liczba 24 px, „+14 w 7 dni" złotem gdy dodatnie,
  szaro gdy 0, sparkline SVG 120×32 bez zależności, pod spodem zasięg/wyświetlenia.
- Wspólny wykres 90 dni (SVG, oś z 3 datami, zaznaczony najlepszy tydzień jasnozłotym prostokątem o kryciu 0,06,
  punkt na końcu). Kliknięcie punktu dnia → przełącza na zakładkę Analiza i wpisuje datę w pole szukania
  (`#szukaj`) w formacie `dd.mm`, żeby pokazać rolki z tego dnia.
- Trzy kafelki wskaźników: zasięg 30 dni (Instagram) ze zmianą % do poprzednich 30 dni, odwiedziny profilu 30 dni,
  nowi obserwujący na 1000 wyświetleń (z Analizy: suma obserwujących z rolek jeśli dostępna, inaczej z historii kont).
- Style: klasy z `style.css` (`.kafelek`, `.plansza`, `.przycisk`, `.pod`, `.sygnal`), reszta w `<style id="konta-style">`.
  Paleta jak w AGENTS.md. Bez „—".

## Test

`narzedzia/test_konta.js` offline: liczenie zmiany i serii dla okresu (z luk w historii), najlepszy tydzień, scalanie
historii z API z lokalnymi zapisami (bez nadpisywania nowszych), odporność na brak platformy. `OK` albo różnica, kod 0/1.
Wpis w `DYSKUSJA.md` z listą rzeczy, które ma dopisać Claude (sekcja w `index.html`, przycisk, zakres YouTube Analytics).
