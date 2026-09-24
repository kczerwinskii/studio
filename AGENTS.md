# Studio — aplikacja Kuby do rolek (analiza, research, publikacje)

Własna aplikacja desktopowa (Electron, jak `C:\Users\pc\Desktop\skrypty`). Jedno okno, zakładki po lewej:
**Analiza** (statystyki własnych rolek z API Instagrama), **Research** (cudze rolki z niszy), **Publikacje**
(planowanie i wysyłka), **Ustawienia** (token, konto). Powstała 24.09.2026. Właściciel: Kuba Czerwiński,
trener personalny online, Instagram `kubaczerwinskii`.

## Zasady, które obowiązują każdego agenta

- **Zero zależności npm poza Electronem.** Serwer to czysty Node (`http`, `https`, `fs`). `node_modules/`
  zawiera tylko Electrona skopiowanego ze Skryptów. Nie instaluj pakietów.
- **Pliki tylko z LF**, UTF-8 bez BOM. Nazwy zmiennych, funkcji i komentarze po polsku (bez ogonków
  w identyfikatorach, z ogonkami w tekstach dla użytkownika).
- **Sekrety poza kodem.** Tokeny i klucze w `config/` (w `.gitignore`), czytane przez `serwer.js`.
  Nigdy nie wypisuj tokena w logach ani w UI w całości.
- **Dane w `dane/*.json`**, jeden plik na zakładkę (`rolki.json`, `notatki.json`, ...). Zapis atomowy
  (najpierw plik tymczasowy, potem rename).
- **Wygląd = paleta marki Kuby** (zaakceptowana 24.09.2026): podkład grafit `#0E0E12`, panele `#141419` /
  `#1B1B22`, linie `#2A2A33`, tekst kość słoniowa `#EFE9DA`, tekst drugorzędny `#D6CEB9`, przygaszony
  `#8C877A`, mosiądz `#C9A455` (główny) / `#E6CB80` (światło) / `#8E6B2E` (cień) / `#5E4519` (obrys).
  Zasada: **złoto obrysowuje, biel wypełnia, czerń podkłada** — złoto tylko na ramkach, akcentach
  i aktywnej zakładce, nigdy jako duże plamy. Krój Poppins z `app/fonty/`. Minimalizm: mało danych
  na ekranie naraz, jedna rzecz naraz, bez ozdobników. Zmiany wyglądu pokazuj Kubie jako podgląd
  przed wdrożeniem.
- **Bez długich myślników „—" w tekstach UI.** Zwykły łącznik albo przecinek.
- **Sygnał zamiast oceny.** Aplikacja nie mówi „dobra rolka / zła rolka", tylko wskazuje, gdzie patrzeć
  (jak skill `analiza-rolek` w vaultcie: `Obsidian/Kuba/.agents/skills/analiza-rolek/`).
- **Instagram jest platformą główną.** Analiza i Research dotyczą wyłącznie rolek na Instagramie i pod
  Instagram powstają treści. YouTube, Facebook i TikTok to **tylko publikacje** (i ewentualnie odpowiedzi
  na komentarze i wiadomości), bez analizy tych platform (decyzja Kuby 24.09.2026).
- Kuba **nie robi zrzutów ekranu** z telefonu (decyzja 24.09.2026). Wszystko, co pokazuje aplikacja,
  musi dać się pobrać z API albo policzyć lokalnie. Krzywej retencji API nie daje i nie ma jej szukać.

## Struktura

```
main.js            okno Electrona, start serwera (wzór: skrypty/main.js)
serwer.js          serwer HTTP bez zależności: statyczne app/ + API /api/...
app/               index.html, style.css, app.js, fonty/, moduły zakładek
app/analiza.js     silnik liczący (port analiza.py) — używany w przeglądarce i w Node
narzedzia/         skrypty pomocnicze i testy (Node), Python z montażu: C:\Users\pc\Desktop\montaz\.venv\Scripts\python.exe
config/            meta_user_token.txt, meta_app_secret.txt, ustawienia.json (poza gitem)
dane/              rolki.json, notatki.json (poza gitem)
```

## Meta / Instagram (stan 24.09.2026)

- Aplikacja Meta „Kuba Czerwinski Studio", ID `1823206525790813`, portfolio „Kuba Czerwiński Online"
  `1495853945685937`. Tryb deweloperski, bez przeglądu: działa tylko dla konta Kuby.
- Strona FB `1195244580344085`, konto IG business `17841402043539936`.
- Graph API v25.0. Media: `/{ig}/media?fields=id,media_product_type,media_type,timestamp,caption,
  like_count,comments_count,permalink,thumbnail_url,media_url`. Insights rolki: `/{media}/insights?metric=
  views,reach,saved,shares,likes,comments,total_interactions,ig_reels_avg_watch_time,
  ig_reels_video_view_total_time` (czas w ms). Długość rolki: `ffprobe` na `media_url` (API jej nie daje).
- Token użytkownika z Graph API Explorer jest krótkotrwały; długotrwały (60 dni) przez
  `/oauth/access_token?grant_type=fb_exchange_token` z app secret.

## Współpraca Claude + Codex (zasada Kuby, 24.09.2026)

Kuba chce, żeby dwa agenty **dzieliły się pracą i współpracowały**, nie żeby jeden robił wszystko.
- **Podział:** każda zakładka/moduł to osobny plik i osobny agent. Claude: szkielet, serwer, Analiza,
  Ustawienia, Publikacje. Codex: silnik `app/analiza.js` (zrobione), Research (`moduly/research.js`,
  `app/research.js`), kolejne moduły wg zadań.
- **Zadania:** `narzedzia/zadania/NN-nazwa.md` (kontrakt, dane, test). Wykonawca dopisuje wynik na końcu
  tego samego pliku. Zadania „NN-przeglad-*.md" to przegląd cudzego modułu.
- **Przegląd:** po skończeniu modułu drugi agent go czyta i testuje (błędy, bezpieczeństwo tokenów,
  zgodność z paletą i z tym plikiem) i pisze uwagi do `narzedzia/DYSKUSJA.md`. Autor odpowiada tam samo
  i poprawia albo uzasadnia, czemu nie.
- **Dyskusja:** `narzedzia/DYSKUSJA.md` to wspólny dziennik: propozycje ulepszeń, zastrzeżenia, decyzje.
  Wpis = data, podpis (Claude/Codex), temat, 2-6 zdań. Kuba to czyta, więc bez żargonu tam, gdzie się da.
- **Nie ruszaj cudzego pliku bez wpisu w DYSKUSJA.md.** Wspólne pliki (`serwer.js`, `app/app.js`,
  `app/index.html`, `app/style.css`) zmienia Claude; Codex zgłasza potrzebę w dyskusji albo w wyniku zadania.
