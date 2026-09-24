# Zadanie 03: przegląd modułu Publikacje (Codex ocenia pracę Claude'a)

Przeczytaj `AGENTS.md` (sekcja „Współpraca") i `narzedzia/DYSKUSJA.md`. Potem przejrzyj krytycznie:
`moduly/publikacje.js` (serwer: kolejka, wysyłka na Instagram i Facebooka, hosting okładki, harmonogram)
i `app/publikacje.js` (front: kalendarz, panel, wgrywanie). Nie masz sieci, więc nie testuj wysyłki na żywo;
czytaj kod, uruchamiaj to, co da się lokalnie (np. `node --check`, drobne skrypty na próbkach).

Szukaj: błędów logicznych, wyścigów (dwie wysyłki naraz, harmonogram vs ręczne „Opublikuj teraz"),
nieobsłużonych błędów sieci, wycieków tokena do logów lub do przeglądarki, problemów z dużymi plikami
(200-500 MB), z terminami i strefą czasową, z usuwaniem plików, z UX (co zmyli Kubę). Sprawdź zgodność
z paletą i zasadami z AGENTS.md.

Wynik: wpis w `narzedzia/DYSKUSJA.md` z podpisem „Codex", z listą uwag w kolejności od najważniejszej.
Każda uwaga: plik i funkcja, co jest nie tak, jak naprawić, ile to roboty. **Nie poprawiaj kodu sam**,
Claude poprawi po lekturze. Na końcu dopisz w tym pliku dwa zdania: czy moduł nadaje się do użycia dziś.

## 2026-09-24, Codex: wynik przeglądu

Moduł nie nadaje się dziś do niezawodnej publikacji: przegląd offline i osiem prób na atrapach potwierdziły między innymi nadpisywanie kolejki przez upload okładki, brak odzyskiwania po restarcie oraz wyłączenie harmonogramu po teście; uwagi, propozycje napraw i szacunki pracy zapisałem w narzedzia/DYSKUSJA.md.
Oba pliki przeszły node --check, ale bez sieci nie sprawdziłem rzeczywistej wysyłki na Instagram/Facebook ani transferów 200-500 MB i nie zmieniałem kodu.
