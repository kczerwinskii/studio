# Studio: Instagram Public Content Access

Aktualizacja 24.09.2026. Aplikacja „Kuba Czerwinski Studio”, ID `1823206525790813`.

## Co faktycznie zrobiono

Właściciel zalogował się samodzielnie. W przypadku użycia Instagram dodano **Instagram Public Content Access**. Status zmienił się na **Ready for testing**. Nie wysłano pełnego App Review, nie opublikowano aplikacji i nie zmieniono sekretów ani tokenów.

Przed dodaniem funkcji ig_hashtag_search zwracało code 10. Po dodaniu **ten sam token** zaczął zwracać wyniki. Działają hashtagi, recent_media, top_media oraz business_discovery dla dostępnych kont zawodowych. view_count działa w historii Business Discovery i umożliwia porównywanie rolek twórcy. Nie działa bezpośrednie pobranie dowolnego obcego ID mediów; username/view_count w odpowiedzi hashtagowej są nieobsługiwane.

Wynik dotyczy testów prywatnej aplikacji właściciela. Nie dowodzi zatwierdzenia dla innych użytkowników. Nie prosić ponownie o logowanie i nie przedstawiać App Review jako bieżącej przeszkody. Obecna przeszkoda większego wyszukiwania to zaobserwowany **limit API code 4**. Szczegóły: [RESEARCH-TEMATY.md](RESEARCH-TEMATY.md).

## Jeśli później potrzebny będzie pełny przegląd

Opis zastosowania do dopasowania do rzeczywistego formularza:

Studio is a private desktop application used by its owner, a fitness content creator, to plan and manage his own Instagram content. Instagram Public Content Access is used to discover public media associated with training-related hashtags, review available captions and engagement information, and save links and personal notes for content planning. Research does not send messages to the authors or automatically republish their content. The application distinguishes unavailable metrics from zero values.

Nie deklarować funkcji ani odbiorców, których produkt nie ma. Nie potwierdzono wymagań końcowego formularza, terminów zatwierdzenia ani uprawnień dla innych kont.

## Dokumentacja danych przed zgłoszeniem

- `narzedzia/strony/studio-polityka.html` twierdzi, że aplikacja nie zbiera danych innych osób. To nie odpowiada Research. Nie zgłaszać tej wersji jako kompletnego opisu danych.
- `narzedzia/strony/studio-regulamin.html` opisuje użytek własny. Nie zmieniano go.
- Nie zmieniano i nie publikowano publicznych dokumentów ani nie akceptowano nowych oświadczeń za użytkownika.

Research przechowuje lokalnie identyfikatory i linki rolek, publiczne nazwy twórców, opisy, daty, dostępne liczniki, adresy miniatur, wcześniejsze publikacje potrzebne do mediany, źródło i datę odczytu, kursory, profil tematyczny właściciela, zapisane inspiracje i notatki. Plik: `dane/research_odkrywanie.json`; kopie audytowe także w dane/. Cofnięcie tokena nie usuwa plików. Research nie pobiera filmów podczas szukania. Analiza nie obejmuje obrazu/audio.

## Konfiguracja

Istniejące `config/meta_user_token.txt` i pole `ig_id` w `config/ustawienia.json`. Nie kopiować wartości do dokumentów, logów, Git ani odpowiedzi. Publiczny odczyt autora wymaga Electrona. Czysty Node wystarcza do samego API Meta i testów offline.

## Współpraca

Kuba polecił przejąć autoryzowane czynności techniczne. Gdy potrzebny jest jego udział, przekazać jeden prosty krok. Hasło, 2FA i oświadczenia właściciela pozostają po jego stronie; nie żądać ich w czacie.
