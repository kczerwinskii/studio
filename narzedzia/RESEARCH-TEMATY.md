# Research po temacie: aktualny zakres

Decyzje Kuby z 24.09.2026, po utworzeniu HANDOFF.md. Ten dokument uzupełnia przekazanie.

## Aktualny stan: oficjalne API i cel 30/60/100, 24.09.2026 wieczorem

Ta sekcja zastępuje starsze rozpoznanie blokady code 10 poniżej. Po zalogowaniu właściciela w panelu Meta dodano **Instagram Public Content Access**. Status: **Ready for testing**. Ten sam token zaczął obsługiwać ig_hashtag_search, top_media, recent_media i Business Discovery. Nie wysłano pełnego App Review, nie opublikowano aplikacji i nie zmieniano tokenów. Sukces dotyczy obecnego konta właściciela, nie dowolnych użytkowników.

### Wymaganie i realizacja

- Kuba wymaga co najmniej 30 rolek i wyboru większej liczby. Trzy trafienia nie spełniają oczekiwania. Panel pozwala wybrać cel **30/60/100**, osobno od paginacji **12/24/30**. Domyślnie obie liczby wynoszą 30.
- `moduly/research-meta.js`: oficjalne hashtagi po frazach, strony po 10 mediów, tylko permalinki rolek; Business Discovery do 5 stron po 20 publikacji autora. Zagnieżdżona historia daje paging.cursors.after bez paging.next, co sprawdzono na dwóch rzeczywistych stronach bez nakładających się ID.
- `moduly/research-pula.js`: kolejne strony i nowi autorzy aż do celu, wyczerpania źródła, blokady lub budżetu partii. Z historii odkrywamy również starsze rolki zgodne z frazami. Maksymalnie 200 stron hashtagów i 250 odczytów nowych autorów w partii. Kontynuacja korzysta z kursorów i cache.
- `moduly/research-odkrywanie.js`: walidacja celu/filtrów, stan, zatrzymanie, ponowienie po limicie Meta. Przerwa 15 minut to odstęp ponowienia, **nie potwierdzony czas odnowienia limitu**. Maksymalnie trzy automatyczne ponowienia, uruchamiane przez odpytywanie postępu w otwartym panelu Research. Restart zachowuje termin i cel. Zamknięta aplikacja nie pracuje.
- `app/research.js`: postęp potwierdzone/cel, pula/twórcy, wyniki częściowe, zatrzymanie. Większy cel i ponowne wyszukiwanie kontynuują z cache. Filtry są zablokowane w trakcie wyszukiwania.
- Mnożnik: tylko view_count Meta i mediana maksymalnie 20 wcześniejszych unikalnych rolek, minimum 5. Nie mieszamy go z zaokrąglonym licznikiem publicznej strony. Angielski oznacza wszystkie kraje, nie tylko USA.
- Język jest heurystyką **opisu**, nie mowy. Hashtagi/wzmianki/URL nie decydują o języku. Pismo inne niż łacińskie i mieszane opisy mogą wykluczyć potwierdzenie PL/EN. Profil Kuby nie usuwa kandydatów.

### Rzeczywista próba i ograniczenia

Pierwsza mała próba Meta dała 3 trafienia. Rozszerzona próba `dane/proba-temat-1790281237966/` zebrała **495 kandydatów z datami**. Początkowo 13 spełniało PL+EN/30 dni/3×. Kontrola wykryła jeden opis w hindi z angielskimi terminami i hashtagami. Po poprawce rozpoznawania języka pozostaje **12** trafień. Pierwotny raport zachowuje historyczne 13; nie przedstawiać go jako końcowego wyniku.

Przy rozszerzaniu historii API zwróciło **code 4 (limit zapytań)**. **Cel 30 nie został jeszcze osiągnięty w rzeczywistej próbie.** Nie ponawiać zapytań natychmiast ani nie obiecywać pokrycia całego Instagrama. Prawdziwe trafienia: Dc66rBAvfY- (@gunthertraining, około 34,5×), DdbgJmhjZXF (@ashphysiqueacademy, około 10,2×), DdgEmf0jlFd (@maliicki, około 4,3×). To odstępstwo od wcześniejszych rolek, nie dowód aktualnego trendu wzrostowego.

Udostępnienia cudzych rolek: nadal brak danych. Analiza szczegółowa obejmuje opis/statystyki, bez obrazu/audio. Autorzy nie są dostępni w odpowiedzi hashtagowej; odczytujemy ich z publicznej strony dokładnej rolki. Konta bez dostępnego Business Discovery nie dostają zmyślonej historii.

### Weryfikacja i dalszy priorytet

- `node narzedzia/test_research_pula.js`: cel 30/60 na danych kontrolowanych, kursory, próg 5×, zatrzymanie, częściowe historie, przerwa i wznowienie po restarcie. **Nie są to 60 rzeczywistych wyników.**
- `node narzedzia/test_research_meta.js` i `node narzedzia/test_research_odkrywanie.js`: źródła, metryki, daty, walidacja, cache, błędy bez sekretów.
- `node narzedzia/test_research_panel.cjs` i `node narzedzia/test_research_dom.cjs`: Playwright z istniejącego runtime przez NODE_PATH, bez instalacji.
- `narzedzia/sprawdz_research_temat.js TEMAT --meta --baza PLIK`: prawdziwe zapytania na kopii pod dane/proba-temat-*. Zużywa limit API; nie uruchamiać wielu prób równolegle. Opcja --cel 60 zmienia cel.
- Priorytet: dokończyć prawdziwe 30 po odnowieniu limitu, zmierzyć koszty zapytań i czas. Nie obniżać filtrów ani nie dodawać niezwiązanych tematycznie rolek dla dobicia liczby.
- Uruchomiony wcześniej proces Studio wymaga restartu. Nie zmieniano main.js, serwer.js ani Publikacji. Bez nowego commita/pusha.

## Historia wcześniejszych prób (nie aktualny stan dostępu Meta)


## Zgłoszenie: puste wyniki „fitness” i „hipertrofia”, 24.09.2026

Diagnoza źródła: /popular/fitness/ zwraca HTTP 200, ale treść „Strona Page nie jest dostępna”. /popular/hipertrofia/ działa, jednak duża część wyników jest portugalska. Strony /popular/ nie są wyszukiwarką dowolnych słów i nie gwarantują świeżych wyników. Nie traktować dotychczasowego rozwiązania jako kompletnej wyszukiwarki viralów.

Poprawki: fitness rozszerza się na fitness, trening siłowy, workout, strength training, muscle growth. Frazy aktualizują się podczas wpisywania, także przy zatwierdzaniu Enterem. Ręcznie zmienione frazy pozostają zachowane do zmiany tematu/języka. Wykrywane niedostępne strony dostają kod STRONA_NIEDOSTEPNA; częściowe błędy nie usuwają dobrych trafień. Stan ostatniego wyszukiwania (temat, frazy, zakończenie, błędy) jest zapisywany wraz z danymi, więc po restarcie nie pojawia się błędna zachęta do pierwszego wyszukiwania. Na początku nowego wyszukiwania lista poprzedniego tematu jest czyszczona, cache i zapisane inspiracje pozostają.

Próby całego procesu na kopii danych, PL+EN / 30 dni / minimum 3×:
- fitness: 36 kandydatów, 35 poza okresem, 1 bez potwierdzenia daty; 0 wyników. Dwie strony fraz niedostępne, pozostałe dostarczyły karty. Nie przedstawiać tego jako naprawionej dostępności świeżych viralów.
- hipertrofia: 36 kandydatów, 1 potwierdzony wynik Dc3BH5GMKgg około 7,04× mediany 9 wcześniejszych rolek, 3 niepełne, 9 inny język, 23 poza okresem. Odczyt wykorzystał aktualny sześciogodzinny cache; osobna próba strony hipertrofia potwierdziła jej dostępność.
- Testy nie nadpisały danych użytkownika. Narzędzie sprawdz_research_temat.js domyślnie działa tylko na kopii; opcja --zapisz dopuszcza zapis tylko jeśli główny plik nie zmienił się od startu.

Sprawdzono też oficjalne GET /v25.0/ig_hashtag_search?q=hipertrofia z obecnym połączeniem Meta. Odpowiedź HTTP 400, OAuthException, kod 10: wymagane zatwierdzenie funkcji Instagram Public Content Access przez Facebook. Nie zmieniano uprawnień aplikacji, konfiguracji ani tokenów. To sprawdzona przeszkoda dla oficjalnego źródła; nie obiecywać, że sam token ją usunie. Zatwierdzenie wyszukiwania nie jest jeszcze gwarancją dostępności wszystkich cudzych metryk ani historii.

Próby pomocniczego wyszukiwania Bing/Google nie dostarczyły wiarygodnych kandydatów; żadna z tych dróg nie weszła do produkcji. Testy panelu obejmują przejście na fitness Enterem, utrzymanie ręcznych fraz, błąd źródła, odświeżenie strony, pusty wynik i zapisane. Test backendu potwierdza zachowanie błędu po przeładowaniu modułu, a DOM rozpoznaje niedostępną stronę mimo HTTP 200. Pozostaje potrzebne lepsze źródło, nie zmniejszanie rygoru filtrów.

## Poprawka wyszukiwania „budowanie sylwetki”, 24.09.2026

- Profil nie wyklucza wyników. Zapytanie rozszerza się teraz na sześć fraz: budowanie sylwetki, budowanie mięśni, hipertrofia, muscle growth, hypertrophy, body recomposition. Nieznany temat ma stale widoczną informację o braku tłumaczenia w lokalnym słowniku.
- Rzeczywisty test całej ścieżki: 48 kandydatów, 38 ustalonych dat. Przy PL+EN, 30 dniach i minimum 3×: 1 potwierdzony wynik, 4 niepełne, 13 odrzuconych za język i 30 za okres. Potwierdzony wynik: Dc3BH5GMKgg, musclebuildingsimplified, 04.09.2026, około 7,04× mediany 9 wcześniejszych rolek. To ograniczona próbka profilu, nie kompletna historia konta.
- Dwie frazy nie udostępniły kart (budowanie mięśni, body recomposition); jeden permalink nadal bez szczegółów (DCo7LAFAmmv). Wynik zapisano w danych użytkownika z kopią wcześniejszego stanu w dane/proba-temat-*/przed.json. Narzędzie sprawdz_research_temat.js zapisuje tylko jeśli dane nie zmieniły się od początku próby.
- Panel rozróżnia weryfikację w toku od ukończonego pustego wyniku i podaje liczby odrzuceń według języka, okresu i progu. Dodano wykrywanie opisów z przewagą pisma innego niż łacińskie. Test panelu sprawdza oba stany, widoczny komunikat o tłumaczeniu i sześć fraz.
- Przeszły testy silnika, tras, odczytu DOM i panelu oraz git diff --check. Backend wymaga ponownego uruchomienia Studio.
- Najważniejsze dalsze ulepszenie: szersze źródło świeżych kandydatów i wcześniejszej historii. Nie obniżać progów ani nie traktować braków jako potwierdzeń. Obecne publiczne strony nie zapewniają 12–30 świeżych trafień na temat. Nie wdrożono nowego źródła bez weryfikacji jego działania i kosztów.

## Stan wdrożenia: 24.09.2026, po akceptacji makiety

**Aktualizacja po zgłoszeniu „27 niepełnych”:** patrz `AUDYT-RESEARCH-2026-09-24.md`. Dokładniejszy odczyt odzyskał daty wszystkich 27 kandydatów i reakcje 26. Wdrożono uzupełnianie z permalinków i osobną historię profili. Jeden wynik ma potwierdzone około 7× mediany 9 wcześniejszych rolek, przy dacie w ostatnich 30 dniach. Starsze punkty o całkowitym braku dat i historii poniżej opisują pierwszą wersję i są w tym zakresie nieaktualne.

Poniższe starsze sekcje opisują przebieg researchu. Aktualny stan:

- Kuba zaakceptował makietę i polecił wdrożenie. Dodał komentarze, podgląd, analizę na żądanie, 12/24/30 wyników, PL/EN/oba języki, 7/30 dni oraz 3×/4×/5× wcześniejszej mediany wyświetleń. Angielski obejmuje wszystkie kraje, nie tylko USA.
- Po pytaniu o pewność wyników domyślny filtr jest ścisły. Nieznana data, język lub historia nie spełniają filtra. Kandydatów z brakami można pokazać osobnym, domyślnie wyłączonym przełącznikiem; każda karta wymienia niepotwierdzone warunki.
- Nowy panel: `app/research.js`, `app/research.css`. Wspólny silnik: `app/research-silnik.js`. Serwer: `moduly/research-odkrywanie.js`, delegowany z dotychczasowego `moduly/research.js`. Nie zmieniono plików wspólnych ani Publikacji.
- Stary panel kont jest zachowany w `app/research-konta.js` jako opcjonalna zakładka. Nadal używa dotychczasowego API i danych. Jego mnożnik dotyczy interakcji, co panel wyraźnie opisuje.
- Bezpłatny adapter `moduly/research-publiczne.js` otwiera zwykłą stronę `/popular/<fraza>/` w niewidocznym, izolowanym oknie Electrona. Bez tokena i logowania, bez zależności npm. Blokuje pobieranie wideo, zdjęć i fontów w trakcie researchu. Czyta widoczny DOM; nie korzysta z prywatnych endpointów. CAPTCHA lub blokada kończy wyszukiwanie, bez obchodzenia.
- Test rzeczywistego adaptera przez Electron: 12 rolek dla `hypertrophy`, 12 miniatur, 12 przybliżonych liczników i 12 linków do wideo. Nie odtwarzano filmów. Linki mogą wygasać. Nie potwierdzono jeszcze odtwarzania w panelu na wszystkich materiałach.
- Cache frazy 6 godzin, maksymalnie 6 fraz na wyszukiwanie, deduplikacja po kodzie rolki. Stan, profil, zapisane i notatki w `dane/research_odkrywanie.json`, poza Git, atomowo przez istniejący zapis serwera. Wyszukiwanie asynchroniczne z postępem. Błąd nie usuwa zapisanych inspiracji.
- Słownik lokalny rozszerza znane tematy, np. hipertrofia na polskie frazy oraz `hypertrophy` i `muscle growth`. Frazy są widoczne i edytowalne. To nie tłumacz dowolnych tematów ani płatne AI. Profil służy obecnie raportowi i zapisowi kontekstu; nie ma semantycznego rankingu pod profil.
- Statystyki niedostępne są `null`, nigdy wymyślone zero. Publiczne źródło nie dostarczyło dat, polubień, komentarzy, udostępnień ani pełnej historii autorów. Dlatego ścisłe filtry 7/30 dni i 3×/4×/5× mogą nie zwrócić żadnego potwierdzonego wyniku. Tego nie przedstawiać jako kompletnego zamiennika ViralCat.
- Silnik mnożnika jest gotowy i testowany: mediana do 20 unikalnych wcześniejszych rolek tego samego autora, minimum 5, bez badanej rolki i późniejszych publikacji; zero mediany oznacza brak mnożnika. Nie ma obecnie potwierdzonego bezpłatnego źródła tej historii. Porównanie liczników różnie starych filmów nie jest pomiarem tempa trendu.
- Przycisk analizy daje prawdziwy lokalny raport zakresu częściowego: opis, obecność pytania/listy/CTA, dostępne statystyki, kontekst odbiorców, pytania do adaptacji. Nie ogląda filmu ani nie słucha dźwięku; nie wolno nazywać tego pełną analizą hooka, montażu i przyczyn sukcesu.
- Testy: `node narzedzia/test_research_odkrywanie.js`, `node narzedzia/test_research.js`; panel `node narzedzia/test_research_panel.cjs` z Playwright z zewnętrznego runtime w NODE_PATH. Przeszły filtry i braki, poprzednie rolki/mediana, zapis i cache, błąd/blokada, 12/30 kafelków, analiza częściowa, notatki, zapisane, XSS, brak pobierania filmu przed kliknięciem, szerokości 980/1480/1920.
- Jawna próba sieciowa: Electron `narzedzia/proba_research_publiczne.js --online`. Nie zapisuje wyników w danych Kuby. W Windows uruchamiać z oczekiwaniem na proces i ukrytym oknem; zwykły PowerShell może nie czekać na program GUI.
- Uruchomiona już aplikacja wymaga zamknięcia i ponownego otwarcia, ponieważ serwer cache'uje moduły Node. Nie zamykano okna użytkownika ani nie dotykano trwających publikacji.

### Następna praca

1. Uzyskać wiarygodne źródło dat i historii wyświetleń bez obchodzenia ograniczeń. Nie podmieniać mnożnika na polubienia/komentarze.
2. Zweryfikować odtwarzanie po kliknięciu i odświeżanie wygasłych URL; obecny bezpieczny fallback to oryginalna rolka.
3. Pełna analiza filmu wymaga rzeczywistego obrazu, audio/transkrypcji i silnika analizy. Nie włączono płatnego API. Lokalny raport nie rozwiązuje tego wymagania.
4. Weryfikacja języka jest heurystyczna z opisu. Docelowo wykrywać język mowy i osobno oznaczać niepewność.

## Wymaganie użytkownika

Główny Research ma odkrywać rolki nieznanych twórców po wpisaniu np. „hipertrofia”. Wymaganie dodania 10-20 kont nie spełnia celu. Obserwowanie kont zostaje funkcją opcjonalną. Inspiracją jest film AiCAT: https://www.tiktok.com/@aicat_pl/video/7686551605621181729.

Profil ma opisywać kim jest Kuba, dla kogo tworzy i jakie tematy go interesują. Ma pomagać dobierać zapytania i porządkować wyniki, ale nie usuwać po cichu potencjalnie wartościowych materiałów.

Kuba najpierw dopuścił przygotowanie integracji Apify, następnie wyraźnie określił warunek: darmowo. Późniejsze ograniczenie jest nadrzędne. Nie podłączono Apify, nie utworzono konta ani nie uruchomiono płatnego zapytania. Darmowy kredyt próbny nie jest zgodą na późniejsze opłaty.

## Co zweryfikowano

- Przeczytano pełne lokalne polskie napisy filmu, od 00:00 do 04:40. Autor pokazuje: profil i tematy, wybór platform, języka/pochodzenia wyników, okres 7/30/90 dni, listę inspiracji, tłumaczenia/transkrypcje, zapisane i adaptację pomysłu.
- Film nie ujawnia backendu ani źródła danych. Nie przypisywać mu konkretnego dostawcy.
- Próba odtworzenia w przeglądarce wbudowanej została zatrzymana CAPTCHA. Nie rozwiązano jej i nie obejrzano całego pokazu wizualnie. Chrome nie był dostępny przez aktualne narzędzie.
- Obecny moduly/research.js korzysta z Business Discovery dla podanych nazw kont; pole szukania w app/research.js filtruje lokalne tytuły. Nie wyszukuje globalnie.
- Jedna rzeczywista próba GET ig_hashtag_search dla hipertrofia z obecnym połączeniem Meta zwróciła OAuthException, code 10. Nie pobrano wyników. Nie znamy jeszcze pełnej przyczyny i wymaganych zmian dostępu. Nie zmieniano uprawnień.
- Apify Instagram Search Scraper deklaruje wyszukiwanie popularnych rolek po frazach. Nie przetestowano jakości i nie wybrano go jako rozwiązania po warunku darmowo.

## Proponowany interfejs, jeszcze nie wdrożony

Profil rozwijany nad wyszukiwarką; temat + okres + język; Odkrywaj jako tryb domyślny, Zapisane i opcjonalni Obserwowani twórcy. Karty zawierają rzeczywiste liczby, datę, link i źródło. Brak danych nie jest zerem. Podgląd w rozmowie ma wyłącznie przykładowe dane i wymaga akceptacji Kuby przed zmianą działającego UI.

## Następne kroki

1. Wyjaśnić code 10 na podstawie pełnego, bezpiecznie odczytanego komunikatu i bieżącej dokumentacji Meta. Sprawdzić, czy wymagany dostęp jest osiągalny dla tej aplikacji bez opłat. Nie zmieniać uprawnień w ramach samej diagnozy.
2. Jeśli to możliwe, przetestować źródło hashtagowe na jednym temacie. Nie przedstawiać wyszukiwania po hashtagu jako pełnego wyszukiwania semantycznego Instagrama.
3. Jeśli bezpłatne API nie wystarczy, przedstawić uczciwie wariant wspomaganego wyszukiwania w publicznych wynikach/przeglądarce. Nie obiecywać stabilnego automatycznego pobierania ani dostępu do wszystkich statystyk. Nie omijać CAPTCHA i ograniczeń dostępu.
4. Profil, zestawy fraz, notatki, zapisane i porządkowanie mogą działać lokalnie. Nie potrzebują płatnego LLM; jakość semantyczna prostych reguł ma ograniczenia.
5. Wzrost popularności wymaga co najmniej dwóch pomiarów w czasie. Jeden duży licznik wyświetleń nie dowodzi aktualnego trendu. Statystyki cudzych udostępnień mogą być niedostępne.

## Współpraca

W trakcie badania pojawiły się zmiany innego agenta w Publikacjach, testach i zadaniu 07. Nie nadpisywać ich. W tej pracy nie zmieniono działającego Research ani integracji; powstał podgląd w katalogu wizualizacji rozmowy i ten dokument wymagań.

## Wynik dalszego sprawdzenia: potwierdzone bezpłatne odkrywanie

- Pełny komunikat Meta code 10 wymaga App Review i zatwierdzenia Instagram Public Content Access. To nie błąd wpisanej frazy ani brak kont twórców. Nie złożono wniosku.
- Otworzono zwykłą publiczną stronę https://www.instagram.com/popular/hipertrofia/ w przeglądarce wbudowanej, odrzucono opcjonalne cookies. Bez logowania strona pokazała 12 linków do rolek, nazwy twórców, opisy i przybliżone liczby wyświetleń.
- Przykłady z widocznego DOM: https://www.instagram.com/reel/DalwGfOur7i/ (2 mln), https://www.instagram.com/reel/Dbbg0EAuGWc/ (1,2 mln), https://www.instagram.com/reel/DceHuYZs2RZ/ (2,3 mln), https://www.instagram.com/reel/DcPFk0Rpaf6/ (753 tys.). Liczby są zaokrąglonym odczytem strony z 24.09.2026, nie pomiarem wzrostu ani potwierdzeniem prawdziwości porad.
- To konkretna kandydatura na bezpłatne źródło dla aplikacji. Nie jest to zatwierdzone publiczne API i nie sprawdzono jeszcze niezawodności pobierania przez samodzielne Studio. Nie deklarować zakończonej integracji.
- Wyniki dla tej frazy są głównie portugalskie i hiszpańskie. Potrzebne zapytania językowe, jawne rozpoznanie języka, filtrowanie związku z treningiem. Powiązane frazy na stronie obejmują także medycynę, więc sam wyraz jest zbyt szeroki.
- Docelowy adapter może czytać wyłącznie publicznie wyświetlane materiały. W razie CAPTCHA, wymogu logowania lub odmowy zakończyć pobieranie i pokazać komunikat, nie obchodzić ograniczeń. Brak udokumentowanego API oznacza ryzyko zmian strony.
- Minimalny rzeczywisty wynik: link, skrócony opis, autor gdy widoczny, przybliżone wyświetlenia, fraza źródłowa i czas odczytu. Nie wymyślać dat publikacji, polubień, udostępnień ani szybkości wzrostu.
- Profil i lokalne rozszerzanie fraz są niezależne od dostawcy: zawód, odbiorcy, tematy, wykluczenia i preferowane języki. Zestaw zapytań ma być widoczny i edytowalny. Nie zakładać płatnego AI.
- Przed wdrożeniem UI wymagany podgląd zgodnie z AGENTS.md. Makieta pokazana w rozmowie jest przykładowa, nie stanowi działającego Research. Kolejny techniczny krok: sprawdzić adapter w Studio na jednym temacie, potem dopiero integrować panel i deklarować działanie.

### Sprawdzenie po restarcie właściciela

24.09.2026, 22:34 czasu polskiego: działający serwer i prawdziwy panel Studio pokazują 12 wyników oraz cel 30/60/100. O 22:37 nastąpiła automatyczna próba nr 1, bez ponownego klikania. Meta nadal zwracała code 4; wyniki zachowane, następna próba wyznaczona na 22:52. Mechanizm wznowienia jest zatem potwierdzony także na rzeczywistym serwerze, natomiast 30 żywych wyników nadal nie uzyskano. Użytkownik uruchomił Studio ponownie, kolejny restart nie jest obecnie potrzebny.
