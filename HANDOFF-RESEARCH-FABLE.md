# Przekazanie Research w Studio do Fable

Data sporządzenia: **25.09.2026**. Odczyt stanu danych: **15:07:23 czasu Europe/Warsaw, czyli 13:07:23 UTC**. Raport przygotowany przez Codexa na polecenie Kuby.

Repozytorium lokalne: **C:/Users/pc/Desktop/studio**. Użytkownik: **Kuba Czerwiński**, Instagram **kubaczerwinskii**, trener od kształtowania sylwetki, prowadzenie w 100% online.

Ten dokument dotyczy **Research cudzych rolek na Instagramie**. Fable przejmuje ten moduł. Kuba i Codex przechodzą do pisania skryptów. Dokument jest samowystarczalnym opisem dotychczasowej pracy, stanu wdrożenia, ograniczeń i dalszego zadania. Nie jest deklaracją zakończenia budowy Research.

## 1. Najważniejsze informacje na początek

1. **Kod jest lokalnie znacznie nowszy niż GitHub.** Branch main, HEAD 79155ebccebea70c815bb59e7450ffbfcac071a4. Nowe pliki Research są w dużej części nieśledzone przez Git. Samo sklonowanie zdalnego repozytorium nie odtworzy tego stanu.
2. **Oficjalne API zaczęło działać.** W panelu istniejącej aplikacji Meta dodano Instagram Public Content Access. Status: Ready for testing. Ten sam token zaczął obsługiwać hashtagi i Business Discovery. Nie złożono pełnego App Review.
3. **Największy aktualny problem to wydajność wyszukiwania i limit API**, a nie brak formularza profilu lub błędnie wpisana fraza. Rzeczywiście występuje Meta code 4.
4. **30 jest wymaganiem Kuby i celem w interfejsie, ale nie osiągniętym wynikiem rzeczywistej próby.** Są wybory 30/60/100, stronicowanie, cache i ponawianie. Testy syntetyczne 30/60 przechodzą. Nie uzyskaliśmy jeszcze potwierdzonej, powtarzalnej puli 30 rzeczywistych trafień.
5. **Nie mylić wczorajszej próby PL+EN z dzisiejszą PL.** Wczoraj po kontroli języka było 12 trafień z 495 kandydatów. Dzisiejszy zapis wskazuje język polski, dwie frazy i 1 trafienie z 839 kandydatów.
6. **Brak danych nie oznacza zera ani spełnionego filtra.** Nie obniżać rygoru po cichu, żeby pokazać 30 kart.
7. **Szczegółowa analiza jest częściowa:** lokalne reguły analizują opis i dostępne statystyki. Nie analizujemy jeszcze filmu, montażu ani dźwięku.
8. **Udostępnienia cudzych rolek pozostają niedostępne w zbadanej integracji.** Pole istnieje w kartach, lecz pokazuje brak danych. To odrębny przypadek od udostępnień własnych rolek w zakładce Analiza.
9. **GET /api/research/odkrywanie nie jest obecnie czysto odczytowy:** może wznowić zaplanowane wyszukiwanie i zużyć limit Meta. Do samego audytu najpierw czytać lokalny JSON.
10. W tym zadaniu przekazania **nie zmieniono kodu, ustawień wyszukiwania ani dostępu Meta**, nie uruchomiono nowej próby sieciowej. Wykonano odczyt stanu i testy offline. Istniejąca aplikacja może nadal realizować wcześniej zaplanowaną kolejkę.

## 2. Po co powstaje narzędzie

Kuba chce wpisać temat, np. „hipertrofia”, „budowanie sylwetki” albo „fitness”, i otrzymać aktualne, warte obejrzenia rolki z jego niszy. Nie zna z góry wszystkich wartościowych twórców. Aplikacja ma samodzielnie odkrywać nowe konta, również niewielkie, których pojedyncza rolka osiągnęła wyraźnie lepszy wynik niż ich zwykłe materiały.

Wzorem funkcjonalnym był pokaz narzędzia do szukania inspiracji w filmie AiCAT:
[film wskazany przez Kubę](https://www.tiktok.com/@aicat_pl/video/7686551605621181729).

Kuba nie chce instrukcji uruchamiania skryptów ani ręcznego zbierania statystyk. Chce aplikację na pulpicie z panelem Research, miniaturami, filtrami, zapisanymi inspiracjami i analizą przydatności pomysłu.

Studio ma trzy główne obszary: Analiza własnych materiałów, Research i Publikacje. **Research i Analiza dotyczą Instagrama.** YouTube, Facebook i TikTok są osobnymi integracjami publikacji, nie należy rozszerzać na nie tego zadania bez nowego ustalenia.

## 3. Wymagania użytkownika i ich rzeczywisty status

| Wymaganie | Stan na przekazanie |
| --- | --- |
| Wyszukiwanie po temacie bez wpisywania 10-20 kont | Wdrożone przez hashtagi i odkrywanie autorów; ograniczona skuteczność |
| Nieznani twórcy | Odkrywani ze źródła; ręczna lista kont jest tylko opcjonalnym starym widokiem |
| Bezpłatnie | Bez płatnego dostawcy, bez Apify, bez płatnego modelu w module |
| Co najmniej 30 trafień, możliwość większej liczby | Cel 30/60/100 w kodzie; rzeczywiste dojście do 30 pozostaje niedokończone |
| Polski, angielski, oba języki | Dostępne; język szacowany z opisu, nie z mowy |
| Trendy z USA i innych rynków anglojęzycznych | Angielski obejmuje wszystkie kraje; nie ma potwierdzonego filtra geograficznego USA |
| Publikacje z ostatnich 7/30 dni | Dostępne; dodatkowo „Bez ograniczenia” |
| Wynik 3×/4×/5× typowego wyniku autora | Liczony z wyświetleń i mediany wcześniejszych rolek; dodatkowo „Wszystkie” |
| Profil Kuby pomaga w dopasowaniu | Profil zapisywany i używany w częściowym raporcie; nie ogranicza puli wyszukiwania |
| Automatyczne rozszerzanie PL/EN | Lokalny słownik tematów, nie uniwersalne tłumaczenie dowolnego zapytania |
| Miniatury i kliknięcie w rolkę | Karty i widok szczegółów działają; dostępność miniatur zależy od źródła |
| Odtwarzanie w aplikacji | Interfejs istnieje dla dostępnego adresu filmu; obecny adapter Meta zwraca pusty adres filmu |
| Otwieranie oryginału | Link do rolki na Instagramie dostępny |
| Liczba komentarzy i udostępnień | Komentarze dostępne dla części źródeł; cudze udostępnienia nadal brak danych |
| Szczegółowa analiza treści filmu | Niezrealizowana; obecnie analiza opisu/statystyk |
| Zapisane inspiracje i notatki | Działają lokalnie |
| Kontynuacja po limitach | Wdrożona i przetestowana na działającym Studio; stały odstęp 15 minut, ograniczenia opisane niżej |

### Ustalona interpretacja „virala”

Nie wystarcza duża bezwzględna liczba wyświetleń, bo twórca może mieć miliony obserwujących. Chodzi o **odstępstwo od jego własnych wcześniejszych wyników**.

Przykład: typowy wynik autora wynosi 10 tys. wyświetleń. Przy filtrze 5× interesują nas jego materiały z co najmniej 50 tys. wyświetleń.

Implementacja używa mediany, choć Kuba w rozmowie posługiwał się także potocznym określeniem „średnia”. Mediana ma ograniczać wpływ wcześniejszych pojedynczych hitów. Nie zamieniać tego na stosunek do liczby obserwujących lub na porównanie polubień.

### Ustalony sposób pracy

- Po polsku, konkretnie, z małą liczbą kroków po stronie Kuby.
- Wykonywać autoryzowaną pracę techniczną samodzielnie.
- Gdy potrzebny jest właściciel, wskazać jeden konkretny krok.
- Nie odpalać dodatkowych agentów ani płatnych usług bez wyraźnej prośby.
- Nie prosić o hasła, 2FA ani tokeny w rozmowie.
- Nową zmianę wyglądu najpierw pokazać jako podgląd; obecna paleta i układ kart są już zaakceptowane.
- Nie przywracać wymogu listy znanych twórców jako podstawowego sposobu działania.
- Wymaganie „darmowo” jest późniejsze i nadrzędne wobec wcześniejszej zgody na przygotowanie integracji Apify.

## 4. Co kolejno zrobiliśmy i czego się nauczyliśmy

### 4.1. Punkt wyjścia

Stary Research działał dla podanych kont przez Business Discovery. To nie spełniało oczekiwania odkrywania nieznanych autorów po temacie.

Zaprojektowano i po akceptacji Kuby wdrożono panel: profil, temat, filtry, karty, miniatury, zapisane, notatki, przycisk szczegółowej analizy, opcjonalni Obserwowani twórcy.

### 4.2. Pierwsze próby publicznych stron

Publiczna strona /popular/hipertrofia/ potrafiła oddać kilkanaście rolek i przybliżone wyświetlenia bez logowania. To była rzeczywista obserwacja, ale zbyt wcześnie potraktowaliśmy tę drogę jako wystarczające źródło docelowego produktu.

Problemy:
- /popular/fitness/ zwracała HTTP 200 z treścią strony niedostępnej.
- Wiele wyników było starych.
- „Hipertrofia” przyciąga też opisy portugalskie i hiszpańskie.
- Początkowo brakowało dat i wiarygodnej historii autora.
- Publiczne strony tematyczne nie tworzą kompletnego, stabilnego indeksu słów.

Użytkownik widział „27 z niepełnymi danymi” albo zero wyników. Zdiagnozowano, że samo przesunięcie filtrów lub usunięcie profilu nie rozwiąże braku danych.

### 4.3. Uzupełnianie dat i historii

Dodano odwiedzanie dokładnego permalinku rolki, odczyt autora, daty, polubień i komentarzy. Parser dat akceptuje czas związany z linkiem do konkretnego materiału, a nie datę komentarza. Oddzielono historię profilu od wybranych hitów ze strony tematycznej.

W audycie 27 kandydatów odzyskano 27 dat i reakcje 26 rolek. Jedna rolka miała około 7,04× mediany 9 wcześniejszych materiałów, ale skala i świeżość puli pozostawały niewystarczające.

Poprawiono również:
- rozpoznawanie strony niedostępnej mimo HTTP 200;
- odróżnianie pierwszego uruchomienia, pustego wyniku, błędu źródła i trwającej pracy;
- przejście do nowego tematu Enterem;
- zapisywanie ostatniego tematu i błędów;
- zachowanie ręcznie poprawionych fraz;
- rozszerzenia słów „fitness” i „budowanie sylwetki”;
- jawne podawanie przyczyn odrzucenia.

### 4.4. Oficjalne API i rozwiązanie code 10

Pierwsze ig_hashtag_search zwracało code 10 i komunikat o Instagram Public Content Access. Wcześniejsze notatki na tej podstawie mówiły o konieczności pełnego przeglądu aplikacji.

Po zalogowaniu się Kuby sprawdziliśmy rzeczywisty panel. Funkcja **nie była dodana**. Dodano ją do istniejącej aplikacji i uzyskano **Ready for testing**.

Następnie ten sam zapisany token skutecznie wykonał:
- ig_hashtag_search;
- recent_media oraz top_media dla hashtagu;
- Business Discovery dla dostępnych profili;
- odczyt view_count w historii tych profili.

**Nie wysłaliśmy pełnego App Review, nie opublikowaliśmy aplikacji i nie obracaliśmy tokenów.** Nie wracać do starej diagnozy „nic nie zadziała bez pełnego App Review” jako do aktualnego faktu.

Ten sukces potwierdza tylko działanie w sprawdzonym układzie konta właściciela i aplikacji. Nie dowodzi zgody dla dowolnych użytkowników.

### 4.5. Dlaczego były tylko trzy wyniki

Pierwsza próba Meta analizowała niewielką pulę:
- wstępnie około 20 kandydatów z hashtagów;
- ograniczony odczyt autorów;
- pierwsze 20 publikacji historii;
- dodatkowe pasujące rolki znalezione w tych historiach.

Dała 3 potwierdzone odstępstwa w puli 96 kandydatów przy PL+EN, 30 dniach i minimum 3×. Kuba wyraźnie odrzucił tę skalę jako niewystarczającą.

### 4.6. Powiększanie puli

Dodano:
- osobny cel 30/60/100;
- kolejne strony hashtagów;
- zapamiętywanie kursorów;
- rozwijanie kolejnych autorów;
- do 5 stron historii po 20 publikacji;
- wyniki tematyczne z historii;
- zatrzymanie i kontynuację;
- zachowanie częściowych wyników przy błędzie;
- ponowienie po limicie Meta.

Wykryto konkretny błąd stronicowania: zagnieżdżone Business Discovery zwracało **paging.cursors.after bez paging.next**. Oczekiwanie next zatrzymywało historię po pierwszych 20 publikacjach. Rzeczywista próba drugiej strony zwróciła następne 20 publikacji bez nakładających się ID. Parser został poprawiony.

Próba osiągnęła 495 kandydatów i pierwotnie 13 trafień. Kontrola UI ujawniła opis w hindi z angielskimi terminami i hashtagami. Po poprawieniu detekcji języka zostało **12**.

### 4.7. Limit Meta i automatyczne ponawianie

Dalsze pobieranie zatrzymało się na rzeczywistym **code 4**. Wdrożono odstęp 15 minut, zapis terminu i maksymalnie 3 automatyczne ponowienia.

Kuba zrestartował Studio. Sprawdzono działający lokalny serwer i panel: 12 kart, wybór 30/60/100, oczekiwanie. O 22:37 czasu polskiego 24.09.2026 automatyczne wznowienie faktycznie ruszyło, ale limit nadal występował. Zaplanowano kolejną próbę.

To potwierdzenie mechanizmu wznowienia, **nie sukces zebrania 30 rolek**.

### 4.8. Co wiemy o filmie referencyjnym

Przeczytano lokalne polskie napisy filmu AiCAT, obejmujące około 00:00-04:40. Pokazywały profil, tematy, platformy, język/pochodzenie inspiracji, okresy, zapisywanie i adaptację.

Próba pełnego obejrzenia w przeglądarce zatrzymała się na CAPTCHA. Nie należy twierdzić, że obejrzano cały pokaz wizualnie. Film nie ujawnia backendu ani dostawcy danych. Nie ma podstaw, żeby przypisywać mu konkretny scraper lub kopiować domniemany sposób pobierania.

## 5. Aktualny zapis danych, 25.09.2026 o 15:07

Stan przeczytano bezpośrednio z:
[C:/Users/pc/Desktop/studio/dane/research_odkrywanie.json](C:/Users/pc/Desktop/studio/dane/research_odkrywanie.json).

Nie odpytywano lokalnego GET API, aby przy sporządzaniu raportu nie wywołać dodatkowego wznowienia. Plik został zmodyfikowany przez istniejącą aplikację o 15:07:22 czasu polskiego. To fotografia stanu, który może zmienić się po sporządzeniu raportu.

| Pole | Wartość |
| --- | --- |
| Temat | hipertrofia |
| Frazy | hipertrofia; budowanie mięśni |
| Język | pl |
| Okres | 30 dni |
| Mnożnik | minimum 3× |
| Cel | 30 |
| Stan | czesciowy |
| Powód zakończenia bieżącej partii | limit |
| Potwierdzone | 1 |
| Kandydaci bieżącego wyszukiwania | 839 |
| Bez potwierdzenia wymaganych filtrów | 122 |
| Odrzucone za język | 214 |
| Odrzucone za okres | 0 |
| Odrzucone za mnożnik | 502 |
| Autorzy w zapisanym podsumowaniu partii | 55 |
| Strony hashtagów w tej partii | 17 |
| Wpisy wszystkich postów w lokalnym magazynie | 1122 |
| Zapisane historie profili | 94 |
| Zapisane inspiracje / notatki | 0 / 0 |
| Numer automatycznej próby | 1 |
| Zapisany następny termin | 25.09.2026, 15:22:21 czasu polskiego |
| Ostatni błąd blokujący | META_LIMIT, zaobserwowany wcześniej oryginalny code 4 |

Liczby odrzuceń są rozłączne według kolejności sprawdzania w silniku: pierwszy znany powód odrzucenia kończy sprawdzanie danej rolki. Nie są pełną listą wszystkich przyczyn dotyczących każdego materiału.

Jedyny potwierdzony wynik:
- autor: @maliicki;
- rolka: [DdgEmf0jlFd](https://www.instagram.com/reel/DdgEmf0jlFd/);
- publikacja: 20.09.2026, 07:41:26 UTC;
- wyświetlenia w odczycie: 4978;
- mediana 20 wcześniejszych rolek: 1150,5;
- mnożnik: około 4,327×.

Pozostałe błędy w ostatniej partii obejmują niedostępne historie niektórych profili. Zapisane błędy mają sanitowane kategorie; oryginalny numer błędu nie zawsze jest przechowywany.

**Nie interpretować 1 versus 12 jako bezpośredniego porównania jakości tego samego wyszukiwania.** Zmieniono zestaw fraz i język. Dzisiejsze ustawienie to tylko PL. Wynik nadal pokazuje, że wymaganie skali nie jest spełnione.

## 6. Stack, uruchomienie i środowisko

- Windows, PowerShell.
- JavaScript, CommonJS w backendzie.
- Electron 44.4.1, potwierdzony lokalnie.
- Node.js v24.19.0, potwierdzony lokalnie.
- Serwer HTTP i HTTPS na modułach wbudowanych Node.
- Frontend: zwykły HTML/CSS/JavaScript, bez Reacta i bez bundlera.
- Brak bazy SQL. Dane w lokalnych JSON.
- Jedyna zależność aplikacji npm: Electron.
- Testy UI używają Playwrighta z już dostępnego runtime Codexa, nie z zależności projektu.
- Adres standardowego serwera: http://127.0.0.1:8767.

### Uruchomienie pełnej aplikacji

W PowerShell:

~~~powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\studio'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm start
~~~

ELECTRON_RUN_AS_NODE trzeba usunąć tylko ze środowiska procesu uruchamiającego, jeśli jest ustawiona. Nie nadpisywać systemowych katalogów ani globalnych zmiennych.

Zależności na tym komputerze są gotowe. **Nie uruchamiać npm install i nie dodawać paczek** wbrew zasadzie repozytorium. Na nowym komputerze najpierw wyjaśnić sposób dostarczenia Electrona i konfiguracji; nie zakładać, że sam clone zawiera node_modules lub config.

### Sam serwer do pracy nad panelem

~~~powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\studio'
node serwer.js 8767
~~~

Tylko gdy port jest wolny. Nie uruchamiać drugiego procesu nad tymi samymi danymi.

**Czysty Node nie wystarcza do całego odkrywania**, ponieważ publiczny odczyt autora wymaga BrowserWindow Electrona. Nie diagnozować tego jako awarii API.

Zmiany modułów backendu wymagają restartu już otwartego Studio. Odświeżenie HTML nie przeładowuje modułów CommonJS. Kuba wykonał wymagany restart 24.09; następny jest potrzebny dopiero po kolejnych zmianach kodu.

## 7. Mapa kodu

Numery linii sprawdzono 25.09.2026. Mogą przesunąć się po dalszych edycjach.

| Plik i punkt wejścia | Odpowiedzialność |
| --- | --- |
| [main.js](C:/Users/pc/Desktop/studio/main.js) | Okno, pojedyncza instancja, start serwera, otwieranie linków zewnętrznych |
| [serwer.js:64](C:/Users/pc/Desktop/studio/serwer.js:64) | Wspólny transport Meta |
| [serwer.js:424](C:/Users/pc/Desktop/studio/serwer.js:424) | Zestaw narzędzi wstrzykiwany modułom |
| [moduly/research.js:117](C:/Users/pc/Desktop/studio/moduly/research.js:117) | Przekazanie nowych tras do obsluzOdkrywanie; dalej stary Research kont |
| [moduly/research-odkrywanie.js:10](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:10) | Odczyt danych, migracja wersji rozpoznawania języka |
| [moduly/research-odkrywanie.js:21](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:21) | Scalanie szczegółów z ochroną dokładnych danych Meta |
| [moduly/research-odkrywanie.js:85](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:85) | Normalizacja postów |
| [moduly/research-odkrywanie.js:95](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:95) | Lokalna, częściowa analiza opisu |
| [moduly/research-odkrywanie.js:106](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:106) | Wybór źródła i uruchomienie poszukiwania |
| [moduly/research-odkrywanie.js:162](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:162) | Trasy HTTP, ponowienia, zatrzymanie |
| [moduly/research-pula.js:11](C:/Users/pc/Desktop/studio/moduly/research-pula.js:11) | Główna aktualna pętla Meta z celem liczbowym |
| [moduly/research-pula.js:18](C:/Users/pc/Desktop/studio/moduly/research-pula.js:18) | Włączanie pasujących rolek z historii |
| [moduly/research-pula.js:28](C:/Users/pc/Desktop/studio/moduly/research-pula.js:28) | Pobieranie/cache historii autora |
| [moduly/research-meta.js:11](C:/Users/pc/Desktop/studio/moduly/research-meta.js:11) | Sanitowanie i kategoryzacja błędów Meta |
| [moduly/research-meta.js:50](C:/Users/pc/Desktop/studio/moduly/research-meta.js:50) | Jedna strona hashtagów i trwałe kursory |
| [moduly/research-meta.js:64](C:/Users/pc/Desktop/studio/moduly/research-meta.js:64) | Stronicowana historia Business Discovery |
| [moduly/research-publiczne.js:35](C:/Users/pc/Desktop/studio/moduly/research-publiczne.js:35) | DOM dokładnej rolki: autor, data, miniatura, liczniki |
| [moduly/research-publiczne.js:55](C:/Users/pc/Desktop/studio/moduly/research-publiczne.js:55) | Ukryte, izolowane okno odczytu; blokowanie filmów |
| [app/research-silnik.js:15](C:/Users/pc/Desktop/studio/app/research-silnik.js:15) | Rozszerzanie tematów |
| [app/research-silnik.js:21](C:/Users/pc/Desktop/studio/app/research-silnik.js:21) | Heurystyka języka |
| [app/research-silnik.js:35](C:/Users/pc/Desktop/studio/app/research-silnik.js:35) | Mediana i mnożnik |
| [app/research-silnik.js:43](C:/Users/pc/Desktop/studio/app/research-silnik.js:43) | Ścisłe filtrowanie i powody odrzucenia |
| [app/research.js:13](C:/Users/pc/Desktop/studio/app/research.js:13) | Formularz, profil, filtry, cel |
| [app/research.js:40](C:/Users/pc/Desktop/studio/app/research.js:40) | Karty i paginacja |
| [app/research.js:56](C:/Users/pc/Desktop/studio/app/research.js:56) | Szczegóły, podgląd, notatki |
| [app/research.js:66](C:/Users/pc/Desktop/studio/app/research.js:66) | Komunikaty postępu |
| [app/research.js:75](C:/Users/pc/Desktop/studio/app/research.js:75) | Odświeżanie i polling |
| [app/research.css](C:/Users/pc/Desktop/studio/app/research.css) | Zatwierdzony wygląd kart i responsywność |
| [app/research-konta.js](C:/Users/pc/Desktop/studio/app/research-konta.js) | Opcjonalny starszy panel znanych kont |

**Uwaga na kod historyczny:** w research-odkrywanie.js nadal jest uzupelnij z dawną gałęzią Meta i limitem 32 kandydatów. Aktualne szukaj dla Meta wcześniej przekazuje sterowanie do szukajPuli i wraca. Nie naprawiać skali tylko przez zmianę tego starego slice(0,32), bo nie jest to obecna główna ścieżka. Podobnie pobierzTemat w research-meta.js jest starszym adapterem, podczas gdy nowa pętla korzysta z pobierzStrone.

## 8. Aktualny przepływ wyszukiwania

1. Panel pobiera temat, język, okres, próg i cel.
2. Lokalny słownik rozszerza znany temat. Dla hipertrofii przy PL+EN: hipertrofia, budowanie mięśni, hypertrophy, muscle growth. Frazy są widoczne i edytowalne.
3. POST /szukaj zapisuje nową konfigurację, czyści identyfikatory poprzedniego aktywnego wyniku, zachowuje magazyn/cache/notatki/zapisane.
4. Jeśli istnieje token, ig_id i transport Meta, używana jest ścieżka Meta. Brak konfiguracji pozwala wejść w starsze publiczne źródło. Błąd uprawnień Meta nie jest po cichu maskowany przejściem na publiczne strony.
5. Pętla przywraca pasujące świeże cache fraz i historii.
6. Frazy stają się hashtagami: np. budowanie mięśni zmienia się na budowaniemiesni. To wyszukiwanie hashtagowe, nie pełnotekstowe ani semantyczne przeszukanie całego Instagrama.
7. Pobierane są małe strony recent_media i top_media. Odpowiedzi mogą zawierać zdjęcia i karuzele. Adapter akceptuje jedynie bezpieczny permalink rolki.
8. Jeśli brakuje nazwy autora, izolowane okno odwiedza dokładny publiczny permalink. Nie korzystamy z prywatnej sesji zalogowanego Instagrama.
9. Dla dostępnego profilu Meta pobierana jest chronologiczna historia. Na jej podstawie uzupełniane są wyświetlenia oraz mediana.
10. Dodatkowymi kandydatami stają się wcześniejsze rolki autora, które pasują tekstowo do aktualnych fraz i okresu.
11. Ścisły silnik sprawdza język, datę i mnożnik. Wyniki niekompletne nie zwiększają licznika celu.
12. Pętla idzie dalej, aż osiągnie cel lub napotka konkretny powód zatrzymania.
13. Panel odświeża stan co 1,5 s podczas pracy, a co 15 s podczas oczekiwania na ponowienie.

Profil Kuby nie jest warunkiem przejścia w tym przepływie. Usunięcie profilu nie odblokuje API ani nie naprawi danych.

### Dokładna definicja mediany

Z historii wybierane są:
- wyłącznie rolki z tego samego profilu;
- unikalne ID;
- wpisy z oznaczeniem źródła historii „profil”;
- materiały opublikowane **ściśle wcześniej** niż badana rolka;
- liczniki wyświetleń będące liczbami nieujemnymi;
- ta sama metryka i źródło licznika co kandydat.

Następnie wybierane jest maksymalnie 20 najbliższych wcześniejszych rolek. Minimum to 5. Badana rolka nie należy do własnej bazy. Przy mniejszej próbce albo medianie 0 nie powstaje potwierdzony mnożnik.

Dla ścieżki Meta metryka ma nazwę meta_view_count. Nie wolno zestawiać dokładnych view_count z przybliżonymi licznikami publicznego DOM w jednej medianie.

### Co oznacza „potwierdzone”

W tym projekcie jest to potwierdzenie **dostępnych liczników i spełnienia filtrów zgodnie z algorytmem**. Detekcja języka pozostaje heurystyką. Nie jest to ręczne obejrzenie każdej rolki, ocena prawdziwości porad ani dowód przyczyn popularności.

Jeden odczyt nie dowodzi narastającego trendu. Do tempa wzrostu potrzebne byłyby co najmniej dwa pomiary w czasie; takiego mechanizmu obecnie nie ma.

## 9. Integracja Meta: co wiemy, a czego nie

Identyfikatory poniżej są publicznymi identyfikatorami konfiguracji, nie sekretami:

| Obiekt | Identyfikator |
| --- | --- |
| Aplikacja Kuba Czerwinski Studio | 1823206525790813 |
| Portfolio Kuba Czerwiński Online | 1495853945685937 |
| Konto Instagram właściciela | 17841402043539936 |
| Strona Facebook używana w integracji | 1195244580344085 |
| Wersja Graph API w kodzie | v25.0 |

### Sprawdzone pola i zapytania

- /ig_hashtag_search: parametry user_id, q.
- /HASHTAG_ID/recent_media i /HASHTAG_ID/top_media: id, caption, media_type, permalink, timestamp, like_count, comments_count.
- Business Discovery: username oraz media z id, caption, media_product_type, media_type, timestamp, like_count, comments_count, permalink, thumbnail_url, view_count.
- Kolejne strony historii: field expansion z media.limit(20).after(KURSOR).
- Kursory są zapisywane jako kursory. Nie zapisujemy i nie wykonujemy zwróconych paging.next jako gotowych URL zawierających token.
- W odpowiedzi hashtagowej nie udało się użyć username ani view_count.
- Bezpośredni odczyt dowolnego obcego ID mediów nie zastępuje Business Discovery.
- Niektóre profile zwracały code 110 i nie dawały historii.
- Większe strony top_media po 50 w próbach powodowały timeouty. Nie zakładać, że podniesienie limitu strony rozwiąże skalę. Dla historii również potrzebny byłby osobny pomiar.

### Ograniczenia wymagające dalszego pomiaru

Nie mamy wiarygodnego pomiaru budżetu zapytań z nagłówków, czasu jego odnowienia ani rozdzielenia limitów aplikacji/konta/poszczególnych operacji. Nie wpisywać w UI zmyślonej wartości „X zapytań na godzinę”.

W toku badania pojawiała się dokumentacyjna liczba 30 unikalnych hashtagów w 7 dni. Nie traktować jej jako świeżo potwierdzonego limitu każdej operacji. Sprawdzić aktualne reguły w oficjalnym źródle Meta i rzeczywiste recently_searched_hashtags, zanim dojdą dziesiątki nowych tagów. Nie mylić tej liczby z wymaganymi 30 rolkami.

Dodanie funkcji do testów nie jest dowodem na pełny App Review ani na kompletność wszystkich cudzych statystyk.

## 10. Kontrakt lokalnego API i danych

Bazowa ścieżka: /api/research/odkrywanie.

| Metoda / końcówka | Cel |
| --- | --- |
| GET, bez końcówki | Dane i przeliczone posty; może wznowić przeterminowaną kolejkę |
| POST /szukaj | Nowe wyszukiwanie lub kontynuacja z cache |
| POST /zatrzymaj | Żądanie przerwania po bieżącym odczycie i skasowanie oczekiwania |
| POST /profil | Zapis kim, odbiorcy, tematy |
| POST /zapisz | ID rolki i zapisana: true/false |
| POST /notatka | ID rolki i tekst |
| POST /analiza | Częściowy raport dla ID |

Przykładowe ciało /szukaj, bez danych uwierzytelniających:

~~~json
{
  "temat": "hipertrofia",
  "frazy": ["hipertrofia", "budowanie mięśni", "hypertrophy", "muscle growth"],
  "cel": 30,
  "filtry": {"jezyk": "both", "okres": 30, "prog": 3}
}
~~~

Walidacja:
- temat niepusty, do 100 znaków;
- od 1 do 6 niepustych fraz, każda do 100 znaków;
- cel 30, 60 lub 100;
- język pl, en, both;
- okres 0, 7, 30;
- próg 0, 3, 4, 5;
- 202 oznacza przyjęcie pracy, nie gotowy wynik;
- 409 oznacza, że trwa już wyszukiwanie.

### Główny plik JSON

[C:/Users/pc/Desktop/studio/dane/research_odkrywanie.json](C:/Users/pc/Desktop/studio/dane/research_odkrywanie.json).

| Pole | Znaczenie |
| --- | --- |
| profil | kim, odbiorcy, tematy |
| posty | Mapa ID/shortcode → znormalizowana rolka |
| historie | Nazwa profilu → posty historii, data pobrania, wersja, okres |
| frazy | Fraza → ID wyników, kursory, koniec, data, źródło i wersja |
| ostatnie | ID kandydatów aktualnego wyszukiwania, nie tylko zaakceptowanych |
| zapisane | ID inspiracji użytkownika |
| notatki | Własne notatki po ID |
| temat | Ostatni temat |
| wyszukiwanie | Parametry, stan, powód, liczniki, błędy, numer próby i termin wznowienia |
| zakres_weryfikacji | Liczniki puli i bieżącej partii |
| zrodlo_api | meta lub publiczne |
| meta_limit_do | Lokalny termin następnej dozwolonej próby |
| wersja_jezyka | Wersja migracji języka, obecnie 2 |

Ważne pola rolki: id, typ, username, opis, tytul, permalink, data, jezyk, jezyk_metoda, miniatura, film, wyswietlenia, polubienia, komentarze, udostepnienia, zrodlo_api, meta_id, metryka_wyswietlen, tryb_odkrycia, pobrano, przyblizone i znaczniki sprawdzenia autora.

Mediana i mnożnik są wyliczane z historii przy odczycie/filtracji. Nie zakładać, że każda rolka w surowym JSON ma gotowy zapisany krotnosc_wyswietlen.

Źródła odkrycia obejmują top_media, recent_media i historia_tematyczna. Autor pusty lub nieznany nie jest automatycznie błędem całej partii.

Starszy panel kont ma oddzielne ścieżki danych:
- C:/Users/pc/Desktop/studio/dane/research.json;
- C:/Users/pc/Desktop/studio/dane/research_notatki.json.

Nie mieszać tych plików z nowym odkrywaniem.

### Cache i ponawianie: rzeczywiste granice

- Świeżość cache: 6 godzin.
- Wersja aktualnego cache stronicowania Meta: wersja_meta = 3.
- Wersja rozwiniętej historii: wersja_puli = 2.
- Wersja parsera autora: wersja_odczytu_autora = 2.
- Użycie historii zależy też od okresu wyszukiwania.
- Nieudana próba profilu może być zapamiętana na 6 godzin.
- Kursory hashtagów są trwałe w JSON.
- **Kursory częściowo pobranej historii profilu nie są trwale wznawiane.** Ponowienie niepełnej historii może zacząć ją ponownie od pierwszej strony.
- Po wygaśnięciu sześciogodzinnego cache nie ma gwarancji kontynuacji źródła dokładnie z dotychczasowego miejsca.
- 200 to limit stron hashtagów w partii.
- 250 w kodzie ogranicza próby odczytu nowych autorów z publicznych stron, **nie wszystkie profile i nie sumę wywołań API**.
- Auto retry obejmuje kody 4, 17, 32, 613, klasyfikowane jako META_LIMIT.
- Odstęp 15 minut jest lokalną decyzją programu; nie pochodzi z potwierdzonego nagłówka resetu.
- Trzy automatyczne ponowienia dotyczą danego wyszukiwania; ręczne nowe wyszukiwanie rozpoczyna nowy licznik.
- Zamknięte Studio nie pracuje. Sam backend bez odpytywania GET także nie ma niezależnego zegara uruchamiającego tę kolejkę.
- Stan przerwanej aktywnej pracy po restarcie nie jest tym samym, co oczekiwanie na limit.

## 11. Znane problemy i konkretne miejsca do kontroli

Poniżej oddzielono potwierdzone ograniczenia od ryzyk wynikających z odczytu kodu. Te drugie trzeba odtworzyć testem przed określeniem ich jako przyczyny wszystkich problemów.

### A. Potwierdzone w działaniu

**A1. Za mało rzeczywistych trafień.** Nadal brak dowodu na 30 wyników dla reprezentatywnej niszy. Dzisiejszy PL: 1/30. Priorytet najwyższy.

**A2. Ograniczenie zapytań Meta.** Code 4 powtarza się również po ponowieniu. Samo oczekiwanie 15 minut nie gwarantuje odzyskania budżetu.

**A3. Źródło nie obejmuje całego Instagrama.** Hashtagi, dostępność danych i kont zawodowych ograniczają pulę. Nie wolno opisywać wyniku jako wyczerpującego przeglądu rynku.

**A4. Ustalanie autora zależy od publicznego DOM.** Potrafi zawieść, wymaga Electrona, jest kosztowne i zależy od zmian stron.

**A5. Rozpoznanie języka jest przybliżone.** Krótkie opisy, mieszane języki i blisko spokrewnione słowa mogą dać null albo błędne dopasowanie. Przykład hindi został poprawiony, ale nie stanowi to pełnej walidacji językowej.

**A6. Udostępnienia i analiza filmu nie są ukończone.** Nie przedstawiać samej obecności pól/przycisku jako gotowej funkcji.

**A7. Wbudowany odtwarzacz nie ma zwykle źródła z obecnego Meta.** Meta.karta ustawia film na pusty ciąg. Otwieranie oryginału jest rzeczywistą dostępną ścieżką.

**A8. Część opisów ma temat wyłącznie w hashtagu.** Dopasowanie tekstowe nie gwarantuje, że treść samego filmu odpowiada tematowi.

### B. Ryzyka i dług techniczny wskazane podczas przekazania

**B1. Za duży koszt historii przed pozyskaniem trafienia.**
[research-pula.js:28](C:/Users/pc/Desktop/studio/moduly/research-pula.js:28) i [research-meta.js:64](C:/Users/pc/Desktop/studio/moduly/research-meta.js:64).
Jednemu autorowi poświęca się do 5 zapytań historii. Autorzy z nieznanym językiem też trafiają do sprawdzania. Przy PL może to zużywać budżet na opisy w innych językach. Potrzebny pomiar kosztu/uzysku i lepsza kolejność, bez fikcyjnego odrzucania nieznanych twórców.

**B2. Budżet partii nie jest budżetem API.**
[research-pula.js:15](C:/Users/pc/Desktop/studio/moduly/research-pula.js:15).
Wstępna pętla znanych autorów i liczba stron ich historii nie są kontrolowane przez licznik 250 odczytów autorów. Dodać prawdziwy licznik żądań, czasu i przyczyn zakończenia.

**B3. Brak telemetrii limitów.**
[research-meta.js:11](C:/Users/pc/Desktop/studio/moduly/research-meta.js:11) oraz wspólny transport.
Sanitowanie zaciera część diagnostyki. Potrzebne są bezpiecznie wybrane kody i nagłówki użycia/odnowienia, bez tokenów, pełnych URL ani wrażliwych błędów. Dokładnych nowych reguł limitów nie zgadywać.

**B4. Częściowa historia nie ma trwałego kursora.**
Przy limicie na stronie 3 zapisują się zebrane dane, ale następna próba nie rozpoczyna się automatycznie od strony 3. To może ponownie zużywać budżet. Jest różnica między dobrym zachowaniem wyników a efektywnym wznowieniem.

**B5. Starsze wartości mogą nadpisywać świeże dane Meta.**
[research-pula.js:90](C:/Users/pc/Desktop/studio/moduly/research-pula.js:90), scalanie w kolejności nowy post, potem stary post. Późniejsza historia często odświeża liczniki, lecz jeśli jest niedostępna, nowe dane z hashtagu mogą zostać przykryte. Odtworzyć testem dla starego cache.

**B6. Limit czasu nie anuluje transportu produkcyjnego.**
[research-meta.js:17](C:/Users/pc/Desktop/studio/moduly/research-meta.js:17) używa Promise.race. Po 25 s oczekiwanie się kończy, ale wspólny transport serwer.js nie dostaje sygnału anulowania. Narzędzie audytu ma osobny timeout HTTPS 20 s, więc test i produkcja różnią się zachowaniem. Nie zakładać pełnego abortu tylko dlatego, że UI otrzymał timeout.

**B7. Raport błędów może mylić problemy profilu i limit hashtagów.**
Komunikat META_API jest ogólny. Obecne dane nie pozwalają automatycznie odróżnić każdej niedostępności konta od innych błędów. Potrzebne trafniejsze kategorie, bez ujawniania sekretów.

**B8. Stan „gotowe” nie oznacza osiągnięcia celu.**
Należy zawsze czytać także powod i potwierdzone. Pusta/wyczerpana pula bez błędów może być stanem ukończonej partii, mimo że ma mniej niż 30.

**B9. Analiza jest zbiorem reguł.**
[research-odkrywanie.js:95](C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js:95) wykrywa np. pytanie, listę i CTA w opisie. Nie identyfikuje rzeczywistego hooka obrazu/audio ani przyczyn wzrostu. Pełna analiza wymaga oddzielnej architektury i realnego źródła materiału.

**B10. Kod historyczny i skrócony zapis utrudniają utrzymanie.**
Niektóre pliki są bardzo skompresowane. Po zabezpieczeniu testami można usunąć nieużywane gałęzie Meta i uporządkować kod. To nie zastępuje naprawy źródła i budżetu zapytań.

**B11. Rosnący JSON i częste pełne zapisy.**
Pula wielokrotnie czyta i zapisuje cały plik. Nowa ścieżka Meta nie ma tego samego sprzątania cache co stara gałąź. Zmierzyć koszty przy większej bazie, zabezpieczyć zachowanie notatek i zapisanych. Nie robić destrukcyjnego czyszczenia danych jako pierwszego kroku.

**B12. Dokumentacja publiczna nie opisuje jeszcze Research zgodnie z danymi.**
[C:/Users/pc/Desktop/studio/narzedzia/strony/studio-polityka.html](C:/Users/pc/Desktop/studio/narzedzia/strony/studio-polityka.html) nadal ma stwierdzenie o niezbieraniu danych innych osób, mimo pobierania publicznych metadanych cudzych rolek. Inny agent równolegle rozwija tam dokumenty YouTube. Przed ewentualnym pełnym App Review uzgodnić i poprawić opis rzeczywistego przetwarzania. W tym przekazaniu nie publikowano ani nie zmieniano tych dokumentów.

## 12. Testy i rzeczywiste dowody

### Potwierdzone ponownie 25.09.2026

Wszystkie poniższe zakończyły się powodzeniem. Testy jednostkowe korzystają z danych kontrolowanych; DOM/panel z przeglądarki testowej i mocków. Nie uruchamiają nowego researchu Meta.

~~~powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\studio'
node narzedzia/test_research.js
node narzedzia/test_research_odkrywanie.js
node narzedzia/test_research_meta.js
node narzedzia/test_research_pula.js

$env:NODE_PATH = 'C:\Users\pc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node narzedzia/test_research_dom.cjs
node narzedzia/test_research_panel.cjs
~~~

| Test | Najważniejszy zakres |
| --- | --- |
| test_research.js | Starszy panel kont i jego obliczenia |
| test_research_odkrywanie.js | Frazy, język, daty, ścisłe filtry, mediana, API lokalne, zapis/cache |
| test_research_meta.js | Paginacja, źródła liczników, dokładne zera, cache, błędy bez sekretów |
| test_research_pula.js | 30/60 na kontrolowanych danych, kontynuacja, próg 5×, zatrzymanie, częściowe historie, limit i restart |
| test_research_dom.cjs | Data właściwej rolki, odrzucanie dat komentarzy, autor i liczniki |
| test_research_panel.cjs | Karty, 12/30 na stronie, formularz celu, filtrowanie, XSS, notatki, zapisane, szerokości ekranu, brak pobierania filmu |

Nie ma npm test z agregacją tych testów. Uruchamia się je bezpośrednio.

### Archiwalne próby rzeczywiste

- [Próba z trzema wynikami](C:/Users/pc/Desktop/studio/dane/proba-temat-1790280361420/raport.json).
- [Rozszerzona próba z pierwotnymi 13 wynikami](C:/Users/pc/Desktop/studio/dane/proba-temat-1790281237966/raport.json).
- [Jej surowy stan](C:/Users/pc/Desktop/studio/dane/proba-temat-1790281237966/research_odkrywanie.json).
- [Kopia danych sprzed włączenia wyników Meta](C:/Users/pc/Desktop/studio/dane/research_przed_meta_1790281977046.json).
- [Wcześniejszy audyt publicznych wyników](C:/Users/pc/Desktop/studio/narzedzia/AUDYT-RESEARCH-2026-09-24.md).

Raport z 13 wynikami powstał przed korektą języka. Nie przerabiano archiwum na fikcyjny „od początku poprawny” wynik. Późniejsza weryfikacja dała 12.

### Narzędzia audytu

- [sprawdz_research_temat.js](C:/Users/pc/Desktop/studio/narzedzia/sprawdz_research_temat.js): pełny proces na kopii danych, prawdziwe API, wynik w nowym dane/proba-temat-*. Domyślnie nie scala danych użytkownika.
- [sprawdz_panel_meta.cjs](C:/Users/pc/Desktop/studio/narzedzia/sprawdz_panel_meta.cjs): sprawdzanie panelu na lokalnym pliku próby.
- [zastosuj_probe_research.cjs](C:/Users/pc/Desktop/studio/narzedzia/zastosuj_probe_research.cjs): kontrolowane scalanie wyników z zachowaniem profilu/notatek/zapisanych, z kopią i kontrolą bezczynności.
- [research-polaczenie-meta.cjs](C:/Users/pc/Desktop/studio/narzedzia/research-polaczenie-meta.cjs): pomocniczy transport HTTPS z istniejącej konfiguracji.
- Pozostałe audyt_research_*.js i proba_research_publiczne.js dokumentują wcześniejsze odczyty publiczne; nie uruchamiać wszystkich naraz.

**Pułapki narzędzi:**
- sprawdz_research_temat.js obecnie testuje PL+EN, 30 dni i 3×; --cel zmienia liczbę, ale nie ma kompletnego CLI dla wszystkich filtrów.
- Narzędzie kończy proces, gdy partia przestaje być aktywna. Sam zapis wznow_po w kopii nie oznacza, że narzędzie pozostanie uruchomione przez 15 minut.
- sprawdz_panel_meta.cjs ma założenia o konkretnych autorach z dawnej próby. Nie jest uniwersalnym testem dowolnego nowego wyniku PL.
- --zapisz jest operacją zapisu, a nie zwykłym audytem.
- Narzędzie scalające odpytuje GET lokalnego serwera; ten GET może wznowić kolejkę. Uwzględnić to przed ręczną migracją.
- Nie traktować zrzutu makiety lub testowej strony z zablokowaną siecią jako dowodu działania miniatur, odtwarzania i API w produkcji.

### Przykład uruchomienia pełnej próby w Electronie

Dopiero po sprawdzeniu aktualnej kolejki i limitu. To prawdziwe zapytania, mogące zużyć budżet Meta.

~~~powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\studio'
node -e 'const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE; const p=require("child_process").spawn(require("electron"),["narzedzia/sprawdz_research_temat.js","hipertrofia","--meta","--cel","30"],{stdio:"inherit",windowsHide:true,env});p.on("exit",c=>process.exitCode=c)'
~~~

Nie uruchamiać równolegle z aktywną próbą w Studio. Nie dodano w tym raporcie polecenia zawierającego token.

## 13. Konfiguracja, sekrety i granice danych

Sekrety pozostają w istniejącym, ignorowanym przez Git katalogu:
**C:/Users/pc/Desktop/studio/config**.

Nazwy używane przez Research:
- meta_user_token.txt: token użytkownika;
- ustawienia.json, pole ig_id: identyfikator konta;
- meta_app_secret.txt: sekret aplikacji używany przez inne czynności konfiguracyjne, nie należy go dodawać do promptu ani zwykłego researchu.

Nie ma nowego APIFY_TOKEN, OPENAI_API_KEY ani innych płatnych kluczy dodanych przez ten moduł. Nie prosić o ich utworzenie jako domyślne rozwiązanie.

Token i app secret nie znajdują się w tym raporcie. Nie wyświetlać całych config, pełnych URL żądań ani błędów z parametrami uwierzytelnienia. Daty i identyfikatory kont nie dowodzą aktualnej ważności tokena; sprawdzać ją bezpiecznie dopiero, gdy wymaga tego diagnostyka.

Publiczny odczyt:
- izolowana, nieutrwalona sesja Electrona;
- brak użycia loginu właściciela do pobierania cudzych materiałów;
- zablokowane pobieranie mediów/wideo, obrazów i fontów w oknie zbierającym;
- brak obchodzenia CAPTCHA, challenge i wymagania logowania;
- rzeczywiste miniatury ładuje interfejs kart osobno;
- próba odtwarzania następuje dopiero na działanie użytkownika i tylko z dostępnego bezpiecznego adresu CDN.

Przy pracy nad pełną analizą filmu najpierw rozwiązać legalnie i technicznie źródło materiału oraz zgodę na jego pobieranie. Nie obiecywać analizy po samym URL, jeśli nie ma dostępu do obrazu/audio.

## 14. Git i współpraca z innymi zmianami

Stan odczytany 25.09.2026 przed zapisaniem tego raportu:
- branch: **main**;
- HEAD: **79155ebccebea70c815bb59e7450ffbfcac071a4**;
- wiadomość: **Handoff: stan projektu do przekazania**;
- origin: [kczerwinskii/studio](https://github.com/kczerwinskii/studio);
- porównanie z lokalnym origin/main: **0 ahead / 0 behind**;
- nie wykonano świeżego fetch w tym zadaniu, więc to stan lokalnej referencji zdalnej.

### Zmiany Research, których nie ma w tym commicie

Zmodyfikowane śledzone:
- C:/Users/pc/Desktop/studio/app/research.js;
- C:/Users/pc/Desktop/studio/moduly/research.js;
- wspólny dziennik C:/Users/pc/Desktop/studio/narzedzia/DYSKUSJA.md.

Nowe, nieśledzone obejmują:
- C:/Users/pc/Desktop/studio/app/research-konta.js;
- C:/Users/pc/Desktop/studio/app/research-silnik.js;
- C:/Users/pc/Desktop/studio/app/research.css;
- C:/Users/pc/Desktop/studio/moduly/research-meta.js;
- C:/Users/pc/Desktop/studio/moduly/research-odkrywanie.js;
- C:/Users/pc/Desktop/studio/moduly/research-publiczne.js;
- C:/Users/pc/Desktop/studio/moduly/research-pula.js;
- dokumenty, testy i narzędzia Research wymienione wyżej;
- ten raport i prompt przekazania po ich zapisaniu.

**Nie robić git reset/clean ani odtwarzania katalogu z GitHuba.** Zniszczyłoby to lub pominęło większość wykonanej pracy.

### Równoległe zmiany innego obszaru

W drzewie są zmiany Publikacji, YouTube/TikTok, dokumentów publicznych i zadania 07, m.in.:
- C:/Users/pc/Desktop/studio/app/publikacje.js;
- C:/Users/pc/Desktop/studio/moduly/publikacje.js;
- C:/Users/pc/Desktop/studio/narzedzia/test_publikacje.js;
- C:/Users/pc/Desktop/studio/narzedzia/test_youtube.js;
- C:/Users/pc/Desktop/studio/narzedzia/zadania/07-wpiecie-youtube-tiktok.md;
- C:/Users/pc/Desktop/studio/narzedzia/strony/.

Nie przypisywać ich temu zadaniu i nie nadpisywać. Wspólne pliki main.js, serwer.js, app/app.js, app/index.html, app/style.css mają reguły współpracy w AGENTS.md. Wcześniejsza integracja Research zmieniła tylko jedną linię przekazania tras w moduly/research.js.

config/, dane/ i node_modules/ są w .gitignore. Fable na innym komputerze lub w chmurze nie otrzyma ich przez GitHub. Nie wysyłać sekretów w załączniku do raportu.

Obecne polecenie Kuby dotyczy raportu/przekazania. **Nie wykonano nowego commita ani push i nie wysłano wiadomości do Fable.** Kuba przekaże dokument sam.

## 15. Zalecana kolejność pracy Fable

### P0. Ustalić stan i ograniczyć marnowanie limitu

1. Przeczytać AGENTS.md, ten raport i aktualny kod głównej pętli.
2. Zrobić kontrolowaną kopię danych przed zmianami. Nie ujawniać zawartości sekretów.
3. Sprawdzić bieżącą kolejkę z pliku, zanim GET nieświadomie ją wznowi.
4. Ustalić, czy w danej chwili wyszukiwanie trwa i czy jest sens wykonywać kolejne prawdziwe zapytanie.
5. Dodać bezpieczny pomiar liczby operacji, czasu, błędów i dostępnych nagłówków limitu.
6. Rozdzielić stan zakończenia partii od osiągnięcia celu i od oczekiwania.
7. Nie zwiększać na ślepo liczby równoległych zapytań i nie usuwać opóźnienia jako „naprawy”.

### P1. Poprawić wydajność rzeczywistego odkrywania

1. Zmierzyć, ile żądań i czasu potrzeba na jedno potwierdzone trafienie dla PL, EN i obu języków.
2. Naprawić kontynuację częściowych historii, aby nie powtarzać już pobranych stron.
3. Zweryfikować kolejność analizy autorów i koszt nieznanego języka.
4. Oddzielić liczbę stron źródła, liczbę odczytów DOM i liczbę wszystkich żądań Meta.
5. Sprawdzić świeżość i scalanie wartości z cache.
6. Zweryfikować zakres dostępnych hashtagów i jakość rozszerzeń tematów bez płatnych usług.
7. Porównać puste wyniki z faktycznym wyczerpaniem źródła; nie mylić niedostępnego źródła z brakiem rolek.
8. Wykonać jedną kontrolowaną próbę z celem 30 i pełnym raportem wyniku.

Jeśli bezpłatne, dozwolone źródło nie zapewnia zakładanej liczby i kompletności, przedstawić Kubie konkretne dane o ograniczeniu i możliwy wybór. Nie udawać, że samo dodanie selektora 100 spełniło wymaganie.

### P2. Poprawić wiarygodność i użyteczność

- Lepsze rozpoznawanie języka i oznaczenie niepewności.
- Ewentualne lepsze dopasowanie tematu, z zachowaniem widocznych fraz i kontroli Kuby.
- Dopracowanie błędów miniatur i podglądu.
- Pokazywanie kompletności historii oraz źródła wyświetleń.
- Ochrona zapisanych/notatek przy rozroście cache.
- Rozważenie pomiarów w czasie dla trendu; nie zmieniać definicji obecnego mnożnika bez uzgodnienia.
- Zwiększenie różnorodności autorów jako opcja rankingu, bez samowolnego odrzucania poprawnych wyników.

### P3. Pełna analiza materiału i dokumentacja zewnętrzna

- Osobno zaprojektować analizę obrazu/audio/transkrypcji, z rzeczywistym dostępem do materiału i kosztem zgodnym z warunkiem darmowo.
- Rozróżnić hipotezy „co mogło pomóc” od twierdzeń o przyczynach sukcesu.
- Jeśli dalszy dostęp wymaga pełnego App Review, dopiero wtedy przygotować prawdziwe materiały i zgodny opis danych.
- Uzgodnić zmiany dokumentów publicznych z równoległą pracą nad Publikacjami.

## 16. Kryteria przyjęcia kolejnego etapu

Fable powinien oddać raport z **rzeczywistej próby**, a nie wyłącznie screenshot lub wynik mocka.

Minimum raportu próby:
- temat, wszystkie frazy, język, okres, próg i cel;
- czas rozpoczęcia/zakończenia i całkowity czas;
- liczba kandydatów, autorów i stron;
- liczba żądań API oraz odczytów publicznych;
- liczba potwierdzonych, niekompletnych i odrzuconych z przyczynami;
- dla zaakceptowanych: permalink, data, wyświetlenia, mediana, próbka i źródło licznika;
- wykorzystanie cache i zachowanie po restarcie/przerwaniu;
- dokładna, bezpiecznie przedstawiona przyczyna zatrzymania, jeśli cel nie został osiągnięty;
- test zachowania notatek i zapisanych;
- potwierdzenie braku automatycznego pobierania wszystkich filmów.

Wymagana jakość:
- 30 nie może oznaczać 30 surowych linków bez dat i historii;
- 60 nie może oznaczać powielonych 30;
- 5× nie może wynikać z porównania polubień z wyświetleniami;
- obcojęzyczny opis z angielskimi hashtagami nie jest automatycznie EN;
- brakujące pole nie jest zerem;
- wszystkie wyniki nie powinny być przedstawiane jako „trendujące teraz” na podstawie pojedynczego licznika;
- nie ma obowiązku osiągnięcia zmyślonej liczby, jeśli zewnętrzne źródło ją uniemożliwia. Jest obowiązek uczciwie pokazać ograniczenie i przepracować wykonalne usprawnienia.

## 17. Materiały pomocnicze i ich hierarchia

1. Ten raport, datowany stan i rzeczywisty kod.
2. [AGENTS.md](C:/Users/pc/Desktop/studio/AGENTS.md), zasady repozytorium.
3. [RESEARCH-TEMATY.md](C:/Users/pc/Desktop/studio/narzedzia/RESEARCH-TEMATY.md), chronologia i wcześniejsze diagnozy.
4. [META-APP-REVIEW.md](C:/Users/pc/Desktop/studio/narzedzia/META-APP-REVIEW.md), fakty o dodaniu funkcji i potencjalnym przeglądzie.
5. [DYSKUSJA.md](C:/Users/pc/Desktop/studio/narzedzia/DYSKUSJA.md), wspólny dziennik pracy.
6. [HANDOFF.md](C:/Users/pc/Desktop/studio/HANDOFF.md), wcześniejsze ogólne przekazanie aplikacji, starsze od obecnego Research.
7. Lokalne dane i audyty w ignorowanym katalogu dane/.

Starsze dokumenty zawierają zdania prawdziwe dla wcześniejszych wersji, np. o braku działającego API lub potrzebie restartu. Nie traktować ich jako nadrzędnych wobec późniejszej weryfikacji. Czytać daty i pełną chronologię.

## 18. Co zostało wykonane przy samym przygotowaniu tego przekazania

- Odczytano zasady, kod, stan Git i istniejące raporty.
- Odczytano aktualny lokalny stan bez wywoływania API wyszukiwania.
- Ponownie przeszło sześć zestawów testów offline wymienionych w sekcji 12.
- Zapisano ten raport i osobny prompt startowy dla Fable.
- Nie rozwijano dalej Research, nie zmieniano parametrów użytkownika, nie wymuszano nowych zapytań Meta.
- Nie tworzono nowego zadania AI i nie wysyłano dokumentu do Fable. Przekazanie robi Kuba.
- Pisanie nowych skryptów rolek pozostaje następnym osobnym zadaniem Kuby i Codexa.

**Ostatni uczciwy status:** podstawowy panel, źródło Meta, obliczenia i mechanizm kontynuacji istnieją. Stabilny, skuteczny research z minimum 30 potwierdzonymi rolkami oraz analiza filmu wymagają dalszej pracy.
