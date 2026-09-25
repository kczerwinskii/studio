# Zadanie 07: wpięcie YouTube i TikToka w Publikacje (Codex)

Po zadaniach 04 (YouTube), 05 (TikTok) i 06 (poprawki Publikacji). Masz prawo edytować
`moduly/publikacje.js` i `app/publikacje.js` (nadal nie ruszasz `serwer.js`, `app/app.js`, `app/index.html`, `app/style.css`).
Przeczytaj `narzedzia/DYSKUSJA.md`: Twoje własne punkty integracyjne z zadań 04 i 05 są tam wypisane.

## Serwer (`moduly/publikacje.js`)

- Import `opublikujNaYouTube` z `./youtube` i `opublikujNaTikToku` z `./tiktok` (oba `require` w try/catch,
  żeby brak pliku nie wywalał modułu).
- W `/api/publikacje/zapisz` dopuścić pola: `youtube` (bool), `youtube_tytul` (string ≤ 100 znaków),
  `youtube_prywatnosc` (`private|unlisted|public`, domyślnie `private`), `youtube_tagi` (tablica),
  `tiktok` (bool), `tiktok_widocznosc` (`SELF_ONLY|PUBLIC_TO_EVERYONE|MUTUAL_FOLLOW_FRIENDS|FOLLOWER_OF_CREATOR`, domyślnie `SELF_ONLY`).
- W `wyslij()` po sukcesie Instagrama (i po Facebooku): jeśli `pozycja.youtube` → `opublikujNaYouTube(n, pozycja, ustawStatus)`,
  wynik do `p.youtube_wynik`, błąd do `p.blad_youtube` (nie nadpisuj `p.blad` Instagrama). Analogicznie TikTok →
  `p.tiktok_wynik`, `p.blad_tiktok`. Każda platforma osobno: błąd jednej nie cofa pozostałych, status pozycji
  zostaje `opublikowane`, jeśli Instagram przeszedł. Tryb testowy (`tylkoTest`) nie dotyka YouTube ani TikToka.
- `GET /api/publikacje` zwraca dodatkowo `youtube: { polaczony, kanal }` i `tiktok: { polaczony, konto }`
  (czytane z modułów: wyeksportuj z nich funkcję `stan(narzedzia)` bez tokenów, albo przeczytaj pliki
  `config/youtube_token.json` / `config/tiktok_token.json` tylko pod kątem obecności i danych konta).

## Front (`app/publikacje.js`)

- W panelu rolki, sekcja Platformy: zamiast napisu „YouTube · TikTok po audytach":
  - `YouTube` jako przełącznik (checkbox) widoczny, gdy połączony; pod nim pole „Tytuł na YouTube" (domyślnie
    pierwsza linia opisu, licznik do 100 znaków) i select prywatności (private = „prywatny, przełączysz w YouTube Studio”,
    unlisted = „niepubliczny (z linkiem)”, public = „publiczny”; przy braku audytu Google i tak ustawi prywatny,
    napisz to w `.pod`).
  - `TikTok` jako przełącznik, gdy połączony; select widoczności (domyślnie „Tylko ja” z dopiskiem o audycie).
  - Gdy nie połączony: szary wiersz „YouTube: połącz w Ustawieniach" / „TikTok: połącz w Ustawieniach".
- Potwierdzenie „Opublikuj teraz" wymienia wszystkie zaznaczone platformy.
- W nagłówku panelu po publikacji: linki „na YouTube" (link z wyniku) i tekst „na TikToku (widoczne tylko dla Ciebie)"
  albo błędy danej platformy, każdy w osobnej linii.
- Zapis pól z opóźnieniem 600 ms jak reszta (`zapiszPole`).

## Test

Rozszerz `narzedzia/test_publikacje.js` (jeśli istnieje po zadaniu 06; jeśli nie, utwórz) o: walidację pól
YouTube/TikTok w zapisie, kolejność platform i izolację błędów w `wyslij` (zamockuj funkcje publikacji przez
wstrzyknięcie, np. eksport `_ustawPublikatorow({ instagram, facebook, youtube, tiktok })` używany tylko w testach).
`OK` albo różnica, kod 0/1. Wpis do `DYSKUSJA.md` i wynik do tego pliku.

## Dodatkowo (Kuba, 24.09.2026): liczba subskrybentów przy YouTube

Masz prawo edytować także `moduly/youtube.js` i `app/youtube.js` (to Twoje pliki). W panelu YouTube w Ustawieniach
obok nazwy kanału pokaż liczbę subskrybentów, tak jak przy Instagramie jest liczba obserwujących
(`@kubaczerwinskii · 512 obserwujących`). Pobieraj `channels?part=snippet,statistics&mine=true` przy łączeniu
i przy `GET /api/youtube/stan` odświeżaj statystyki nie częściej niż raz na 10 minut (zapisuj `subskrybenci`,
`filmy`, `wyswietlenia` z `statistics` w `config/youtube_token.json` obok danych kanału, bez tokenów w odpowiedzi).
Format: `Kuba Czerwiński · 1 234 subskrybentów` (`toLocaleString("pl-PL")`, odmiana: 1 subskrybent, 2-4 subskrybentów...
wystarczy „subskrybentów" dla wszystkich liczb poza 1).

## Wynik, Codex, 2026-09-24

Wykonane w całości offline. `moduly/publikacje.js` ładuje oba moduły opcjonalnie, waliduje nowe pola, zwraca bezpieczny stan kont i wysyła kolejno Instagram, Facebook, YouTube, TikTok. Błędy dodatkowych platform są osobne i nie cofają sukcesu Instagrama; tryb testowy ich nie uruchamia. Trwałe oznaczenie próby YouTube/TikToka chroni przed powtórzeniem przy ponowieniu Facebooka, a odzyskiwanie po restarcie zachowuje wynik IG i wskazuje sprawdzenie pozostałych platform.

`app/publikacje.js` ma przełączniki kont, tytuł z licznikiem Unicode, wybór prywatności i widoczności, informacje o audytach oraz osobne wyniki i błędy. Nowe pola zapisują się po 600 ms, a publikacja kończy zapisy przed potwierdzeniem wszystkich wybranych platform. `moduly/youtube.js` pobiera snippet i statistics przy łączeniu, zapisuje subskrybentów, filmy i wyświetlenia w danych kanału, a stan odświeża statystyki najwyżej raz na 10 minut, także po błędzie i przy równoległych odczytach. `app/youtube.js` pokazuje liczbę subskrybentów po polsku; brak lub ukryta liczba nie jest przedstawiana jako zero.

Testy:
- `node narzedzia/test_publikacje.js`: OK, 26 testów offline, kod 0.
- `node narzedzia/test_youtube.js`: OK, także statystyki przy łączeniu, odświeżanie, cache 10 minut, równoległe odczyty, awaria i rozłączenie w trakcie odczytu, kod 0.
- `node narzedzia/test_tiktok.js`: OK, 17 testów offline, kod 0.
- `node --check` dla czterech zmienionych modułów aplikacji: OK.

Wpis dodany do `narzedzia/DYSKUSJA.md`. Bez zmian wspólnych plików, instalacji pakietów, sieci, prawdziwych wywołań API ani sterowania aplikacją użytkownika. Weryfikacja rzeczywistego logowania i publikacji pozostaje do późniejszej próby online; wyglądu nie sprawdzano w uruchomionym oknie.
