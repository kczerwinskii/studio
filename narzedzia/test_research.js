"use strict";

// Test offline: prawdziwa probka i transport w pamieci, bez HTTP i danych uzytkownika.
const sprawdz = require("node:assert/strict");
const fs = require("node:fs");
const sciezka = require("node:path");
const { obsluz, mediana, tytulZOpisu, przeliczKonto, normalizujPost } = require("../moduly/research");
const probka = JSON.parse(fs.readFileSync(sciezka.join(__dirname, "probki/business_discovery.json"), "utf8").replace(/^\uFEFF/, ""));
const teraz = Date.parse("2026-09-24T20:00:00Z");
const posty = probka.business_discovery.media.data.map((post) => normalizujPost(post, "karolina.trenuje"));
let ile = 0;
function test(nazwa, dzialanie) {
  try { dzialanie(); ile++; } catch (blad) { blad.message = nazwa + ": " + blad.message; throw blad; }
}

async function uruchom() {
  test("Mediana", () => {
    sprawdz.equal(mediana([]), 0);
    sprawdz.equal(mediana([8, 1, 3]), 3);
    const liczby = [8, 1, 3, 2];
    sprawdz.equal(mediana(liczby), 2.5);
    sprawdz.deepEqual(liczby, [8, 1, 3, 2]);
  });
  test("Tytuł i Unicode", () => {
    sprawdz.equal(tytulZOpisu("  Pierwsza linia  \r\nDruga"), "Pierwsza linia");
    sprawdz.equal(tytulZOpisu(null), "");
    sprawdz.equal(Array.from(tytulZOpisu("💪".repeat(100))).length, 80);
  });
  test("Próbka: mediana, krotność, progi, typy, świeżość", () => {
    const wynik = przeliczKonto(posty, 3, teraz);
    sprawdz.equal(wynik.length, 25);
    sprawdz.equal(wynik.filter((post) => post.typ === "rolka").length, 20);
    sprawdz.equal(wynik[0].mediana_konta, 334.5);
    sprawdz.equal(wynik[0].zaangazowanie, 33);
    sprawdz.equal(wynik[0].krotnosc, 33 / 334.5);
    sprawdz.equal(wynik[0].swiezy, true);
    sprawdz.equal(wynik.at(-1).swiezy, false);
    sprawdz.deepEqual(wynik.filter((post) => post.odstajacy).map((post) => post.id).sort(),
      ["18075707525409797", "18106001281933864", "17987795408859749", "18629760700052337"].sort());
    sprawdz.equal(przeliczKonto(posty, 4, teraz).filter((post) => post.odstajacy).length, 2);
    sprawdz.equal(wynik[0].bez_polubien, false);
    sprawdz.equal(posty[0].krotnosc, undefined);
  });
  test("Null i brak polubień", () => {
    const surowy = { ...probka.business_discovery.media.data[0], like_count: null, comments_count: 12 };
    const post = normalizujPost(surowy, "test");
    const wynik = przeliczKonto([post], 3, teraz)[0];
    sprawdz.equal(post.polubienia, null);
    sprawdz.equal(wynik.bez_polubien, true);
    sprawdz.equal(wynik.zaangazowanie, 12);
    sprawdz.equal(wynik.krotnosc, 1);
    delete surowy.like_count;
    sprawdz.equal(normalizujPost(surowy, "test").polubienia, null);
  });
  const zrobPost = (polubienia, typ = "rolka", data = "2026-09-24T19:00:00Z") => ({ id: String(polubienia), polubienia, komentarze: 0, typ, data });
  test("Mniej niż pięć rolek, dokładny próg", () => {
    const wynik = przeliczKonto([zrobPost(10), zrobPost(20), zrobPost(60, "post")], 3, teraz);
    sprawdz.equal(wynik[0].mediana_konta, 20);
    sprawdz.equal(wynik[2].krotnosc, 3);
    sprawdz.equal(wynik[2].odstajacy, true);
    sprawdz.equal(przeliczKonto([10, 10, 10, 10, 10].map((liczba) => zrobPost(liczba)).concat(zrobPost(1000, "post")))[0].mediana_konta, 10);
  });
  test("Zero mediany, pusta lista i granice świeżości", () => {
    sprawdz.deepEqual(przeliczKonto([]), []);
    const wynik = przeliczKonto([zrobPost(0), zrobPost(0), zrobPost(8)]);
    sprawdz.equal(wynik[2].krotnosc, null);
    sprawdz.equal(wynik[2].odstajacy, false);
    sprawdz.deepEqual(JSON.parse(JSON.stringify(wynik)), wynik);
    const daty = [teraz - 14 * 86400000, teraz - 14 * 86400000 + 1, teraz + 1];
    sprawdz.deepEqual(przeliczKonto(daty.map((czas) => zrobPost(1, "rolka", new Date(czas).toISOString())), 3, teraz).map((post) => post.swiezy), [false, true, false]);
    sprawdz.equal(przeliczKonto([zrobPost(1, "rolka", "błąd")], 3, teraz)[0].swiezy, false);
  });

  const pliki = new Map();
  const wywolania = [];
  let transport = async () => structuredClone(probka);
  const narzedzia = {
    sciezki: { dane: "pamiec" },
    czytajJson: (plik, domyslne) => structuredClone(pliki.has(plik) ? pliki.get(plik) : domyslne),
    zapiszJson: (plik, dane) => pliki.set(plik, structuredClone(dane)),
    czytajCialo: async (zadanie) => zadanie.cialo,
    odpowiedzJson: (odpowiedz, kod, dane) => Object.assign(odpowiedz, { kod, dane: structuredClone(dane) }),
    token: () => "atrapa-sekretu", ustawienia: () => ({ ig_id: "konto-testowe" }),
    graph: async (adres, parametry, token) => {
      wywolania.push({ adres, parametry, token, czas: Date.now() });
      return transport(adres, parametry, token);
    },
  };
  async function wywolaj(metoda, adres = "", cialo) {
    const odpowiedz = {};
    sprawdz.equal(await obsluz({ method: metoda, cialo }, odpowiedz, new URL("http://lokalnie/api/research" + adres), narzedzia), true);
    return odpowiedz;
  }
  sprawdz.equal(await obsluz({ method: "GET" }, {}, new URL("http://lokalnie/api/research-obce"), narzedzia), false);
  sprawdz.equal((await wywolaj("GET")).dane.ustawienia.prog, 3);
  sprawdz.equal((await wywolaj("POST", "/konto", { username: "bad){fields}" })).kod, 400);
  sprawdz.equal((await wywolaj("POST", "/konto", { username: "__proto__" })).kod, 400);
  sprawdz.equal(wywolania.length, 0);
  sprawdz.equal((await wywolaj("POST", "/konto", { username: " @Karolina.Trenuje " })).kod, 200);
  sprawdz.equal(wywolania[0].adres, "/konto-testowe");
  sprawdz.match(wywolania[0].parametry.fields, /business_discovery.username\(karolina.trenuje\).*media.limit\(50\)/);
  sprawdz.equal((await wywolaj("GET")).dane.posty["karolina.trenuje"].length, 25);
  sprawdz.equal((await wywolaj("POST", "/konto", { username: "KAROLINA.TRENUJE" })).kod, 409);
  sprawdz.equal((await wywolaj("POST", "/prog", { prog: 4 })).kod, 200);
  sprawdz.equal((await wywolaj("GET")).dane.posty["karolina.trenuje"].filter((post) => post.odstajacy).length, 2);
  for (const prog of [null, "3", 0, -1, Infinity]) sprawdz.equal((await wywolaj("POST", "/prog", { prog })).kod, 400);
  sprawdz.equal((await wywolaj("POST", "/notatka", { id: posty[0].id, tekst: "Mój kąt na rolkę" })).kod, 200);
  sprawdz.equal((await wywolaj("GET")).dane.notatki[posty[0].id], "Mój kąt na rolkę");
  sprawdz.equal((await wywolaj("POST", "/notatka", { id: "nieznany", tekst: "" })).kod, 404);
  ile++;

  // Wstrzymany transport pozwala sprawdzic blokady i zapis progu podczas pobierania.
  let zakoncz;
  transport = () => new Promise((gotowe) => { zakoncz = gotowe; });
  sprawdz.equal((await wywolaj("POST", "/pobierz", {})).kod, 202);
  sprawdz.equal((await wywolaj("GET", "/postep")).dane.w_toku, true);
  sprawdz.equal((await wywolaj("POST", "/pobierz", {})).kod, 409);
  sprawdz.equal((await wywolaj("DELETE", "/konto?username=karolina.trenuje")).kod, 409);
  sprawdz.equal((await wywolaj("POST", "/konto", { username: "inne" })).kod, 409);
  await wywolaj("POST", "/prog", { prog: 2.5 });
  const zmieniona = structuredClone(probka);
  zmieniona.business_discovery.media.data = [
    { ...probka.business_discovery.media.data[0], like_count: 999 },
    { ...probka.business_discovery.media.data[0], id: "nowy-post" },
  ];
  zakoncz(zmieniona);
  async function poczekaj() {
    for (let proba = 0; proba < 200; proba++) {
      if (!(await wywolaj("GET", "/postep")).dane.w_toku) return;
      await new Promise((gotowe) => setTimeout(gotowe, 10));
    }
    throw new Error("Pobieranie nie zakończyło się");
  }
  await poczekaj();
  const polaczone = (await wywolaj("GET")).dane;
  sprawdz.equal(polaczone.ustawienia.prog, 2.5);
  sprawdz.equal(polaczone.posty["karolina.trenuje"].length, 26);
  sprawdz.equal(polaczone.posty["karolina.trenuje"].find((post) => post.id === posty[0].id).polubienia, 999);
  sprawdz.ok(polaczone.konta[0].ostatnie_pobranie);
  ile++;

  transport = async () => { throw Object.assign(new Error("(#110) konto prywatne"), { kod: 110 }); };
  await wywolaj("POST", "/konto", { username: "prywatne" });
  sprawdz.match((await wywolaj("GET")).dane.konta[1].blad, /Business Discovery/);
  const poczatek = wywolania.length;
  transport = async (adres, parametry) => {
    if (parametry.fields.includes("(karolina.trenuje)")) throw new Error("adres z tokenem atrapa-sekretu");
    return structuredClone(probka);
  };
  await wywolaj("POST", "/pobierz", {});
  await poczekaj();
  const wynik = (await wywolaj("GET")).dane;
  sprawdz.equal(wywolania.length - poczatek, 2);
  sprawdz.ok(wywolania[poczatek + 1].czas - wywolania[poczatek].czas >= 390, "Odstęp między kontami");
  sprawdz.equal(wynik.posty["karolina.trenuje"].length, 26);
  sprawdz.equal(wynik.konta[0].ostatnie_pobranie, polaczone.konta[0].ostatnie_pobranie);
  sprawdz.equal(wynik.konta[1].blad, null);
  sprawdz.equal(wynik.posty.prywatne.length, 25);
  sprawdz.ok(!JSON.stringify(wynik).includes("atrapa-sekretu"));
  const postep = (await wywolaj("GET", "/postep")).dane;
  sprawdz.equal(postep.zrobione, 2);
  sprawdz.equal(postep.w_toku, false);
  sprawdz.ok(postep.blad);
  await wywolaj("DELETE", "/konto?username=prywatne");
  sprawdz.equal((await wywolaj("GET")).dane.konta.length, 1);
  sprawdz.equal((await wywolaj("GET")).dane.posty.prywatne, undefined);
  ile++;
  console.log("OK: " + ile + " grup testów Research (próbka, obliczenia i trasy offline).");
}

uruchom().catch((blad) => { console.error("RÓŻNICA: " + blad.message); process.exitCode = 1; });
