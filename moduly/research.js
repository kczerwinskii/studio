"use strict";

const sciezka = require("path");
const postep = { w_toku: false, zrobione: 0, razem: 0, konto: null, blad: null };
const czekaj = (ms) => new Promise((gotowe) => setTimeout(gotowe, ms));
const liczba = (wartosc) => Number.isFinite(wartosc) && wartosc >= 0 ? wartosc : 0;

function mediana(wartosci) {
  const liczby = wartosci.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const srodek = Math.floor(liczby.length / 2);
  return !liczby.length ? 0 : liczby.length % 2 ? liczby[srodek] : (liczby[srodek - 1] + liczby[srodek]) / 2;
}

function tytulZOpisu(opis) {
  return Array.from(String(opis || "").split(/\r?\n/)[0].trim()).slice(0, 80).join("");
}

function normalizujPost(post, username) {
  const opis = typeof post.caption === "string" ? post.caption : "";
  return {
    id: String(post.id), username, data: post.timestamp || null,
    tytul: tytulZOpisu(opis), opis,
    typ: post.media_product_type === "REELS" ? "rolka" : post.media_type === "CAROUSEL_ALBUM" ? "karuzela" : "post",
    polubienia: post.like_count == null ? null : liczba(post.like_count),
    komentarze: liczba(post.comments_count), permalink: post.permalink || "", miniatura: post.thumbnail_url || "",
  };
}

// Przy zerowej medianie nie da sie wyznaczyc krotności. Null pozostaje poprawny w JSON.
function przeliczKonto(posty, prog = 3, teraz = Date.now()) {
  const policzone = posty.map((post) => ({
    ...post, bez_polubien: post.polubienia == null,
    zaangazowanie: liczba(post.polubienia) + liczba(post.komentarze),
  }));
  const rolki = policzone.filter((post) => post.typ === "rolka");
  const podstawa = rolki.length >= 5 ? rolki : policzone;
  const mediana_konta = mediana(podstawa.map((post) => post.zaangazowanie));
  return policzone.map((post) => {
    const krotnosc = mediana_konta > 0 ? post.zaangazowanie / mediana_konta : null;
    const wiek = Number(teraz) - Date.parse(post.data);
    return { ...post, mediana_konta, krotnosc, odstajacy: krotnosc !== null && krotnosc >= prog,
      swiezy: Number.isFinite(wiek) && wiek >= 0 && wiek < 14 * 86400000 };
  });
}

const plikDanych = (narzedzia) => sciezka.join(narzedzia.sciezki.dane, "research.json");
const plikNotatek = (narzedzia) => sciezka.join(narzedzia.sciezki.dane, "research_notatki.json");
function wczytaj(narzedzia) {
  const dane = narzedzia.czytajJson(plikDanych(narzedzia), { konta: [], posty: {}, ustawienia: { prog: 3 } });
  dane.ustawienia = { prog: 3, ...dane.ustawienia };
  return dane;
}
function nazwaKonta(wartosc) {
  const nazwa = typeof wartosc === "string" ? wartosc.trim().replace(/^@/, "").toLowerCase() : "";
  if (!/^[a-z0-9_][a-z0-9_.]{0,29}$/.test(nazwa) || nazwa === "__proto__") return null;
  return nazwa;
}

function bladPobierania(blad) {
  const kod = Number(blad.kod || blad.code);
  if ([100, 110].includes(kod) || /\(#(?:100|110)\)/.test(blad.message || "")) {
    return "Konto niedostępne w Business Discovery. Sprawdź nazwę i czy konto jest publiczne oraz profesjonalne.";
  }
  // Nie przekazujemy surowego bledu transportu: moze zawierac URL z tokenem.
  return "Nie udało się pobrać konta. Sprawdź połączenie, token i uprawnienia w Ustawieniach.";
}

async function pobierzKonto(narzedzia, username) {
  let odkryte;
  let blad = null;
  try {
    const token = narzedzia.token();
    const ustawienia = narzedzia.ustawienia();
    if (!token || !ustawienia.ig_id) {
      blad = "Uzupełnij token i konto Instagram w Ustawieniach.";
    } else {
      const wynik = await narzedzia.graph("/" + ustawienia.ig_id, {
        fields: `business_discovery.username(${username}){id,username,name,followers_count,media_count,profile_picture_url,media.limit(50){id,caption,media_product_type,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url}}`,
      }, token);
      if (wynik.error) throw Object.assign(new Error(wynik.error.message), { kod: wynik.error.code });
      odkryte = wynik.business_discovery;
      if (!odkryte || !odkryte.media || !Array.isArray(odkryte.media.data)) throw new Error("Niepełna odpowiedź");
    }
  } catch (wyjatek) { blad = bladPobierania(wyjatek); }
  // Ponowny odczyt zachowuje zmiany progu wykonane podczas oczekiwania na API.
  const dane = wczytaj(narzedzia);
  const konto = dane.konta.find((konto) => konto.username === username);
  if (!konto) return;
  konto.blad = blad;
  if (!blad) {
    Object.assign(konto, { nazwa: odkryte.name || username, obserwujacy: odkryte.followers_count ?? null,
      media_count: odkryte.media_count ?? null, avatar: odkryte.profile_picture_url || "",
      ostatnie_pobranie: new Date().toISOString() });
    const posty = new Map((Object.hasOwn(dane.posty, username) ? dane.posty[username] : []).map((post) => [post.id, post]));
    for (const post of odkryte.media.data.slice(0, 50)) {
      if (post.id != null) posty.set(String(post.id), normalizujPost(post, username));
    }
    Object.defineProperty(dane.posty, username, { value: [...posty.values()], enumerable: true, configurable: true, writable: true });
  }
  narzedzia.zapiszJson(plikDanych(narzedzia), dane);
  if (blad) postep.blad = blad;
}

async function pobierzWszystkie(narzedzia, konta) {
  try {
    for (let indeks = 0; indeks < konta.length; indeks++) {
      if (indeks) await czekaj(400);
      postep.konto = konta[indeks];
      await pobierzKonto(narzedzia, konta[indeks]);
      postep.zrobione++;
    }
  } catch { postep.blad = "Nie udało się zapisać danych Research."; }
  finally { postep.w_toku = false; postep.konto = null; }
}

async function obsluz(zadanie, odpowiedz, url, narzedzia) {
  if (await require("./research-odkrywanie").obsluzOdkrywanie(zadanie, odpowiedz, url, narzedzia)) return true;
  const adres = url.pathname;
  if (adres !== "/api/research" && !adres.startsWith("/api/research/")) return false;
  const wyslij = (kod, dane) => { narzedzia.odpowiedzJson(odpowiedz, kod, dane); return true; };
  try {
    if (zadanie.method === "GET" && adres === "/api/research/postep") return wyslij(200, { ...postep });
    if (zadanie.method === "GET" && adres === "/api/research") {
      const dane = wczytaj(narzedzia);
      const posty = Object.fromEntries(dane.konta.map((konto) => [konto.username,
        przeliczKonto(Object.hasOwn(dane.posty, konto.username) ? dane.posty[konto.username] : [], dane.ustawienia.prog)]));
      return wyslij(200, { ...dane, posty, notatki: narzedzia.czytajJson(plikNotatek(narzedzia), {}) });
    }
    if (["POST", "DELETE"].includes(zadanie.method) && adres === "/api/research/konto") {
      const cialo = zadanie.method === "POST" ? await narzedzia.czytajCialo(zadanie) : {};
      const username = nazwaKonta(zadanie.method === "POST" ? cialo?.username : url.searchParams.get("username"));
      if (!username) return wyslij(400, { blad: "Podaj poprawną nazwę konta Instagram." });
      if (postep.w_toku) return wyslij(409, { blad: "Poczekaj na zakończenie pobierania." });
      const dane = wczytaj(narzedzia);
      if (zadanie.method === "DELETE") {
        dane.konta = dane.konta.filter((konto) => konto.username !== username);
        delete dane.posty[username];
        narzedzia.zapiszJson(plikDanych(narzedzia), dane);
        return wyslij(200, { ok: true });
      }
      if (dane.konta.some((konto) => konto.username === username)) return wyslij(409, { blad: "To konto jest już na liście." });
      dane.konta.push({ username, nazwa: username, obserwujacy: null, media_count: null, avatar: "",
        dodano: new Date().toISOString(), ostatnie_pobranie: null, blad: null });
      narzedzia.zapiszJson(plikDanych(narzedzia), dane);
      Object.assign(postep, { w_toku: true, zrobione: 0, razem: 1, konto: username, blad: null });
      await pobierzWszystkie(narzedzia, [username]);
      return wyslij(200, { ok: true, blad: postep.blad });
    }
    if (zadanie.method === "POST" && adres === "/api/research/pobierz") {
      if (postep.w_toku) return wyslij(409, { blad: "Pobieranie już trwa." });
      const konta = wczytaj(narzedzia).konta.map((konto) => konto.username);
      Object.assign(postep, { w_toku: true, zrobione: 0, razem: konta.length, konto: null, blad: null });
      void pobierzWszystkie(narzedzia, konta);
      return wyslij(202, { ok: true });
    }
    if (zadanie.method === "POST" && adres === "/api/research/prog") {
      const cialo = await narzedzia.czytajCialo(zadanie);
      if (typeof cialo?.prog !== "number" || !Number.isFinite(cialo.prog) || cialo.prog <= 0) return wyslij(400, { blad: "Próg musi być liczbą większą od zera." });
      const dane = wczytaj(narzedzia);
      dane.ustawienia.prog = cialo.prog;
      narzedzia.zapiszJson(plikDanych(narzedzia), dane);
      return wyslij(200, { ok: true });
    }
    if (zadanie.method === "POST" && adres === "/api/research/notatka") {
      const cialo = await narzedzia.czytajCialo(zadanie);
      if (typeof cialo?.id !== "string" || typeof cialo.tekst !== "string" || cialo.tekst.length > 50000) return wyslij(400, { blad: "Niepoprawna notatka." });
      if (!Object.values(wczytaj(narzedzia).posty).some((posty) => posty.some((post) => post.id === cialo.id))) return wyslij(404, { blad: "Nie ma takiego posta." });
      const notatki = narzedzia.czytajJson(plikNotatek(narzedzia), {});
      Object.defineProperty(notatki, cialo.id, { value: cialo.tekst, enumerable: true, configurable: true, writable: true });
      narzedzia.zapiszJson(plikNotatek(narzedzia), notatki);
      return wyslij(200, { ok: true });
    }
    return wyslij(404, { blad: "Nie ma takiego adresu Research." });
  } catch (blad) {
    return wyslij(blad instanceof SyntaxError ? 400 : 500, { blad: blad instanceof SyntaxError ? "Niepoprawne dane JSON." : "Nie udało się obsłużyć żądania Research." });
  }
}

module.exports = { obsluz, przeliczKonto, mediana, tytulZOpisu, normalizujPost };
