# Zadanie 06: poprawki w module Publikacje po przeglądzie (Codex)

Przeczytaj `AGENTS.md`, `narzedzia/DYSKUSJA.md` (Twój wpis z przeglądu, zadanie 03) i pliki
`moduly/publikacje.js`, `app/publikacje.js`. Kuba chce, żebyś **sam wprowadził poprawki** z własnego
przeglądu, bo Claude ma mniej limitu. Na to zadanie masz wyjątkowo prawo edytować oba pliki modułu
Publikacje (dalej NIE ruszasz `serwer.js`, `app/app.js`, `app/index.html`, `app/style.css`).

Zasady poprawek:
- Najpierw błędy, które mogą zepsuć publikację albo skasować dane: wyścig przy zapisie kolejki
  (odczyt-modyfikacja-zapis z różnych tras; wprowadź jedną funkcję `zmien(n, id, fn)` która czyta, modyfikuje
  i zapisuje atomowo, i użyj jej wszędzie), utrata statusu „zaplanowane” po teście, podwójna wysyłka
  (harmonogram kontra ręczne „Opublikuj teraz”), zerwanie sieci w trakcie wysyłki (status „błąd” z czytelnym
  komunikatem, pozycja zostaje do ponowienia).
- Potem reszta z przeglądu wg Twojej kolejności ważności. Nie zmieniaj wyglądu ani palety.
- Zachowaj kontrakty tras (`/api/publikacje/...`) i kształt `dane/publikacje.json` (dodawać pola można,
  usuwać nie), bo korzysta z nich front i przyszły moduł YouTube (`opublikujNaYouTube` będzie wołane po
  Instagramie, gdy `pozycja.youtube === true`, analogicznie do Facebooka).
- Po każdej poprawce `node --check`. Dopisz do `narzedzia/test_publikacje.js` testy offline tego, co da się
  sprawdzić bez sieci (np. `zmien`, składanie parametrów kontenera z pozycji, statusy po teście).
- Na końcu: wpis w `DYSKUSJA.md` (co poprawione, co zostawione i czemu) i wynik testu w tym pliku.

## Wynik, 2026-09-24, Codex

Wprowadzono poprawki w `moduly/publikacje.js` i `app/publikacje.js`; utworzono brakujący `narzedzia/test_publikacje.js`.

- Wszystkie modyfikacje kolejki przechodzą przez synchroniczne `zmien(n, id, fn)` z atomowym zapisem JSON. Upload okładki ponownie sprawdza istnienie i status pozycji po zakończeniu przesyłania.
- Rezerwacja wysyłki następuje przed odpowiedzią 202; konflikt zwraca 409, brak pozycji 404. Test zachowuje poprzedni status i termin. Restart przywraca możliwość ponowienia przerwanego uploadu, a niepewna publikacja ma blokadę duplikatu oraz zapisany etap/ID.
- Obsłużono timeouty, przerwane odpowiedzi i błędy plików, wymagany jest dokładny wybór strony FB, a częściowy sukces można ponowić bez powtórnego Instagrama.
- Dodano bezpieczne uploady i sprzątanie plików, walidację terminów, kolejność zaległości, kończenie zapisów panelu przed wysyłką i ponawianie odświeżania po błędzie.
- Kontrakty tras i dotychczasowe pola danych zachowane. Wygląd, paleta i wspólne pliki niezmienione. Szczegółowe ograniczenia dotyczące nocnych godzin kalendarza, uzgadniania niepewnego wyniku z API oraz sprzątania zdalnych zdjęć po restarcie opisano w końcowym wpisie `narzedzia/DYSKUSJA.md`.

Weryfikacja: `node --check moduly/publikacje.js`, `node --check app/publikacje.js`, `node --check narzedzia/test_publikacje.js` zakończone kodem 0. `node narzedzia/test_publikacje.js`: **21/21 testów offline, kod 0**. Testy używają atrap transportu, izolowanej kolejki i tymczasowych plików; nie czytają sekretów ani nie modyfikują danych aplikacji. Pliki zapisane jako UTF-8 bez BOM, z LF. Nie wykonywano prób sieciowych ani rzeczywistej publikacji.
