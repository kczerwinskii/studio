# Zadanie 05: moduł TikTok (wysyłka rolek) — Codex

## Kontekst

Publikacje wysyłają rolki na Instagram, stronę FB i (moduł 04) YouTube. Kuba chce też TikTok.
Ograniczenie TikToka: dopóki aplikacja nie przejdzie audytu, Content Posting API publikuje tylko z
`privacy_level = SELF_ONLY` (widzi tylko autor), Kuba przełącza widoczność w aplikacji TikTok. Po audycie
moduł ma pozwolić na `PUBLIC_TO_EVERYONE`. Rejestrację aplikacji u deweloperów TikToka zrobi Kuba z Claude'em;
`client_key` i `client_secret` trafią do `config/tiktok_klient.json` (`{ "client_key", "client_secret" }`),
pola w Ustawieniach doda Claude (div `#tiktok-ustawienia` w `index.html`, jak dla YouTube).

## Moduł `moduly/tiktok.js` (Node, bez zależności, wzór `moduly/publikacje.js` i `moduly/youtube.js`)

1. **OAuth v2 z PKCE** (Login Kit, aplikacja desktopowa):
   - `GET /api/tiktok/stan` → `{ skonfigurowany, polaczony, konto: { open_id, nazwa, avatar } | null, blad }`.
   - `GET /api/tiktok/polacz` → `{ url }`: `https://www.tiktok.com/v2/auth/authorize/?client_key=…&scope=user.info.basic,video.publish,video.upload&response_type=code&redirect_uri=…&state=…&code_challenge=…&code_challenge_method=S256`.
     `redirect_uri` = `http://127.0.0.1:<port>/api/tiktok/callback` (port z `narzedzia.port()`). Uwaga: TikTok może
     wymagać zarejestrowanego, dokładnie takiego samego adresu w panelu aplikacji; Claude go tam wpisze.
     `code_verifier` trzymaj w pamięci modułu do czasu callbacku.
   - `GET /api/tiktok/callback?code&state` → `POST https://open.tiktokapis.com/v2/oauth/token/`
     (`client_key, client_secret, code, grant_type=authorization_code, redirect_uri, code_verifier`,
     `Content-Type: application/x-www-form-urlencoded`) → zapis `config/tiktok_token.json`
     (`access_token`, `refresh_token`, `open_id`, `wygasa`, `refresh_wygasa`), potem
     `GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url` i zapis konta,
     odpowiedź stroną HTML „Połączono z TikTokiem, możesz zamknąć kartę" w palecie Studio.
   - Odświeżanie tokena (`grant_type=refresh_token`) gdy wygasa za < 2 min. `POST /api/tiktok/rozlacz`.
2. **Wysyłka** — eksport `opublikujNaTikToku(narzedzia, pozycja, ustawStatus)`:
   - `POST https://open.tiktokapis.com/v2/post/publish/video/init/` z `Authorization: Bearer`, JSON:
     `{ post_info: { title: <opis do 2200 znaków>, privacy_level: pozycja.tiktok_widocznosc || "SELF_ONLY",
     disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: <okladka_s*1000 albo 1000> },
     source_info: { source: "FILE_UPLOAD", video_size: <bajty>, chunk_size: <bajty>, total_chunk_count: 1 } }`
     (jeden kawałek, gdy plik ≤ 64 MB; większe pliki tnij na kawałki po 10 MB zgodnie z zasadami TikToka:
     każdy kawałek ≥ 5 MB poza ostatnim, `total_chunk_count = ceil(size/chunk)`).
   - Z odpowiedzi `data.upload_url` i `data.publish_id`. Wysyłka: `PUT upload_url` z nagłówkami
     `Content-Type: video/mp4`, `Content-Length`, `Content-Range: bytes <od>-<do>/<razem>` (strumieniem z dysku).
   - Status: `POST https://open.tiktokapis.com/v2/post/publish/status/fetch/` z `{ publish_id }` co 5 s, aż
     `PUBLISH_COMPLETE` (albo `FAILED` → błąd z `fail_reason` po polsku). Maks. 5 minut.
   - Zwraca `{ publish_id, widocznosc }`. Linku do filmu API nie daje; w UI pokaż „opublikowano na TikToku
     (widoczne tylko dla Ciebie do czasu audytu)".
   - Błędy: `access_token_invalid` → „TikTok wylogował aplikację, połącz ponownie", `rate_limit_exceeded` →
     „limit TikToka, spróbuj za chwilę", `unaudited_client_can_only_post_to_private_accounts` → „aplikacja
     przed audytem: ustaw widoczność Tylko ja".
3. **Front** `app/tiktok.js`: `window.TikTok = { start(), stan() }`, rysuje do `#tiktok-ustawienia`
   (stan, „Połącz z TikTokiem"/„Rozłącz", nazwa konta, informacja o audycie). Style jak w YouTube.
4. **Test** `narzedzia/test_tiktok.js` (offline): PKCE (verifier/challenge S256 poprawny wg RFC 7636 na znanym
   przykładzie), adres autoryzacji, podział na kawałki (rozmiary 3 MB, 64 MB, 150 MB), składanie `post_info`,
   tłumaczenie błędów. `OK` albo różnica, kod 0/1.

## Zasady

`AGENTS.md`. Bez sieci. Nie zmieniaj plików wspólnych ani cudzych modułów; potrzeby wypisz w `DYSKUSJA.md`.
Pisz i zapisuj plik po pliku. Wynik testu dopisz tutaj.

## Wynik, 2026-09-24, Codex

Wykonano `moduly/tiktok.js`, `app/tiktok.js` i `narzedzia/test_tiktok.js`, zapisując pliki osobno. Moduł obsługuje OAuth v2 z PKCE S256, jednorazowy state ważny 10 minut, atomowy zapis tokenów przez `narzedzia.zapiszJson`, odświeżanie z wyprzedzeniem 2 minut i rozłączanie chronione przed odtworzeniem tokena przez trwające żądanie. Wysyłka korzysta ze strumienia pliku, kawałków zgodnych z kontraktem, limitów czasu i sprawdzania statusu co 5 sekund przez maksymalnie 5 minut. Panel udostępnia `window.TikTok.start()` i `stan()`, nazwę konta, przyciski połączenia oraz informację o audycie.

Test `node narzedzia/test_tiktok.js`: **OK, 17 testów offline, kod 0**. Pokrycie: przykład RFC 7636, adres OAuth, podział 3/64/150 MB i niepełny ostatni kawałek, post_info, Unicode, okładka od 0 s, tłumaczenia błędów, callback i jednorazowość/ważność state, brak tokenów w stanie, upload i Content-Range, polling, odświeżanie i rotacja tokenów, rozłączenie podczas odświeżania, obcy host uploadu, błąd dysku, FAILED i limit 5 minut. Transport, pliki tokenów i zegar w testach są atrapami.

Potrzeby integracji z Ustawieniami i Publikacjami opisano w `narzedzia/DYSKUSJA.md`. Nie zmieniano plików wspólnych ani cudzych modułów; panel pozostaje do podglądu przed podłączeniem przez Claude'a. Nie używano sieci, dokumentacji online ani prawdziwego API; zgodność rzeczywistego logowania i publikacji wymaga późniejszej próby online.
