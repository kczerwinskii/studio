'use strict';

(function () {
  const BENCHMARK = [[15, 0.660], [30, 0.315], [60, 0.221], [10 ** 9, 0.164]];
  const PRZEDZIALY = [[0, 15, '0-15 s'], [15, 30, '15-30 s'], [30, 60, '30-60 s'], [60, 10 ** 9, '60 s+']];

  function benchmark(dlugosc) {
    for (const [prog, wartosc] of BENCHMARK) {
      if (dlugosc <= prog) return wartosc;
    }
    return BENCHMARK[BENCHMARK.length - 1][1];
  }

  function przedzial(dlugosc) {
    for (const [dol, gora, nazwa] of PRZEDZIALY) {
      if ((dol < dlugosc && dlugosc <= gora) || (dol === 0 && dlugosc <= gora)) return nazwa;
    }
    return '60 s+';
  }

  function mediana(wartosci) {
    const liczby = wartosci.filter(wartosc => wartosc != null).sort((a, b) => a - b);
    const n = liczby.length;
    if (!n) return null;
    const srodek = Math.floor(n / 2);
    return n % 2 ? liczby[srodek] : (liczby[srodek - 1] + liczby[srodek]) / 2;
  }

  function przelicz(rolka) {
    const wynik = { ...rolka };
    wynik.retencja = rolka.czas_ogl && rolka.dlugosc > 0 ? rolka.czas_ogl / rolka.dlugosc : null;
    const wyswietlenia = rolka.wyswietlenia || 1;
    for (const [pole, metryka] of [['zapisy_1k', 'zapisania'], ['udost_1k', 'udostepnienia'], ['obs_1k', 'obserwujacy']]) {
      wynik[pole] = rolka[metryka] == null || rolka.wyswietlenia == null
        ? null : rolka[metryka] * 1000 / wyswietlenia;
    }
    wynik.powtorki = rolka.zasieg && rolka.wyswietlenia != null ? rolka.wyswietlenia / rolka.zasieg : null;
    wynik.wysw_na_obs = rolka.obserwujacy && rolka.wyswietlenia != null ? rolka.wyswietlenia / rolka.obserwujacy : null;
    wynik.indeks = wynik.retencja ? wynik.retencja / benchmark(rolka.dlugosc) : null;
    return wynik;
  }

  function podsumuj(rolki) {
    const wszystkie = rolki.map(przelicz);
    const mediany = zbior => ({
      n: zbior.length,
      med_ret: mediana(zbior.map(rolka => rolka.retencja)),
      med_indeks: mediana(zbior.map(rolka => rolka.indeks))
    });
    const suma = pole => wszystkie.reduce((wynik, rolka) => wynik + (rolka[pole] ?? 0), 0);
    // Jak w Pythonie: wspólny mianownik z całej puli, nie mediana ilorazów.
    const pula = suma('wyswietlenia') || 1;
    const wynik = {
      ...mediany(wszystkie),
      wsk_zapisy: suma('zapisania') * 1000 / pula,
      wsk_obs: wszystkie.some(rolka => rolka.obserwujacy != null) ? suma('obserwujacy') * 1000 / pula : null,
      przedzialy: {}
    };
    for (const [, , nazwa] of PRZEDZIALY) {
      wynik.przedzialy[nazwa] = mediany(wszystkie.filter(rolka => rolka.dlugosc > 0 && przedzial(rolka.dlugosc) === nazwa));
    }
    return wynik;
  }

  function sygnaly(rolka, podsumowanie) {
    const uwagi = [];
    const dodaj = (kod, tekst) => uwagi.push({ kod, tekst });
    if (rolka.retencja == null) {
      return [{ kod: 'brak_czasu', tekst: 'BRAK CZASU OGLĄDANIA, dopisz do czasy.json ze zrzutu tabeli' }];
    }
    if (rolka.retencja >= 1) dodaj('petla', 'PĘTLA, ludzie odtwarzają ponownie, końcówka zadziałała');
    if (podsumowanie.med_indeks) {
      const prog_szum = (1.5 / rolka.dlugosc) / benchmark(rolka.dlugosc);
      const prog = Math.max(podsumowanie.med_indeks * 0.2, prog_szum);
      const delta = rolka.indeks - podsumowanie.med_indeks;
      if (delta < -prog) dodaj('ponizej', `RETENCJA PONIŻEJ TWOJEJ MEDIANY (indeks ${rolka.indeks.toFixed(2)}), poproś o zrzut krzywej z Edits (hook / przejście)`);
      else if (delta > prog) dodaj('powyzej', `RETENCJA POWYŻEJ MEDIANY (indeks ${rolka.indeks.toFixed(2)}), sprawdź, co zadziałało, i powtórz`);
    }
    const ocz_zapisy = podsumowanie.wsk_zapisy * rolka.wyswietlenia / 1000;
    const ocz_obs = podsumowanie.wsk_obs * rolka.wyswietlenia / 1000;
    if (ocz_zapisy >= 3 && rolka.zapisania === 0) dodaj('zero_zapisan', `ZERO ZAPISAŃ przy oczekiwanych ${ocz_zapisy.toFixed(1)}, treść nie była nikomu potrzebna`);
    if (podsumowanie.wsk_obs != null && ocz_obs >= 3 && rolka.obserwujacy === 0) dodaj('zero_obs', `ZASIĘG JEST, ZERO OBSERWUJĄCYCH przy oczekiwanych ${ocz_obs.toFixed(1)}, sprawdź bio i profil, nie rolkę`);
    return uwagi.length ? uwagi : [{ kod: 'norma', tekst: 'w normie' }];
  }

  function pary(rolki) {
    const znalezione = {};
    for (let i = 0; i < rolki.length; i++) {
      const pierwsza = rolki[i];
      for (const druga of rolki.slice(i + 1)) {
        if (!(pierwsza.dlugosc > 0) || !(druga.dlugosc > 0) || Math.abs(pierwsza.dlugosc - druga.dlugosc) > 0.5) continue;
        const data_pierwszej = Date.parse(pierwsza.data);
        const data_drugiej = Date.parse(druga.data);
        if (!Number.isFinite(data_pierwszej) || !Number.isFinite(data_drugiej) || Math.abs(data_pierwszej - data_drugiej) > 300000) continue;
        const [wczesniejsza, pozniejsza] = data_pierwszej <= data_drugiej ? [pierwsza, druga] : [druga, pierwsza];
        znalezione[wczesniejsza.id] = { rola: 'prawdopodobnie próbna', para: pozniejsza.id };
        znalezione[pozniejsza.id] = { rola: 'prawdopodobnie zwykła', para: wczesniejsza.id };
      }
    }
    return znalezione;
  }

  const analiza = { przelicz, podsumuj, sygnaly, pary, benchmark, przedzial, mediana };
  if (typeof module !== 'undefined' && module.exports) module.exports = analiza;
  if (typeof window !== 'undefined') window.Analiza = analiza;
})();
