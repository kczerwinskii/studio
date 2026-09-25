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
  function rozszerz(temat, jezyk = "both") {
    const tekst = String(temat || "").trim().slice(0, 100), klucz = uprosc(tekst);
    const grupa = slownik.find(g => g.klucze.some(k => uprosc(k) === klucz)) || slownik.find(g => [...g.pl,...g.en].some(k=>uprosc(k)===klucz));
    if (!grupa) return { frazy: tekst ? [tekst] : [], przetlumaczone: false };
    return { frazy: [...new Set([...(jezyk !== "en" ? grupa.pl : []), ...(jezyk !== "pl" ? grupa.en : [])])], przetlumaczone: true };
  }
  function jezykOpisu(opis) {
    // Angielskie hashtagi nie czynia opisu angielskim. Oceniaj tresc, nie tagi i adresy.
    const tresc=String(opis||"").replace(/https?:\/\/\S+/g,"").replace(/[#@][\p{L}\p{N}_]+/gu,"");
    const litery=tresc.match(/\p{L}/gu)||[];
    const innePismo=litery.filter(l=>! /\p{Script=Latin}/u.test(l)).length;
    if(litery.length>=12 && innePismo/litery.length>.6)return "inne";
    if(litery.length>=12 && innePismo/litery.length>.25)return null;
    const tekst = " " + uprosc(tresc).replace(/[^a-z ]/g, " ") + " ";
    const slowa = { pl: ["sie", "miesnie", "treningu", "ktory", "twoj", "sylwetki", "cwiczenia", "wiecej", "zeby", "jest", "nie"], en: ["the", "your", "muscle", "growth", "with", "you", "this", "and", "training", "workout", "for"], inne: ["voce", "para", "muscular", "treino", "musculacao", "que", "uma", "como", "los", "las", "ejercicios", "entrenamiento"] };
    const wynik = Object.entries(slowa).map(([jezyk, lista]) => ({ jezyk, punkty: lista.filter(s => tekst.includes(" " + s + " ")).length })).sort((a, b) => b.punkty - a.punkty);
    return wynik[0].punkty >= 3 && wynik[0].punkty > wynik[1].punkty + 1 ? wynik[0].jezyk : null;
  }
  const jestLiczba = w => typeof w === "number" && Number.isFinite(w) && w >= 0;
  function mediana(liczby) { const a = liczby.filter(jestLiczba).sort((a,b) => a-b), n = a.length; return n ? n % 2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2 : null; }
  function porownaj(post, historia) {
    const data = Date.parse(post.data);
    const unikalne = [...new Map(historia.map(p => [p.id, p])).values()];
    // Wyniki popularnego tematu sa probka wybranych hitow, nie historia autora.
    const baza = unikalne.filter(p => p.zrodlo_historii === "profil" && (p.metryka_wyswietlen||"publiczne")===(post.metryka_wyswietlen||"publiczne") && p.id !== post.id && p.username && p.username === post.username && p.typ === "rolka" && jestLiczba(p.wyswietlenia) && Date.parse(p.data) < data).sort((a,b) => Date.parse(b.data)-Date.parse(a.data)).slice(0,20);
    const med = baza.length >= 5 ? mediana(baza.map(p=>p.wyswietlenia)) : null;
    return { mediana_wyswietlen: med, liczba_bazowych: baza.length, krotnosc_przyblizone:!!post.przyblizone||baza.some(p=>p.przyblizone), krotnosc_wyswietlen: med > 0 && jestLiczba(post.wyswietlenia) ? post.wyswietlenia / med : null };
  }
  function filtruj(posty, filtry, teraz = Date.now()) {
    let niepelne = 0, odrzucone = 0;
    const powody={jezyk:0,okres:0,prog:0};
    const wynik = [];
    for (const post of posty) {
      const braki = [], wiek = teraz - Date.parse(post.data);
      if (filtry.jezyk !== "all") {
        if (!post.jezyk) braki.push("język");
        else if (post.jezyk !== "pl" && post.jezyk !== "en" || filtry.jezyk !== "both" && post.jezyk !== filtry.jezyk) { odrzucone++; powody.jezyk++; continue; }
      }
      if (Number(filtry.okres)) {
        if (!Number.isFinite(wiek)) braki.push("data publikacji");
        else if (wiek < 0 || wiek > Number(filtry.okres)*86400000) { odrzucone++; powody.okres++; continue; }
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
  const funkcje = { rozszerz, jezykOpisu, mediana, porownaj, filtruj, uprosc };
  if (typeof module !== "undefined" && module.exports) module.exports = funkcje;
  else korzen.ResearchSilnik = funkcje;
})(typeof window === "undefined" ? globalThis : window);
