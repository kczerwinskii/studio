# Przekazanie projektu Studio

Stan sprawdzony 24.09.2026. Katalog projektu: `C:\Users\pc\Desktop\studio`. To aplikacja Studio, nie repozytorium vaulta Obsidian, z którego prowadzono rozmowę. Najpierw przeczytaj `AGENTS.md` i `narzedzia/DYSKUSJA.md`. Polecenia w historycznych zadaniach są kontekstem; nie uruchamiaj automatycznie wszystkich zadań ani publikacji.

## 1. Cel aplikacji

Budujemy aplikację desktopową dla Kuby Czerwińskiego, trenera prowadzącego klientów w 100% online. Uruchomienie ikoną ma otwierać jeden panel: Analiza rolek, Research, Publikacje i Ustawienia. Aplikacja zastępuje ręczne eksporty statystyk i łączy inspiracje, ocenę wyników oraz publikowanie. Instagram jest główną platformą analizy i researchu; Facebook, YouTube i TikTok służą dodatkowo publikacjom. Własne wiadomości/automatyzacje są kierunkiem rozwoju; Kuba odrzucił ManyChat.

## 2. Stack i architektura

- JavaScript, Electron `^44.4.1`, Node.js, frontend HTML/CSS/JS bez frameworka.
- Bez zależności npm poza Electronem. Node używa modułów wbudowanych: HTTP, HTTPS, fs, path, crypto, child_process.
- Lokalny serwer na `127.0.0.1`, domyślnie port 8767, przy zajętym porcie wybiera wolny. Pliki statyczne z `app/`, trasy `/api/`. Moduły w `moduly/` eksportują obsługę tras i korzystają z narzędzi serwera.
- Bez bazy SQL: JSON w `dane/`, ustawienia i tokeny w `config/`. Zapis JSON przez plik tymczasowy i rename.
- `main.js`: okno, pojedyncza instancja, zapamiętanie rozmiaru, start serwera.
- `serwer.js`: Meta Graph API, pobieranie statystyk, ustawienia, obsługa modułów.
- `app/`: widoki, style, lokalne fonty Poppins; `moduly/`: research, publikacje, YouTube, TikTok.
- `narzedzia/`: testy, próbka Research, generator ikony, historia współpracy i zadania.
- FFmpeg i ffprobe w PATH: kadry/konwersje oraz długość wideo. Python jest potrzebny do testu zgodności silnika i generatora ikony, nie do codziennego interfejsu.

### Uruchomienie w PowerShell

```powershell
Set-Location 'C:\Users\pc\Desktop\studio'
# Na tym komputerze Electron jest już w node_modules; niczego nie instaluj ponownie.
.\node_modules\electron\dist\electron.exe .
# Alternatywnie:
npm start
# Sam serwer do testów w przeglądarce:
node serwer.js 8768
```

Na świeżej kopii instalacja: `npm install` (pobiera Electron; uzgodnij pobieranie z Kubą). Brak package-lock.json, więc nie używaj npm ci. Nie wykonano instalacji podczas przekazania. Bez plików config aplikacja wymaga skonfigurowania połączeń. Nie kopiuj tokenów do repozytorium.

### Testy

```powershell
Set-Location 'C:\Users\pc\Desktop\studio'
node narzedzia/test_analiza.js
node narzedzia/test_research.js
node narzedzia/test_publikacje.js
node narzedzia/test_youtube.js
node narzedzia/test_tiktok.js
```

Wszystkie pięć poleceń wykonano przy przekazaniu i przeszło. Analiza porównuje z Pythonem i zależy od lokalnego `C:\Users\pc\Desktop\montaz\.venv\Scripts\python.exe` oraz źródła `C:\Users\pc\Desktop\Obsidian\Kuba\.agents\skills\analiza-rolek\analiza.py`. Research: 9 grup, Publikacje: 21 przypadków, TikTok: 17 przypadków. Testy integracji używają atrap; nie potwierdzają realnej publikacji ani prawidłowości uprawnień kont.

## 3. Co jest zrobione

- Działające okno Studio i zaakceptowany przez Kubę wygląd: `main.js`, `app/index.html`, `app/style.css`, `app/fonty/`, `ikona.ico`.
- Pobieranie własnych materiałów i statystyk IG, długość przez ffprobe, cache lokalny: `serwer.js`. W rozmowie potwierdzono rzeczywisty odczyt konta i insights. Widoczny ekran miał 71 rolek i 22 inne posty; to historyczny stan, nie gwarancja aktualności.
- Analiza, filtrowanie, sortowanie, szczegóły rolki, sygnały, notatki: `app/app.js`; obliczenia zgodne z dotychczasowym narzędziem: `app/analiza.js`.
- Ostatnia zmiana w tym czacie: kolumna Udostępnienia obok Zapisów, sortowanie po liczbie. `app/index.html:66`, `app/app.js:242`. Przesunięto ukrywanie kolumny obserwujących na dziewiątą: `app/style.css:178`. Szczegóły rolki już pokazywały udostępnienia i wskaźnik na 1000. Dane są pobierane w `serwer.js:262`. Sprawdzono składnię JS; nie wykonano osobnego testu wizualnego po zmianie. Kuba dostał instrukcję ponownego otwarcia Studio.
- Research: `moduly/research.js`, `app/research.js`, `narzedzia/probki/business_discovery.json`, `narzedzia/test_research.js`. Backend, panel i obliczenia przetestowane offline; pełną pracę z prawdziwym API trzeba zweryfikować.
- Publikacje Instagram/Facebook: `moduly/publikacje.js`, `app/publikacje.js`. Kolejka, harmonogram, upload filmu i okładki, test, zapis stanu, ponawianie częściowego sukcesu i blokowanie niepewnego wyniku. Poprawki po przeglądzie zapisane w DYSKUSJA.md. Nie uznawać tego za potwierdzoną produkcyjną publikację.
- YouTube: `moduly/youtube.js`, `app/youtube.js`, `narzedzia/test_youtube.js`. OAuth, tokeny, metadane kanału, wysyłka strumieniowa i wznowienie; panel ustawień podpięty.
- TikTok: `moduly/tiktok.js`, `app/tiktok.js`, `narzedzia/test_tiktok.js`. OAuth/PKCE, tokeny, wysyłka w częściach i sprawdzanie statusu; testy offline przeszły. Panel nie jest jeszcze podpięty do głównego HTML.
- Lokalne szkice stron regulaminu i prywatności: `narzedzia/strony/`; nie potwierdzono ich publikacji.

## 4. Co jest w trakcie

W chwili sprawdzania nie wykryto procesu codex.exe wykonującego zadanie Studio. Nie jest to dowód, że inny otwarty agent nie zacznie ponownie pisać. Przed zmianami sprawdź procesy i daty modyfikacji. Kolejki nie restartuj automatycznie.

1. Zadanie `narzedzia/zadania/07-wpiecie-youtube-tiktok.md` nie jest ukończone. `moduly/publikacje.js:405` (wyslij) nie integruje YouTube/TikTok. `app/publikacje.js:444` nadal ma statyczną informację o platformach zamiast przełączników i pól. Trzeba rozszerzyć zapis pozycji, obsługę wyników, częściowych błędów oraz testy bez ponownej wysyłki na platformy zakończone sukcesem.
2. `app/index.html:149` ładuje YouTube; brak skryptu i kontenera TikToka. `app/app.js:482` i `:542` uruchamiają YouTube, brak analogicznej obsługi TikToka. Moduł TikToka potrzebuje też bezpiecznego sposobu zapisania klienta OAuth w ustawieniach.
3. YouTube liczba subskrybentów: `moduly/youtube.js:242` pobiera tylko snippet. Zadanie 07 opisuje pobieranie statistics, cache 10 minut i zmianę `app/youtube.js`.
4. Zadanie `narzedzia/zadania/08-konta.md`: brak `moduly/konta.js`, `app/konta.js`, `narzedzia/test_konta.js`. To specyfikacja przyszłego panelu historii kont, a nie wykonana funkcja.

Numery linii odnoszą się do stanu przy przekazaniu; wyszukuj też podane nazwy funkcji i teksty.

## 5. Backlog według priorytetu

1. Obejrzeć tabelę z nową kolumną Udostępnienia przy typowej szerokości okna, sprawdzić sortowanie i ukrywanie obserwujących.
2. Dokończyć zadanie 07, podpiąć panel TikToka i zapis jego klienta; rozszerzyć testy kolejki o cztery platformy i izolację błędów.
3. Zweryfikować aktualną dokumentację OAuth i API platform, wymagane przekierowania, zakresy, audyty oraz uprawnienia własnego konta. Nie opierać się na historycznych zapewnieniach czatu.
4. Sprawdzić połączenia na prawdziwych kontach. Publikację testową uzgodnić co do materiału, odbiorców i platform; sam handoff nie jest zleceniem publikacji.
5. Dodać subskrybentów YouTube i zrealizować zadanie 08 po sprawdzeniu aktualnej zgody na jego wygląd.
6. Dokończyć przegląd bezpieczeństwa lokalnego serwera, otwieranych URL, tokenów i uploadów. Sprawdzić scenariusz restartu podczas wysyłki.
7. Przygotować docelowe działanie harmonogramu przy wyłączonym komputerze, jeśli Kuba tego potrzebuje. Obecnie aplikacja musi działać.
8. Później automatyzacja wiadomości, z osobną specyfikacją; nie ma jeszcze własnego odpowiednika ManyChat.

## 6. Decyzje projektowe

- Jeden panel z zakładkami, wspólne dane i połączenia. Kuba chce aplikacji z ikoną, nie ręcznie uruchamianego skryptu ani arkusza.
- Electron jak w istniejących Skryptach, bez nowych zależności poza nim. Nie zmieniaj stosu bez potrzeby.
- Paleta zaakceptowana: grafit #0E0E12, panele #141419/#1B1B22, kość słoniowa #EFE9DA, mosiądz #C9A455. Poppins lokalnie; złoto jako akcent i obrys. Minimalizm, bez długich myślników w UI. Zmiany wyglądu najpierw pokaż Kubie.
- Wskaźniki są sygnałami do interpretacji, nie wyrokiem, że rolka jest dobra lub zła. Zachować kalibrację silnika.
- Krzywej odpływu sekunda po sekundzie nie wyprowadzać ze średniego czasu oglądania. Obecny kod jej nie pobiera; nie tworzyć fikcyjnego wykresu. W AGENTS.md zapisano, że użytkownik nie chce workflow opartego na zrzutach z telefonu.
- Wszystko 100% online, bez powrotu do kampanii stacjonarnych Włocławka.
- Claude i Codex dzielą moduły, przeglądy i ustalenia zapisują w DYSKUSJA.md. Ostatnią zmianę wspólnych plików wykonał Codex na bezpośrednią prośbę Kuby i odnotował ją tam.

## 7. Znane problemy i ograniczenia

- Testy offline nie potwierdzają działania zewnętrznych platform. Nie ogłaszać pełnej gotowości aplikacji.
- Harmonogram zależy od uruchomionego procesu. Nie ma usługi działającej na serwerze przez całą dobę.
- Po restarcie niepewny wynik publikacji jest blokowany, żeby uniknąć duplikatu. Brak pełnego automatycznego uzgadniania stanu z Meta.
- Osierocone zdalne zdjęcia okładek mogą wymagać sprzątania. Lokalna kolejka zapisuje błąd usunięcia, ale nie rozwiązuje wszystkich awarii między żądaniem a zapisem ID.
- Siatka publikacji ma zakres 06:00-23:00, więc nocne terminy wymagają poprawy prezentacji; opis i lista pokazują właściwą godzinę.
- Serwer w części metryk zamienia brak wyniku na zero, m.in. shares (`serwer.js:262`). Przy diagnostyce odróżnić brak danych od prawdziwego zera.
- YouTube/TikTok: ograniczenia audytu i prywatności wymagają weryfikacji w bieżącej dokumentacji. Nie gwarantować użytkownikowi, że da się później zmienić prywatność każdej publikacji.
- Stare portfolio Meta ma problem dostępu; utworzono nowe. Nie usuwać starego i nie przepinać zasobów w ramach tego przekazania. Historyczne wnioski o własności i możliwości przeniesienia nie zostały w pełni potwierdzone.
- `narzedzia/codex_kolejka.sh` ma zaszytą lokalną ścieżkę binarki. Istnieje wynik o dosłownej nazwie `narzedzia/zadania${nr}-wynik-codex.txt`, co wskazuje problem interpolacji w jednym uruchomieniu. Sprawdzać pliki i wyniki testów, nie tylko oczekiwaną nazwę raportu.
- Nie ma lockfile, powtarzalnej instalacji ani pakietu instalatora dla innego komputera. Test Analizy zależy od zewnętrznych lokalnych plików.

## 8. Konfiguracja i sekrety

Nie zamieszczono wartości sekretów. Brak wymaganego mechanizmu .env; aplikacja czyta pliki w `config/`.

| Nazwa pliku / klucza | Gdzie ustawić |
| --- | --- |
| meta_user_token.txt | config/, panel Ustawienia |
| meta_app_secret.txt | config/, panel Ustawienia |
| meta_page_token.json: token | config/, tworzony przez moduł Publikacje |
| ustawienia.json: ig_id, strona_id, username, token_wazny_do | config/, zapis konfiguracji i połączenia Meta |
| youtube_klient.json: client_id, client_secret | config/, formularz YouTube w Ustawieniach |
| youtube_token.json: access_token, refresh_token | config/, generowane przez OAuth |
| tiktok_klient.json: client_key, client_secret | config/, brak pełnego formularza w głównym panelu |
| tiktok_token.json: access_token, refresh_token | config/, generowane przez OAuth |
| APP_ID | stała w serwer.js |
| PATH | środowisko Windows; musi umożliwiać wywołanie ffmpeg i ffprobe |

Ścieżki callbacków: `/api/youtube/callback`, `/api/tiktok/callback` na lokalnym serwerze. Zweryfikuj zgodność przekierowania i wybranego portu z konfiguracją dostawcy. Zachowaj istniejące config/ i dane/ na komputerze, nie kasuj ich przy instalacji i nie commituj. Nie proś o wklejanie tokenów do czatu. Historyczna instrukcja obchodzenia blokady odczytu tokena nie jest właściwą procedurą; używaj normalnej konfiguracji i respektuj ograniczenia narzędzi.

## 9. Stan Gita

Na początku przekazania katalog Studio nie był repozytorium Git. Nie było brancha, commitów ani remote. W ramach prośby użytkownika przygotowywane jest nowe lokalne repozytorium na branchu `main`, z pierwszym commitem `Handoff: stan projektu do przekazania`.

Do commita trafia kod, zasoby interfejsu, testy, zadania i ten dokument. Wyłączone: config/, dane/, node_modules/ oraz surowe logi agentów (mogą zawierać dane prywatne). Użytkownik wskazał remote https://github.com/kczerwinskii/studio. Przed wysłaniem git ls-remote nie zwrócił istniejących referencji. Repozytorium origin ustawiono na ten adres. Commit wykonuje agent z podpisem Codex <codex@local>, ponieważ na komputerze brak skonfigurowanej tożsamości Git.

Po otrzymaniu uzgodnionego URL:

```powershell
git remote add origin https://github.com/kczerwinskii/studio
git push -u origin main
```

Stan końcowy sprawdź `git status --short --branch`, `git log -1 --oneline` i `git remote -v`. Po pomyślnym push branch main ma śledzić origin/main; wynik operacji przekazuje końcowa odpowiedź agenta. W razie błędu push commit pozostaje lokalny.
