# Zadanie 01: port silnika analiza-rolek do JavaScriptu

Przenieś logikę z `C:\Users\pc\Desktop\Obsidian\Kuba\.agents\skills\analiza-rolek\analiza.py`
(funkcje `benchmark`, `przedzial`, `mediana`, `przelicz`, `klasyfikuj`, `pary`, stałe `BENCHMARK`,
`PRZEDZIALY`) do pliku `app/analiza.js`. Przeczytaj też `SKILL.md` obok, żeby rozumieć, po co są te
liczby. Nie zmieniaj wzorów ani progów: to jest wynik kilku tygodni kalibracji na rolkach Kuby.

## Kształt danych (kontrakt z serwerem)

Rolka (obiekt z `dane/rolki.json`), pola mogą być `null`, gdy API czegoś nie dało:

```js
{
  id: "18632775631034317",      // id media w Graph API
  data: "2026-09-24T10:12:00+0000", // timestamp publikacji z API
  tytul: "Pośladki",            // pierwsza linia opisu, do 80 znaków
  opis: "…",                    // pełny caption
  dlugosc: 45.4,                // sekundy, z ffprobe; null gdy nie zmierzono
  wyswietlenia: 183, zasieg: 136, zapisania: 0, udostepnienia: 0,
  polubienia: 2, komentarze: 0,
  obserwujacy: null,            // metryka follows, gdy API ją daje; inaczej null
  czas_ogl: 4.33,               // średni czas oglądania w sekundach (ig_reels_avg_watch_time / 1000)
  permalink: "https://www.instagram.com/reel/…/",
  miniatura: "https://…"
}
```

## Co ma eksportować `app/analiza.js`

Moduł ma działać i w przeglądarce (`window.Analiza`), i w Node (`module.exports`), bez zależności.

- `przelicz(rolka)` → kopia rolki z polami `retencja`, `indeks`, `zapisy_1k`, `udost_1k`, `obs_1k`,
  `powtorki`, `wysw_na_obs` (jak w Pythonie; `obs_1k` i `wysw_na_obs` = `null`, gdy `obserwujacy` jest null).
- `podsumuj(rolki)` → `{ n, med_ret, med_indeks, wsk_zapisy, wsk_obs, przedzialy: { "0-15 s": { n, med_ret, med_indeks }, … } }`.
  Mediany z rolek, które mają `retencja`; wskaźniki z PULI (suma zdarzeń / suma wyświetleń × 1000), jak w Pythonie.
  `wsk_obs` = null, gdy żadna rolka nie ma `obserwujacy`.
- `sygnaly(rolka_przeliczona, podsumowanie)` → tablica `{ kod, tekst }`, gdzie `kod` ∈
  `brak_czasu | petla | ponizej | powyzej | zero_zapisan | zero_obs | norma`, a `tekst` to zdanie
  z Pythona (bez „—", użyj przecinka albo dwukropka). Progi i warunki 1:1 z `klasyfikuj`.
  Alarm `zero_obs` tylko, gdy `wsk_obs` nie jest null.
- `pary(rolki)` → obiekt `{ [id]: { rola: "prawdopodobnie próbna" | "prawdopodobnie zwykła", para: id } }`
  (ta sama długość ±0.5 s i publikacja w odstępie do 5 minut).
- `benchmark(dlugosc)`, `przedzial(dlugosc)`, `mediana(tablica)` też eksportowane.

## Test

`narzedzia/test_analiza.js` (Node, bez zależności): buduje 6-8 rolek testowych (w tym: bez długości,
z retencją ≥ 1, para próbna/zwykła, rolka z dużym zasięgiem i zerem zapisań), liczy JS-em, a potem
odpala Pythona (`C:\Users\pc\Desktop\montaz\.venv\Scripts\python.exe`) z małym skryptem, który importuje
`analiza.py` (dodaj katalog skillu do `sys.path`) i liczy to samo dla tych samych danych. Porównaj
`retencja`, `indeks`, `zapisy_1k`, mediany i listy uwag (po kodach, nie po tekstach). Test wypisuje
`OK` albo pierwszą różnicę i kończy się kodem 0/1. Uruchom go i wklej wynik na końcu tego pliku.

## Zasady

Czytaj `AGENTS.md` w tym katalogu. LF, UTF-8 bez BOM, bez zależności, identyfikatory bez ogonków.
Nie ruszaj innych plików niż `app/analiza.js`, `narzedzia/test_analiza.js` i ten plik.

## Wynik wykonania (2026-09-24)

- Gotowe: `app/analiza.js`, eksport do Node i `window.Analiza`, przeliczenia, podsumowania, sygna?y i pary z tolerancj? 0,5 s / 5 minut.
- Zachowano wzory, progi i teksty Pythona (d?ugie my?lniki zamienione na przecinki), zgodnie z zadaniem. Teksty ?r?d?owe nadal wspominaj? zrzuty; ich ewentualna zmiana pod prac? wy??cznie z API pozostaje poza tym portem.
- Brakuj?ce metryki pochodne pozostaj? null; brak czasu lub d?ugo?ci wyklucza retencj? z median. Licznik n obejmuje wszystkie rolki w danej grupie. Wska?niki puli maj? wsp?lny mianownik ze wszystkich wy?wietle?, jak w Pythonie; brakuj?ce liczniki nie dodaj? zdarze?. Przy ca?kowitym braku obserwuj?cych wsk_obs = null.
- Test obejmuje 8 rolek, por?wnuje liczby, mediany, wska?niki puli, wszystkie 7 kod?w sygna??w i pary z importowanym Pythonem. Dodatkowo sprawdza granice przedzia??w i par, null, zera, brak mutacji oraz eksport przegl?darkowy. Adapter Pythona obs?uguje wy??cznie r??nice kontraktu API.
- Test u?ywa sprz?tanych plik?w tymczasowych zamiast potok?w proces?w blokowanych w sandboxie Windows; Python uruchamiany z -B, bez zapisu cache w vaultcie.

Polecenie: `node narzedzia/test_analiza.js`

```text
OK
```

Kod wyj?cia: 0.
