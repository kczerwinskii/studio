"use strict";
// Czyste funkcje wspolne dla serwera, panelu i testow.
(function (korzen) {
  const slownik = [
    { klucze: ["fitness", "fitnes", "trening siłowy", "strength training", "workout"], pl: ["fitness", "trening siłowy"], en: ["workout", "strength training", "muscle growth"] },
    { klucze: ["budowanie sylwetki", "kształtowanie sylwetki", "sylwetka", "budowa sylwetki", "poprawa sylwetki", "body recomposition", "physique"], pl: ["budowanie sylwetki", "budowanie mięśni", "hipertrofia"], en: ["muscle growth", "hypertrophy", "body recomposition"] },
    { klucze: ["hipertrofia", "hypertrophy", "muscle growth"], pl: ["hipertrofia", "budowanie mięśni"], en: ["hypertrophy", "muscle growth"] },
    { klucze: ["pośladki", "posladki", "glutes"], pl: ["trening pośladków", "budowanie pośladków"], en: ["glute training", "glute growth"] },
    { klucze: ["plecy", "back training"], pl: ["trening pleców"], en: ["back training", "back hypertrophy"] },
    { klucze: ["redukcja", "fat loss"], pl: ["redukcja tkanki tłuszczowej"], en: ["fat loss", "body recomposition"] },
    { klucze: ["plateau", "stagnacja"], pl: ["stagnacja w treningu", "brak efektów treningu"], en: ["muscle growth plateau", "training plateau"] },
    { klucze: ["barki", "shoulders"], pl: ["trening barków"], en: ["shoulder hypertrophy", "shoulder workout"] },
  ];
  function uprosc(tekst) { return String(tekst || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/\s+/g," ").trim(); }
  // Tagi uzywane niemal wylacznie przez polskich tworcow. Slowa jak "hipertrofia" sa wspolne z portugalskim
  // i hiszpanskim, wiec w trybie PL dokladamy tagi, ktore daja polska pule kandydatow. Maksymalnie 6 fraz.
  const polskieTagi = ["siłownia", "trening siłowy", "fitness polska", "budowanie masy"];
  function rozszerz(temat, jezyk = "pl") {
    const tekst = String(temat || "").trim().slice(0, 100), klucz = uprosc(tekst);
    const grupa = slownik.find(g => g.klucze.some(k => uprosc(k) === klucz)) || slownik.find(g => [...g.pl,...g.en].some(k=>uprosc(k)===klucz));
    const wlasne = grupa ? [...new Set([...(jezyk !== "en" ? grupa.pl : []), ...(jezyk !== "pl" ? grupa.en : [])])] : (tekst ? [tekst] : []);
    const frazy = jezyk === "pl" && wlasne.length ? [...new Set([...wlasne.slice(0, 2), ...polskieTagi])].slice(0, 6) : wlasne;
    return { frazy, przetlumaczone: !!grupa, polskie_tagi: jezyk === "pl" && wlasne.length > 0 };
  }
  // Rozpoznawanie jezyka opisu. Wynik: "pl", "en", "inne" albo null (za malo danych).
  // Sygnaly: alfabet (dewanagari, cyrylica itd. = inne), polskie znaki diakrytyczne, slowa funkcyjne 10 jezykow.
  // Angielskie hashtagi nie czynia opisu angielskim: tagi sa usuwane, liczy sie tresc. Polskie znaki w tagach
  // (#siłownia) sa slabym sygnalem PL, bo zaden inny jezyk ich nie uzywa.
  const slowaJezykow = {
    pl: "sie nie jest ktory ktora ktore ktorych jak ale tylko dla jesli jezeli czy moze bedzie byc jeszcze tego tym tej ten od po przy przez bez juz zeby aby bardzo wiecej mniej kazdy kazda kazde swoje swoj swoja twoj twoje twoja moj moje moja mam masz mamy macie byl byla bylo byly oraz albo lub gdy kiedy dlaczego tak nic cos ktos trzeba mozna warto chcesz wiesz robisz zrob zapisz sprawdz tutaj teraz dzis dzisiaj zawsze nigdy wszystko wszystkie wszyscy ile dlatego wtedy potem zanim przed nad pod wsrod bardziej najbardziej nawet takze rowniez wlasnie dobrze zle duzo malo tydzien tygodniu miesiac miesiecy lat trening treningu treningi treningow cwiczenia cwiczenie cwiczen miesnie miesni sylwetka sylwetki posladki posladkow nogi plecy barki klatka brzuch redukcja redukcji masa masy dieta diety sila sily silownia silowni powtorzen serii serie efekty efektow wyniki",
    en: "the and you your this that with for are not but what how why when have has was were will can just more than from they them their about into if my we our all out get one does don doesn isn aren didn here there these those which because every most some any so too very then also should would could been being make makes made need needs want wants like keep going need most only really still while after before over under between through during each both few other same such workout workouts exercise exercises muscles legs glutes gains reps sets weight weights training gym",
    es: "que para los las del una uno con por como pero mas muy este esta esto estos estas ese esa eso tu tus sus son estan hay si ya aqui cuando donde porque todo todos toda todas tambien cada entrenamiento entrenamientos ejercicio ejercicios musculo musculos piernas gluteos rutina rutinas hacer haces puedes quieres sobre sin nos nosotros lo le les al el la en es un se mi mis nunca siempre hoy ahora mejor mejores mucho poco bien mal semana semanas dias fuerza gimnasio cuerpo",
    pt: "voce voces nao sim para com uma um isso esse essa este esta mais muito seu sua seus suas tem estao sao foi ser aqui quando onde porque tudo todos todas tambem cada treino treinos exercicio exercicios musculo musculos musculacao pernas gluteos fazer faz pode quer sobre sem nos ele ela eles elas da das dos na nas meu minha nunca sempre hoje agora melhor melhores bem semana semanas dias forca academia corpo",
    de: "und der die das ist nicht ich du dich dein deine mit fur auf ein eine einen einem auch wenn dann wie oder aber mehr sehr hier jetzt noch sich sind wird werden kann kannst muss musst ubungen ubung muskeln muskelaufbau beine rucken schultern aus bei zu zum zur vom im am nur immer nie heute besser viel wenig woche wochen kraft",
    fr: "les des une est pas pour vous votre vos avec dans sur que qui ce cette ces mais plus tres ici comme quand ou aussi chaque entrainement exercice exercices musculation muscles jambes fessiers faire peut veux sans nous ils elle il le la en du au aux et je tu ne ton ta tes son sa ses notre jamais toujours aujourd maintenant mieux beaucoup peu semaine semaines force salle corps",
    it: "che per con non una uno del della degli delle gli sono questo questa questi anche come quando dove perche tutto tutti ogni allenamento allenamenti esercizio esercizi muscoli gambe glutei fare puoi vuoi senza noi loro nel nella dei ma se il lo la le un di da al ed piu molto qui ora adesso mai sempre oggi meglio poco settimana settimane forza palestra corpo",
    tr: "ve bir bu icin ile gibi daha cok her ne ama veya degil var yok olan olarak antrenman egzersiz kas kaslar bacak kalca yapmak yap sen siz ben biz sizin senin bunu sonra once hem hic hep bugun simdi daha iyi hafta gun vucut spor salonu",
    hi: "hai hain ke ki ko ka nahi nahin aur kya yeh ye woh wo liye karo kare karna karne bhi toh hum tum aap apna apni apne mein par bahut sab kuch koi jab tab kaise kyun kyon sahi galat roz din sirf lekin phir abhi kabhi hamesha",
    id: "yang dan untuk dengan ini itu tidak bisa kamu anda saya kita kalian juga lebih sangat setiap latihan otot kaki cara harus jangan sudah belum akan ada dari ke di pada atau tapi karena jadi agar supaya selalu sekarang hari minggu tubuh",
    nl: "het een niet van voor met jij je jouw ook maar meer zeer hier als dan wordt kan kun moet spieren benen oefening oefeningen dit deze zijn naar bij om op uit over wat hoe waarom nooit altijd vandaag beter veel weinig week weken kracht lichaam",
  };
  const zbioryJezykow = Object.fromEntries(Object.entries(slowaJezykow).map(([j, s]) => [j, new Set(s.split(" "))]));
  // Rdzenie slow w hashtagach, ktore zdradzaja jezyk (#boratreinar, #saudeebemestar, #treningsiłowy). Angielskie tagi sa uniwersalne, nie licza sie.
  const rdzenieTagow = {
    pl: ["trening", "silowni", "cwiczen", "miesni", "sylwetk", "odchudzan", "budowanie", "posladk", "plecy", "barki", "redukcj", "polska", "polski", "zdrowie", "motywacj", "dlaczego", "silowy", "silowa", "masamiesniowa", "przysiad", "martwy"],
    inne: ["treino", "treinar", "saude", "musculacao", "academia", "emagrec", "dicas", "exercicio", "gluteo", "perna", "ganho", "massamuscular", "bemestar", "vidasaudavel", "bora", "calistenia", "resultado", "corpo", "brasil", "entrenamiento", "entrenar", "rutina", "ejercicio", "gimnasio", "musculacion", "salud", "piernas", "ganancia", "masamuscular", "bienestar", "vidasana", "fuerza", "cuerpo", "espana", "mexico", "argentina", "colombia", "krafttraining", "muskelaufbau", "fitnessstudio", "abnehmen", "gesundheit", "ubung", "beine", "rucken", "musculation", "entrainement", "sante", "exercice", "jambes", "fessiers", "prisedemasse", "allenamento", "palestra", "salute", "esercizi", "gambe", "glutei", "massamuscolare", "antrenman", "egzersiz", "sporsalonu", "saglik", "latihan", "olahraga", "kesehatan", "otot", "hipertrofiamuscular", "hipertrofiafeminina", "treinofeminino", "treinodepernas", "treinodegluteo", "musculo"],
  };
  const polskieZnaki = /[ąęłżźćńś]/g, obceMocne = /[ñ¿¡ãõçßüöäıığşřěůőűțșđ]/g, obceSlabe = /[éáíúàèêôâîùûëïœæ]/g;
  function jezykOpisu(opis) {
    const surowy = String(opis || "").replace(/https?:\/\/\S+/g, "");
    const tagi = (surowy.match(/[#@][\p{L}\p{N}_]+/gu) || []).join(" ").toLowerCase();
    const tresc = surowy.replace(/[#@][\p{L}\p{N}_]+/gu, "").toLowerCase();
    const litery = tresc.match(/\p{L}/gu) || [];
    const innePismo = litery.filter(l => !/\p{Script=Latin}/u.test(l)).length;
    if (innePismo >= 3) return "inne";
    const zliczaj = (tekst, wzor) => (tekst.match(wzor) || []).length;
    const plZnaki = Math.min(3, zliczaj(tresc, polskieZnaki)) + Math.min(2, zliczaj(tagi, polskieZnaki));
    const obceZnaki = Math.min(3, zliczaj(tresc, obceMocne) * 2 + zliczaj(tresc, obceSlabe)) + Math.min(2, zliczaj(tagi, obceMocne));
    const slowa = uprosc(tresc).replace(/[^a-z ]/g, " ").split(" ").filter(Boolean);
    const punkty = { pl: plZnaki, en: 0, inne: obceZnaki };
    const trafienia = {};
    for (const slowo of slowa) for (const [jezyk, zbior] of Object.entries(zbioryJezykow)) if (zbior.has(slowo)) trafienia[jezyk] = (trafienia[jezyk] || 0) + 1;
    // Slowa w tagach: polskie i obce tagi sa specyficzne dla jezyka (#siłownia, #treino), angielskie sa uniwersalne.
    const slowaTagow = uprosc(tagi).replace(/[^a-z ]/g, " ").split(" ").filter(Boolean);
    const trafieniaTagow = {};
    for (const slowo of slowaTagow) for (const [jezyk, zbior] of Object.entries(zbioryJezykow)) if (jezyk !== "en" && zbior.has(slowo)) trafieniaTagow[jezyk] = (trafieniaTagow[jezyk] || 0) + 1;
    for (const tag of slowaTagow) for (const [jezyk, rdzenie] of Object.entries(rdzenieTagow)) if (rdzenie.some(rdzen => tag.includes(rdzen))) trafieniaTagow[jezyk] = (trafieniaTagow[jezyk] || 0) + 1;
    punkty.pl += (trafienia.pl || 0) + Math.min(2, trafieniaTagow.pl || 0); punkty.en += trafienia.en || 0;
    punkty.inne += Math.min(2, Math.max(0, ...Object.entries(trafieniaTagow).filter(([j]) => j !== "pl").map(([, n]) => n)));
    punkty.inne += Math.max(0, ...Object.entries(trafienia).filter(([j]) => j !== "pl" && j !== "en").map(([, n]) => n));
    const ranking = Object.entries(punkty).sort((a, b) => b[1] - a[1]);
    return ranking[0][1] >= 2 && ranking[0][1] > ranking[1][1] ? ranking[0][0] : null;
  }
  // Dominujacy jezyk autora na podstawie jego rolek. Minimum 3 rozpoznane opisy i 60% przewagi.
  function jezykAutora(posty) {
    const liczby = { pl: 0, en: 0, inne: 0 };
    for (const p of posty || []) if (p && p.jezyk in liczby && p.jezyk_zrodlo !== "autor") liczby[p.jezyk]++;
    const razem = liczby.pl + liczby.en + liczby.inne;
    const [jezyk, n] = Object.entries(liczby).sort((a, b) => b[1] - a[1])[0];
    return razem >= 3 && n / razem >= 0.6 ? jezyk : null;
  }
  const MIN_BAZA = 8;
  const jestLiczba = w => typeof w === "number" && Number.isFinite(w) && w >= 0;
  function mediana(liczby) { const a = liczby.filter(jestLiczba).sort((a,b) => a-b), n = a.length; return n ? n % 2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2 : null; }
  function porownaj(post, historia) {
    const data = Date.parse(post.data);
    const unikalne = [...new Map(historia.map(p => [p.id, p])).values()];
    // Wyniki popularnego tematu sa probka wybranych hitow, nie historia autora.
    const baza = unikalne.filter(p => p.zrodlo_historii === "profil" && (p.metryka_wyswietlen||"publiczne")===(post.metryka_wyswietlen||"publiczne") && p.id !== post.id && p.username && p.username === post.username && p.typ === "rolka" && jestLiczba(p.wyswietlenia) && Date.parse(p.data) < data).sort((a,b) => Date.parse(b.data)-Date.parse(a.data)).slice(0,20);
    // Minimum 8 wczesniejszych rolek (decyzja Kuby 25.09.2026): mniejsza baza daje przypadkowa mediane.
    const med = baza.length >= MIN_BAZA ? mediana(baza.map(p=>p.wyswietlenia)) : null;
    return { mediana_wyswietlen: med, liczba_bazowych: baza.length, krotnosc_przyblizone:!!post.przyblizone||baza.some(p=>p.przyblizone), krotnosc_wyswietlen: med > 0 && jestLiczba(post.wyswietlenia) ? post.wyswietlenia / med : null };
  }
  function filtruj(posty, filtry, teraz = Date.now()) {
    let niepelne = 0, odrzucone = 0;
    const powody={jezyk:0,okres:0,prog:0,wyswietlenia:0};
    const wynik = [];
    for (const post of posty) {
      const braki = [], wiek = teraz - Date.parse(post.data);
      if (filtry.jezyk !== "all") {
        // Nieznany jezyk nie jest pokazywany nawet z opcja "niepelne": Kuba chce tylko PL/EN, nie zgadujemy.
        if (!post.jezyk) { niepelne++; powody.jezyk++; continue; }
        else if (post.jezyk !== "pl" && post.jezyk !== "en" || filtry.jezyk !== "both" && post.jezyk !== filtry.jezyk) { odrzucone++; powody.jezyk++; continue; }
      }
      if (Number(filtry.okres)) {
        if (!Number.isFinite(wiek)) braki.push("data publikacji");
        else if (wiek < 0 || wiek > Number(filtry.okres)*86400000) { odrzucone++; powody.okres++; continue; }
      }
      // Skala: rolka 3x typowa dla konta z 200 wyswietlen nikogo nie interesuje. Minimum wyswietlen odcina drobnicę.
      if (Number(filtry.min_wyswietlen)) {
        if (!jestLiczba(post.wyswietlenia)) braki.push("wyświetlenia");
        else if (post.wyswietlenia < Number(filtry.min_wyswietlen)) { odrzucone++; powody.wyswietlenia++; continue; }
      }
      if (Number(filtry.prog)) {
        if (!jestLiczba(post.krotnosc_wyswietlen)) braki.push("historia wyświetleń");
        else if (post.krotnosc_wyswietlen < Number(filtry.prog)) { odrzucone++; powody.prog++; continue; }
      }
      if (braki.length) { niepelne++; if (!filtry.niepelne) continue; }
      wynik.push({ ...post, braki_filtrow: braki });
    }
    return { posty: wynik.sort((a,b)=>(b.krotnosc_wyswietlen ?? -1)-(a.krotnosc_wyswietlen ?? -1)), niepelne, odrzucone, powody };
  }
  const funkcje = { rozszerz, jezykOpisu, jezykAutora, mediana, porownaj, filtruj, uprosc, MIN_BAZA };
  if (typeof module !== "undefined" && module.exports) module.exports = funkcje;
  else korzen.ResearchSilnik = funkcje;
})(typeof window === "undefined" ? globalThis : window);
