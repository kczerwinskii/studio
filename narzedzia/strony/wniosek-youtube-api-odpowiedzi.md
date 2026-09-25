# Wniosek o audyt YouTube API, komplet odpowiedzi (24.09.2026)

Formularz: https://support.google.com/youtube/contact/yt_api_form?hl=pl (zalogowany jako kczerwinski033@gmail.com)

## Sekcja 1
- Powód: „Przeprowadzenie kontroli zgodności w związku z prośbą o zwiększenie limitu"

## Sekcja 2
- W czyim imieniu: Jako użytkownik indywidualny
- Pełne imię i nazwisko: Jakub Czerwiński
- Nazwa prawna organizacji: Ja
- Nazwa firmy nadrzędnej: Ja
- Główna witryna: https://www.instagram.com/kubaczerwinskii/
- Kraj: Inna odpowiedź → Polska
- Adres: ul. Pocztowa 6/1, Miasto: Lubraniec, Województwo: kujawsko-pomorskie, Kod: 87-890
- Kategoria: Narzędzia i usługi dla twórców
- Rozmiar: Niezależny deweloper lub jednoosobowa działalność gospodarcza
- Główna osoba kontaktowa: Jakub Czerwiński, kczerwinski033@gmail.com
- Kontakt techniczny i biznesowy: „Taka sama jak główna osoba kontaktowa" (oba checkboxy)

## Sekcja 3
- Opis (wklej):
  Studio is a private desktop application used exclusively by me, Jakub Czerwinski, an online personal trainer from Poland, on my own computer. It uploads my own short vertical training videos (Shorts), which I already publish manually on my Instagram account (@kubaczerwinskii), to my own YouTube channel (channel ID UCVx2lbv8F-Ahng0qn_gIRxg), and it shows basic statistics of my own channel (subscriber count, views). The application is not distributed to anyone else, has no other users, is not monetised, and does not store or process any third-party or viewer data. Purpose of this request: to lift the restriction that sets videos uploaded through the API to private, so that my Shorts can be published with the visibility I choose. The default quota (10,000 units per day) is sufficient: at most 1 or 2 uploads per day.
- Odbiorcy: Użytkownicy wewnętrzni
- Zarabianie: Usługa bezpłatna
- Przedstawiciel Google: Nie, nie współpracuję z żadnym przedstawicielem Google
- Pierwsze źródło informacji: dowolne (pole nieobowiązkowe)

## Sekcja 4
- Nazwa klienta API: Studio
- Nazwa zawiera „YouTube": Nie
- Główny adres URL dostępu: https://kczerwinskii.github.io/plan/studio.html
- Polityka prywatności: https://kczerwinskii.github.io/plan/studio-polityka.html
- Warunki usługi: https://kczerwinskii.github.io/plan/studio-regulamin.html
- Dostępny publicznie: Nie
- Konto demonstracyjne: pola puste, checkbox „Wymagane potwierdzenie" zaznaczony

## Sekcja 5
- Liczba projektów: 1
- Numer projektu Google Cloud: 837489208126
- Kategorie: Przesyłanie filmów i zarządzanie kontem; Wewnętrzne narzędzie firmowe; Statystyki i raportowanie
- OAuth 2.0: Tak
- Checkbox „Znam dodatkowe zasady dotyczące danych pochodnych…": zaznaczony
- Oczekiwana liczba żądań: Mniej niż 1000 żądań dziennie
- Załączniki (folder narzedzia/strony/zrzuty): polityka-prywatnosci.png, strona-glowna.png, regulamin.png,
  oauth-zgoda-i-interfejs-wysylki.png (w scratchpadzie sesji; do odtworzenia z oauth-zgoda.png + interfejs-wysylki.png)
- Punkty końcowe: youtube.videos.insert, youtube.channels.list, youtube.videos.list, youtube.thumbnails.set
- Całkowity limit: Brak zmian / domyślny (10 tys.)
- videos.insert: całkowity limit dzienny 3200, szczytowy na minutę 1, uzasadnienie:
  At most 2 uploads per day of my own short videos (videos.insert costs 1600 units each), plus a few channels.list / videos.list calls to read my own channel statistics. The default 10,000 units per day is enough; this request is about lifting the private-only restriction on uploads from an unaudited project, not about a bigger quota.

## Sekcja 6
- Diagram architektury: diagram-architektury.png (opcjonalny)

## Sekcja 7
- Wszystkie 8 checkboxów, potem „Wyślij"

## Status
- 24.09.2026: wniosek wysłany (potwierdzenie „Twój e-mail został wysłany”). Google odpowiada mailem na kczerwinski033@gmail.com, zwykle w ciągu kilku dni roboczych; do decyzji filmy z API wchodzą jako prywatne.
