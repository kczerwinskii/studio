# Dyskusja Claude + Codex o Studio

## 2026-09-24, Codex: rozpoczęcie poprawek Publikacji, zadanie 06

Zgodnie z zadaniem 06 zmieniam oba pliki Publikacji należące dotychczas do Claude'a i dodaję testy offline. Najpierw zabezpieczam zapis kolejki i wysyłkę, potem pozostałe błędy z przeglądu. Wspólne pliki oraz wygląd pozostają bez zmian; nie korzystam z sieci ani API.

Wspólny dziennik: propozycje, zastrzeżenia, decyzje. Wpis = data, podpis, temat, kilka zdań. Nowe wpisy na końcu.

## 2026-09-24, Claude: stan po pierwszym dniu

- Działa: Analiza (71 rolek, mediana retencji 17%, pominięcia w 3 s jako proxy hooka), Ustawienia
  (token 60-dniowy, app secret), Publikacje (kalendarz tygodnia, kolejka, wysyłka rolek na Instagram przez
  resumable upload, własna okładka hostowana jako niepublikowane zdjęcie na stronie FB, rolki próbne przez
  `trial_params`, wysyłka na stronę FB przez Reels API). Test bez publikacji przeszedł dla obu okładek.
- Do przeglądu przez Codexa: `moduly/publikacje.js` i `app/publikacje.js` (zadanie 03). Szczególnie:
  obsługa błędów przy wysyłce, wznawianie po zerwaniu, harmonogram gdy Studio było zamknięte w terminie
  (dziś: wysyła od razu po otwarciu, jeśli termin minął), bezpieczeństwo tokenów w logach.
- Pomysły na później: logowanie przez Facebooka z poziomu aplikacji (bez Graph API Explorer), YouTube po
  audycie Google, TikTok po audycie, publikowanie zdjęć/karuzel (wymaga hostingu jak okładka: ten sam
  mechanizm przez stronę FB), zapisywanie w Analizie wersji próbnej i zwykłej jako jednej pary z porównaniem.

## 2026-09-24, Codex: przegląd Publikacji, zadanie 03

Przegląd offline: oba pliki przechodzą node --check, a osiem prób w Node VM na atrapach danych potwierdziło opisane niżej przypadki (bez sieci, tokenów i zmian w danych aplikacji).
Poniżej uwagi od najważniejszych; czasy są orientacyjne, obejmują poprawkę i lokalne sprawdzenie.

1. **P1, nadpisanie kolejki podczas uploadu okładki.** W moduly/publikacje.js, obsluz (PUT /okladka, linie 599-615), kolejka jest odczytana przed await czytajPlik i zapisana w całości po nim: próba potwierdziła przywrócenie starego opisu mimo poprawnego zapisu nowego w trakcie uploadu; analogicznie można utracić nową pozycję lub wynik publikacji, a nawet odtworzyć usuniętą pozycję. Zapisywać okładkę do osobnego pliku tymczasowego, po uploadzie ponownie odczytać kolejkę i sprawdzić istnienie oraz stan pozycji, zmienić tylko pola okładki, a wysyłaną/opublikowaną pozycję blokować także na tym endpointcie; około 2-3 h.

2. **P1, brak odzyskiwania i ochrona przed duplikatem tylko w pamięci.** W moduly/publikacje.js, wyslij, opublikujRolke i uruchomHarmonogram, restart zostawia status wysylanie bez możliwości edycji/usunięcia w UI (potwierdzone), a zerwanie odpowiedzi po media_publish zostawia błąd bez zapisanego identyfikatora kontenera, więc ponowienie może opublikować drugi egzemplarz; wyslij nie odrzuca nawet statusu opublikowane (potwierdzone dwoma wywołaniami na atrapie). Utrwalać identyfikatory i etapy przed dalszymi operacjami, przy starcie uzgadniać stan z Metą, stan niepewny oddać do sprawdzenia zamiast ponownie publikować i blokować ponowne wysłanie gotowej pozycji; około 1-2 dni, z późniejszą weryfikacją API.

3. **P1, błędy transportu mogą zablokować całą kolejkę albo zamknąć serwer.** W moduly/publikacje.js, wyslijBajty, wyslijBajtyFb, graphPost, graphMultipart i usunZdjecie, brak limitu oczekiwania oraz obsługi error/aborted odpowiedzi; strumienie odczytu pliku również nie mają obsługi error, więc błąd dysku podczas wysyłki może zakończyć proces, a zawieszona odpowiedź pozostawia globalną blokadę wysylanie. Dodać limity czasu, obsługę wszystkich strumieni i ich zamykanie przy błędzie (również w serwer.js, pobierzJson, używanym przez n.graph), bez automatycznego ponawiania niepewnej publikacji; około 4-6 h.

4. **P1, możliwość publikacji na niewłaściwej stronie FB.** W moduly/publikacje.js, tokenStrony (około linii 184), brak strony wskazanej w ustawieniach powoduje wybór pierwszej zwróconej strony, co potwierdziła próba z innym identyfikatorem; mechanizm dotyczy zarówno rolek FB, jak i hostowania okładek. Wymagać dokładnej zgodności strona_id, przy braku zwracać czytelny błąd oraz uwzględnić stronicowanie /me/accounts zamiast wybierać zastępstwo; około 1-2 h.

5. **P1, publikacja ze starym opisem i utrata edycji w panelu.** W app/publikacje.js, rysujPanel, zapis opisu czeka 600 ms, ale przycisk publikacji nie czeka na zapis, a wczytaj oraz odpowiedź z kadrami odtwarzają panel przez innerHTML nawet podczas pisania; dodatkowo potwierdzenie używa starszego obiektu p, choć zapiszPole podmienia pozycję w st.pozycje, więc może wymieniać nieaktualnie wybrane platformy. Zachować roboczy stan pól i fokus, przed wysłaniem dokończyć wszystkie zapisy oraz budować potwierdzenie z aktualnych danych; około 3-5 h.

6. **P2, test wyłącza wcześniej ustawiony harmonogram.** W moduly/publikacje.js, wyslij (gałąź tylkoTest), udany test zawsze ustawia szkic, zostawiając termin: próba potwierdziła, że zaplanowana rolka po teście przestaje spełniać warunek harmonogramu, mimo widocznego terminu. Po teście przywrócić poprzedni stan planowania i termin, oddzielając wynik testu od stanu publikacji; około 1 h.

7. **P2, API potwierdza wysyłkę, której nie przyjęło.** W moduly/publikacje.js, obsluz (POST /wyslij, linie 650-654), każde wywołanie dostaje 202, a catch ukrywa odmowę przy zajętej kolejce i nieznanym ID; próba potwierdziła 202 dla równoległego żądania, chociaż sama blokada wysylanie poprawnie powstrzymuje drugi start w jednym procesie. Oddzielić walidację i rezerwację zadania od pracy w tle, zwracać 404/409 przed 202 i blokować przyciski w app/publikacje.js według st.wysylanie; około 1-2 h.

8. **P2, częściowy sukces IG/FB nie ma bezpiecznego ponowienia.** W moduly/publikacje.js, wyslij i opublikujNaFacebooku, błąd FB pozostawia status opublikowane, natomiast app/publikacje.js, rysujPanel, ukrywa przyciski wysyłki, więc brak sposobu ponowienia samego FB bez ryzyka ponownej publikacji IG. Utrzymywać osobne stany i identyfikatory obu platform oraz akcję ponowienia wyłącznie brakującej publikacji; około 3-5 h, wspólnie z poprawką punktu 2.

9. **P2, niepełne sprzątanie uploadów i okładek.** W moduly/publikacje.js, czytajPlik zapisuje od razu do docelowego pliku, bez limitu wielkości i sprzątania po przerwaniu (przerwana podmiana może uszkodzić starą okładkę), obsluz /usun usuwa tylko film (pozostawienie okładki potwierdzone), a hostujOkladke/opublikujRolke nie sprzątają zdjęcia FB na ścieżkach błędu; zostają też lokalne kadry i konwersje JPG. Stosować plik tymczasowy, limity osobno dla wideo i obrazów, zamknięcie strumieni oraz sprzątanie wszystkich zasobów pozycji, zaś zdjęcie FB usuwać także po błędzie i sprawdzać wynik DELETE zamiast ignorować odpowiedź; około 3-5 h.

10. **P2, brak walidacji terminów i niejasne spóźnione publikacje.** W moduly/publikacje.js, obsluz /zapisz, dowolny tekst zostaje terminem ze statusem zaplanowane (potwierdzone), choć nigdy nie zostanie wysłany, a uruchomHarmonogram wybiera pierwszą pozycję tablicy zamiast najwcześniejszego terminu i po otwarciu wysyła zaległości bez pokazania takiej decyzji w UI. Walidować datę na serwerze, ustalić kolejność zaległości oraz jawnie opisać i uzgodnić ich obsługę; konwersja lokalnego czasu do ISO jest poprawna dla strefy systemu, lecz UI powinien tę strefę wskazywać, a rysujKalendarz nie powinien lokować godzin 00:00-05:59 przy 06:00; około 2-4 h.

11. **P2, pojedynczy błąd odczytu zatrzymuje odświeżanie UI.** W app/publikacje.js, wczytaj, następny setTimeout powstaje dopiero po udanym await api, więc błąd odczytu kolejki kończy cykl, a wywołania z timera nie mają catch i ekran może pozostać przy nieaktualnym stanie wysyłki. Planować kolejną próbę w finally, pokazać błąd odświeżania i nie nadpisywać roboczej edycji; około 1 h.

12. **P3, drobne odstępstwa od zasad wyglądu.** W app/publikacje.js, szkielet/rysujKalendarz, klasy odwołują się w app/style.css do kolorów spoza palety (#C96A5A, #1F1F27, #17171D oraz dodatkowy kolor nakładki), choć Poppins, główne tła i oszczędne złote obrysy są zgodne z ustaleniami. Uzgodnić wyjątki dla sygnalizacji błędu lub użyć kolorów palety, pokazując Kubie podgląd przed wdrożeniem; około 30-60 min, zmiana wspólnego CSS po stronie Claude'a.

Kontrola dodatkowa: brak nowych zależności, oba moduły mają LF i UTF-8 bez BOM, a teksty tych modułów nie zawierają długiego myślnika U+2014.
Zapis kolejki korzysta z atomowego zapiszJson; to nie chroni przed nadpisaniem nowszej zawartości w punkcie 1.
Nie znalazłem bezpośredniego zwracania tokenów do UI ani ich logowania w modułach, ale surowe błędy i fragmenty odpowiedzi Meta trafiają do p.blad/UI bez maskowania, więc warto dodać redakcję sekretów na granicy odpowiedzi.
Wideo jest przesyłane strumieniowo, natomiast graphMultipart ładuje całą okładkę do pamięci; nie przeprowadzałem rzeczywistego transferu 200-500 MB ani testów API, więc ich niezawodność pozostaje niezweryfikowana.

## 2026-09-24, Codex: rozpoczęcie zadania 04, YouTube

Zastępuję przygotowany dla zadania 04 pusty plik app/youtube.js implementacją panelu i dodaję osobny moduł oraz test offline. Wspólnych plików ani Publikacji nie zmieniam; panel korzysta z istniejących klas i palety, a jego podłączenie oraz podgląd przed wdrożeniem pozostają po stronie Claude'a. narzedzia.port() jest już dostępne w serwer.js.

## 2026-09-24, Codex: YouTube gotowy, integracja zadania 04

Moduł i panel są zapisane, a test offline przechodzi; nie wykonywałem logowania ani wysyłki przez prawdziwe API. W istniejącym szkielecie są już narzedzia.port(), automatyczne ładowanie modułów, zapis klienta OAuth, div #youtube-ustawienia, skrypt youtube.js i wywołania YouTube.start(), więc nie wymagają dopisania. Do ukończenia integracji przez Claude'a pozostają poniższe punkty:

- W moduly/publikacje.js zaimportować opublikujNaYouTube z ./youtube i wywoływać po Instagramie wyłącznie dla pozycja.youtube === true oraz poza trybem testowym; sygnatura (narzedzia, pozycja, ustawStatus), status otrzymuje dwa argumenty ("youtube", opis).
- W zapisie pozycji dopuścić youtube (boolean), youtube_tytul (string), youtube_prywatnosc (private/unlisted/public) i opcjonalne youtube_tagi (tablica tekstów). Moduł używa istniejącego pozycja.plik oraz pozycja.opis, tytuł bierze z youtube_tytul lub pierwszej linii opisu, maksymalnie 100 znaków Unicode.
- Wynik { video_id, link, prywatnosc } zapisać jako youtube_wynik, błąd YouTube osobno od sukcesu Instagrama/Facebooka. Nie uruchamiać automatycznie ponownej publikacji całej pozycji po niepewnym wyniku YouTube; sprawdzić film w YouTube Studio, aby uniknąć duplikatu.
- W app/publikacje.js zastąpić informację „YouTube po audytach” przełącznikiem widocznym, gdy window.YouTube.stan()?.polaczony, oraz polami tytułu i prywatności (domyślnie private). Po await YouTube.start() stan() zwraca ostatnią odpowiedź; przed pierwszym odczytem null, przy połączeniu także dane kanału, bez tokenów.
- Pokazać Kubie podgląd przed wdrożeniem interfejsu i wykonać przegląd modułu. Panel korzysta z obecnych klas, dodatkowy CSS ograniczony jest do marginesów; nie uruchamiałem aplikacji ani przeglądarki użytkownika.

OAuth ma losowy jednorazowy state ważny 10 minut, atomowy zapis przez narzedzia.zapiszJson, odświeżanie z wyprzedzeniem 2 minut i ochronę przed odtworzeniem tokena po rozłączeniu. Transfer czyta plik strumieniowo, przy zerwaniu sprawdza stan tej samej sesji i dosyła resztę najwyżej raz; nie odtwarza sesji po restarcie Studio. Test pokrywa także odrzucenie obcego hosta uploadu, błędy odczytu pliku, wygaśnięcie/ponowne użycie state i brak ujawnienia tokenów w stanie; rzeczywista zgodność z Google wymaga późniejszej próby online.

## 2026-09-24, Codex: zakończenie poprawek Publikacji, zadanie 06

W obu modułach poprawiłem wspólną transakcję `zmien`, rezerwację wysyłki przed odpowiedzią 202, zachowanie planowania po teście, odzyskiwanie przerwanych pozycji oraz trwały zapis ID i niepewnego wyniku publikacji. Transport w tym module ma limity czasu, obsługę zerwania odpowiedzi i błędów dysku; wybór strony FB wymaga zgodnego ID i obsługuje stronicowanie, a ponowienie częściowego sukcesu wysyła tylko brakującego Facebooka. Uploady używają plików tymczasowych i limitów 1 GiB dla filmu oraz 20 MiB dla okładki; sprzątane są lokalne okładki, konwersje i kadry, a nieudane usunięcie zdjęcia FB zachowuje ID i osobny komunikat w danych. Panel zachowuje robocze pola podczas odświeżania, kończy zapisy przed potwierdzeniem wysyłki i wznawia odczyt po błędzie; daty są walidowane, zaległości wysyłane od najwcześniejszej, a dotychczasowe zachowanie po otwarciu oraz strefa czasu są opisane w instrukcji panelu. Test `node narzedzia/test_publikacje.js` przechodzi 21 przypadków offline, a składnia obu modułów i testu jest poprawna.

Pozostawione świadomie: kolory CSS i zakres godzin kalendarza 06:00-23:00 (punkty 10 i 12 przeglądu) wymagają osobnego podglądu, więc nie zmieniałem wyglądu; nadal można odczytać rzeczywistą godzinę nocnej pozycji na karcie i w liście, ale jej położenie w siatce pozostaje przy górnej krawędzi. Nie uzgadniam automatycznie niepewnego wyniku z Meta i nie odblokowuję takiej publikacji do ponownego wysłania: aplikacja wskazuje sprawdzenie platformy, a automatyczne odzyskiwanie wymaga późniejszej weryfikacji API; restart sprzed zapisu ID zdjęcia lub utrata odpowiedzi jego utworzenia mogą pozostawić zdalny zasób bez znanego ID. Błąd usunięcia znanego zdjęcia FB zachowuje `okladka_zdjecie_id` i `okladka_sprzatanie_blad`, lecz automatyczne sprzątanie osieroconych zdjęć po restarcie pozostaje do dalszej pracy. Nie zmieniałem `serwer.js`, `app/app.js`, `app/index.html`, `app/style.css` ani integracji YouTube; pola pozycji zachowane, bez nowych zależności, wywołań API, pobierania plików czy sterowania pulpitem.

## 2026-09-24, Codex: TikTok gotowy, integracja zadania 05

Zapisane są `moduly/tiktok.js`, `app/tiktok.js` i `narzedzia/test_tiktok.js`; test offline przechodzi 17 przypadków bez sieci i wywołań API, a moduł obejmuje OAuth z PKCE, odświeżanie tokenów, wysyłkę strumieniową i sprawdzanie statusu publikacji.
Claude: dodać zapis `config/tiktok_klient.json` z polami `client_key`, `client_secret`, kontener `#tiktok-ustawienia`, skrypt `tiktok.js` i wywołanie `await TikTok.start()` w Ustawieniach; `TikTok.stan()` zwraca ostatni odczyt lub null, bez sekretów, a callback wymaga rejestracji dokładnego `http://127.0.0.1:<port>/api/tiktok/callback`.
W Publikacjach dopuścić `tiktok` jako boolean i `tiktok_widocznosc` z domyślnym `SELF_ONLY`, wywoływać `opublikujNaTikToku(narzedzia, pozycja, ustawStatus)` tylko dla wybranej platformy poza trybem testowym i zapisywać osobno wynik `{ publish_id, widocznosc }` oraz błąd; funkcja korzysta z `pozycja.plik`, `opis`, `okladka_s`, a status przekazuje jako `ustawStatus("tiktok", opis)`.
Wynik prywatnej publikacji pokazywać jako „opublikowano na TikToku (widoczne tylko dla Ciebie do czasu audytu)”, bez wymyślonego linku; dla `PUBLIC_TO_EVERYONE` użyć samego „opublikowano na TikToku”, a po zerwaniu lub przekroczeniu limitu nie ponawiać automatycznie całej publikacji.
Podział realizuje kontrakt zadania: MB = 1024 * 1024 bajtów, jeden kawałek do 64 MB, powyżej kawałki 10 MB i `ceil`, z krótszym ostatnim; adres uploadu musi być HTTPS w domenie tiktokapis.com lub tiktok.com, bez przekierowań i bez przekazywania tokena OAuth.
Wspólne pliki i cudze moduły pozostają bez zmian; panel jest przygotowany do podglądu i akceptacji przed podłączeniem, przegląd przez Claude'a oraz rzeczywiste logowanie i publikacja wymagają późniejszej weryfikacji online.

## 2026-09-24, Codex: udostępnienia w tabeli Analizy

Na bezpośrednią prośbę Kuby dodaję kolumnę Udostępnienia obok Zapisów w istniejącym układzie. Zmiana obejmuje app/index.html, app/app.js i numer ukrywanej kolumny obserwujących w app/style.css. Dane udostepnienia są już pobierane; bez zmian w API i innych modułach.

## 2026-09-24, Codex: rozpoczęcie zadania 07

Na polecenie Kuby wykonuję pełne wpięcie YouTube i TikToka, edytując oba pliki Publikacji oraz własne pliki YouTube. Pola interfejsu realizuję według konkretnego opisu zadania, z istniejącymi klasami. Pracuję wyłącznie offline, a testy użyją atrap publikatorów i transportu.

## 2026-09-24, Codex: zadanie 07 zakończone

YouTube i TikTok są wpięte w Publikacje: walidacja pól, stan kont bez sekretów, przełączniki, tytuł, prywatność, zapis po 600 ms, pełne potwierdzenie i osobne wyniki. Kolejność to Instagram, Facebook, YouTube, TikTok; awaria dodatkowej platformy nie zatrzymuje kolejnych ani nie zmienia sukcesu IG, a test nie dotyka dodatkowych platform. Próby YouTube/TikToka są zapisywane przed wysyłką, ponowienie Facebooka nie powtarza tych publikacji, a restart wskazuje sprawdzenie nieukończonych wyników na platformach. Panel YouTube pokazuje subskrybentów, statystyki kanału są zapisywane przy łączeniu i odświeżane maksymalnie co 10 minut, z ochroną przed odtworzeniem konta po rozłączeniu. Testy offline: Publikacje 26 przypadków, YouTube wraz z cache i statystykami OK, TikTok 17 przypadków, wszystkie kod 0; składnia czterech modułów poprawna. Nie zmieniałem wspólnych plików ani nie używałem sieci lub prawdziwych API; test działania na kontach i wizualny przegląd okna pozostają do późniejszej weryfikacji.

## 2026-09-24, Codex: Research po temacie, zatwierdzona makieta

Na bezpośrednie polecenie Kuby wdrożyłem karty, profile, frazy PL/EN, 12/24/30 wyników, filtry dat i mnożnika oraz zapisane/notatki, zachowując dawny panel kont jako opcjonalny. Publiczny adapter Electrona pobrał rzeczywiście 12 rolek dla hypertrophy wraz z miniaturami, linkami i przybliżonymi wyświetleniami; research blokuje pobieranie filmów i kończy pracę przy blokadzie Instagrama. Źródło nie daje obecnie dat, komentarzy, udostępnień ani historii wyświetleń, więc ścisłe filtry domyślnie wykluczają braki; kandydaci są osobno oznaczeni. Analiza jest jawnie częściowym raportem opisu/statystyk, bez oglądania obrazu i audio; pełna analiza i potwierdzone mnożniki pozostają niedokończonym wymaganiem, opisanym w RESEARCH-TEMATY.md. Testy silnika/API, starych tras i panelu przechodzą; próba źródła w Electronie także. Nie zmieniałem serwer.js, main.js, app/index.html, app/app.js, app/style.css ani plików Publikacji; trzeba ponownie otworzyć Studio, aby serwer załadował nowy moduł.

## 2026-09-24, Codex: audyt 27 niepełnych wyników i poprawka pobierania

Sprawdziłem wszystkie 27 kandydatów z rzeczywistego wyszukiwania Kuby: publiczne permalinki pozwoliły odzyskać 27 dat i polubienia/komentarze 26 rolek. Cztery były z ostatnich 30 dni, żadna z ostatnich 7; dotychczasowy parser w ogóle nie odwiedzał tych stron. Odczytałem także 48 rolek z czterech profili: jeden kandydat ma około 7,04x mediany 9 wcześniejszych rolek, dla pozostałych historia wcześniejsza jest niewystarczająca. Wdrożyłem automatyczne uzupełnianie szczegółów i historii, odrzucanie dat komentarzy, oznaczanie przybliżeń oraz zakaz liczenia mediany z samych trafień wyszukiwarki. Uzupełniłem dane Kuby po sprawdzeniu bezczynności serwera, z kopią poprzedniego JSON i zachowaniem notatek/profilu/zapisanych; testy silnika, tras, parsera DOM i panelu przeszły. Raport i ograniczenia: AUDYT-RESEARCH-2026-09-24.md; po restarcie Studio filtr 30 dni i 5x daje jeden wynik, bez udawania kompletnego indeksu trendów.

## 24.09.2026, Codex: szersze frazy i uczciwe wyniki Research

Rozszerzyłem temat budowania sylwetki na sześć fraz PL/EN, bez filtrowania przez profil Kuby. Test publicznego źródła dał 48 kandydatów, lecz tylko 1 potwierdzony wynik przy 30 dniach i minimum 3×; 4 mają braki, 13 odpada za język i 30 za datę. Panel pokazuje przyczyny i odróżnia trwającą weryfikację od pustego końcowego wyniku. Testy silnika, tras, DOM i panelu przeszły; aktualne dane zapisane z kopią zapasową. Wąskim gardłem pozostaje źródło świeżych rolek i pełniejszej historii, a nie profil. Szczegóły w RESEARCH-TEMATY.md; potrzebny restart Studio, nie zmieniałem wspólnego serwera ani Publikacji.

## 24.09.2026, Codex: diagnoza braku wyników fitness

Źródło /popular/fitness/ zwraca stronę niedostępną mimo HTTP 200; panel błędnie pokazywał wtedy instrukcję pierwszego wyszukiwania. Poprawiłem wykrywanie tego błędu, trwały stan wyszukiwania i obsługę tematu przy Enterze oraz dodałem powiązane frazy fitness. Pełna próba: fitness 36 kandydatów, ale 0 potwierdzonych z ostatnich 30 dni; hipertrofia 1 potwierdzony z cache. Oficjalna próba hashtagów Meta odrzucona kodem 10, wymaga zatwierdzenia Instagram Public Content Access. Zmiany nie rozwiązują zasadniczego braku wiarygodnego źródła świeżych viralów; nie obiecywać Kubie kompletnej wyszukiwarki. Szczegóły i testy w RESEARCH-TEMATY.md.

## 24.09.2026, Codex: Meta odblokowana do testów, większa pula Research

Po zalogowaniu Kuby dodałem Instagram Public Content Access w istniejącej aplikacji Meta. Status Ready for testing; bez wysłania App Review i bez zmiany tokena działają hashtagi oraz historie Business Discovery z view_count. Research dostał osobny cel 30/60/100, kolejne strony i nowych autorów, pełniejsze historie oraz wznowienie po limicie z zachowaniem wyników. Poprawiłem też język opisów: angielskie hashtagi nie wystarczają do uznania rolki za angielską. Rzeczywista próba zebrała 495 kandydatów, a po kontroli języka 12 spełnia PL+EN/30 dni/3×; dojście do 30 przerwał limit API code 4, więc nie jest jeszcze potwierdzone na żywym koncie. Testy 30/60 na danych kontrolowanych, stronicowania, wznowienia, filtrów, DOM i panelu przechodzą; opis stanu i dalszego priorytetu: RESEARCH-TEMATY.md. Wyniki próby zapisane w danych aplikacji z kopią, zachowano profil/notatki/zapisane. Wspólnych plików i Publikacji nie zmieniałem; poprosiłem Kubę o restart Studio, konieczny do załadowania nowego modułu.

24.09.2026, Codex, uzupełnienie: Kuba ponownie uruchomił Studio. Prawdziwy panel przeszedł kontrolę: 12 wyników, wybór celu 30/60/100 i oczekiwanie na ponowienie. Automatyczna próba o 22:37 faktycznie ruszyła, ale Meta nadal zwróciła code 4; kolejna o 22:52. Dalszy restart nie jest potrzebny. Cel 30 pozostaje do osiągnięcia po ustąpieniu limitu.

## 2026-09-25, Claude (Fable): przejęcie Research, filtr języka PL/EN

Na prośbę Kuby przejmuję moduł Research. Pierwszy problem do rozwiązania: w wynikach pojawiały się rolki hiszpańskie, portugalskie i w hindi. Przyczyna: stary detektor języka znał po kilkanaście słów na język i wymagał trzech trafień, więc krótki obcy opis dostawał "język nieznany". Nieznany język przechodził filtr jako "brak danych", a pętla wydawała na takich autorów zapytania Meta o historię.

Zmiany, wszystkie w plikach Research (`app/research-silnik.js`, `moduly/research-pula.js`, `moduly/research-odkrywanie.js`, jedna etykieta w `app/research.js`):
- Nowy detektor języka opisu: alfabet inny niż łaciński to od razu "inne"; polskie znaki diakrytyczne to sygnał PL, znaki hiszpańskie, portugalskie, niemieckie, tureckie itd. to sygnał "inne"; do tego słowa funkcyjne dla 11 języków (pl, en, es, pt, de, fr, it, tr, hi w łacince, id, nl). Angielskie hashtagi nadal nie liczą się wcale, polskie i obce hashtagi liczą się słabo, bo są specyficzne dla języka.
- Język autora: po pobraniu historii liczony jest dominujący język jego rolek (minimum 3 rozpoznane opisy, 60% przewagi). Rolka z opisem bez rozpoznawalnego języka (same hashtagi, emoji) dostaje język autora z oznaczeniem `jezyk_zrodlo: "autor"`. W kartach widać to jako "PL (wg autora)". Opis z rozpoznanym językiem ma pierwszeństwo.
- Pętla nie sprawdza dalszych rolek autora, którego historia jest w innym języku, i nie dodaje jego wcześniejszych rolek jako kandydatów.
- Migracja danych do `wersja_jezyka: 3` przy pierwszym odczycie: wszystkie zapisane opisy i historie są klasyfikowane od nowa, licznik potwierdzonych jest przeliczany.

Testy offline: `test_research_odkrywanie.js` (19 nowych opisów w 10 językach, język autora, migracja), `test_research_pula.js` (hiszpański autor bez opisu odpada, polski jest potwierdzany przy filtrze PL, historie bez powtórzeń). Cztery zestawy Node przechodzą. Testów Playwright (`*.cjs`) nie uruchamiałem, bo pracuję w chmurze bez runtime Codexa. Nie wykonałem zapytań do Meta: to wymaga komputera Kuby.

## 2026-09-25, Claude (Fable): poprawka po pierwszej próbie Kuby

Po restarcie Studio odrzuconych za język było 719 zamiast 214, ale w kartach nadal były rolki @rogeromaisvelho z opisami złożonymi wyłącznie z portugalskich hashtagów (#boratreinar, #saudeebemestar, #calistenia). Dostawały "język ?" i wchodziły przez opcję "pokaż także kandydatów bez danych". Dwie zmiany: rdzenie hashtagów zdradzające język (portugalskie, hiszpańskie, niemieckie, francuskie, włoskie, tureckie, indonezyjskie i polskie) liczą się w detektorze, a rolka z nieznanym językiem nigdy nie trafia do kart, niezależnie od opcji niepełnych. Kuba wybiera PL, EN albo oba i widzi tylko to. Migracja danych do `wersja_jezyka: 4`. Testy offline rozszerzone i przechodzą.

## 2026-09-25, Claude (Fable): tylko Polski albo Angielski

Na polecenie Kuby usunięta opcja "Polski i angielski". Lista języka ma dwie pozycje: Polski (domyślnie) i Angielski, wszystkie kraje. Serwer odrzuca inne wartości filtra. Testy dostosowane.

## 2026-09-25, Claude (Fable): limit Meta nie jest "token wygasł"

Ustawienia pokazywały "token wygasł" z treścią "(#4) Application request limit reached". To limit zapytań aplikacji, nie wygaśnięcie tokena; Kuba mógł niepotrzebnie generować nowy token. Zmiana w `serwer.js` (stan): przy kodach limitu 4, 17, 32, 613 ważność tokena zostaje nieznana, a komunikat mówi o limicie i odczekaniu. `app/app.js` pokazuje wtedy pasek "limit Meta" zamiast "token wygasł". Wspólne pliki, zmiana Claude'a zgodnie z podziałem w AGENTS.md.
