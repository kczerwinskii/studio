"use strict";

const fs = require("fs");
const sciezka = require("path");
const https = require("https");
const kryptografia = require("crypto");
const sesje = new Map();
const ZAKRES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
const PONOWNE_LOGOWANIE = "YouTube wylogował aplikację, połącz ponownie w Ustawieniach";
const plikTokenu = (n) => sciezka.join(n.sciezki.config, "youtube_token.json");
const klient = (n) => n.czytajJson(sciezka.join(n.sciezki.config, "youtube_klient.json"), {}) || {};
const tokeny = (n) => n.czytajJson(plikTokenu(n), {}) || {};

function sesja(n) {
  const klucz = sciezka.resolve(n.sciezki.config);
  if (!sesje.has(klucz)) sesje.set(klucz, { proba: null, pokolenie: 0, odswiezanie: null, blad: null });
  return sesje.get(klucz);
}

function daneKanalu(kanal) {
  const liczba = (wartosc) => wartosc == null || !Number.isFinite(Number(wartosc)) ? null : Number(wartosc);
  return { id: kanal.id, tytul: kanal.snippet?.title || "YouTube", miniatura: kanal.snippet?.thumbnails?.default?.url || "",
    subskrybenci: kanal.statistics?.hiddenSubscriberCount ? null : liczba(kanal.statistics?.subscriberCount),
    filmy: liczba(kanal.statistics?.videoCount), wyswietlenia: liczba(kanal.statistics?.viewCount) };
}

async function odswiezStatystyki(n) {
  const s = sesja(n), zapisane = tokeny(n);
  if (s.statystyki) return s.statystyki;
  const ostatnio = Math.max(s.statystykiCzas || 0, zapisane.statystyki_czas || 0);
  if (!zapisane.refresh_token || Date.now() - ostatnio < 10 * 60000) return;
  const pokolenie = s.pokolenie;
  s.statystykiCzas = Date.now();
  n.zapiszJson(plikTokenu(n), { ...zapisane, statystyki_czas: s.statystykiCzas });
  s.statystyki = (async () => {
    try {
      const token = await aktualnyToken(n);
      const dane = sprawdzGoogle(await zadanieGoogle("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", "GET", { Authorization: "Bearer " + token }));
      const kanal = dane.items?.find((k) => k.id === zapisane.kanal?.id);
      if (kanal && pokolenie === s.pokolenie && tokeny(n).refresh_token)
        n.zapiszJson(plikTokenu(n), { ...tokeny(n), kanal: daneKanalu(kanal) });
    } catch { /* Zachowaj ostatnie statystyki i ogranicz kolejne proby do 10 minut. */ }
  })();
  try { await s.statystyki; } finally { s.statystyki = null; }
}

function bladJawny(tekst, kod = 400) {
  return Object.assign(new Error(tekst), { jawny: true, kod });
}

// Surowa odpowiedz Google i bledy transportu nigdy nie trafiaja do UI ani logow.
function tlumaczBlad(kod, dane = {}) {
  if (kod === 401 || ["invalid_grant", "invalid_token"].includes(dane.error)) return PONOWNE_LOGOWANIE;
  const powody = (dane.error?.errors || []).map((wpis) => wpis.reason);
  if (kod === 403 && powody.some((powod) => ["quotaExceeded", "dailyLimitExceeded", "dailyLimitExceededUnreg"].includes(powod))) {
    return "limit dzienny YouTube wyczerpany, spróbuj jutro";
  }
  if (kod === 403) return "YouTube odmówił dostępu. Sprawdź uprawnienia aplikacji i kanału.";
  if (kod === 429) return "Zbyt wiele żądań do YouTube, spróbuj później.";
  return "YouTube nie przyjął żądania (HTTP " + kod + ").";
}

function sprawdzGoogle(wynik) {
  if (wynik.kod >= 200 && wynik.kod < 300) return wynik.dane;
  throw bladJawny(tlumaczBlad(wynik.kod, wynik.dane), wynik.kod);
}

function bezpiecznyAdres(adres) {
  const url = new URL(adres);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !(url.hostname === "googleapis.com" || url.hostname.endsWith(".googleapis.com"))) {
    throw bladJawny("YouTube zwrócił nieprawidłowy adres wysyłki.");
  }
  return url;
}

// Jedna odpowiedz ma limit 1 MB; plik jest czytany strumieniem z uwzglednieniem offsetu.
function zadanieGoogle(adres, metoda, naglowki = {}, cialo = "", plik = null, poczatek = 0, rozmiar = 0) {
  const url = bezpiecznyAdres(adres);
  return new Promise((gotowe, odrzuc) => {
    let strumien;
    let zakonczone = false;
    let zegar;
    const zakoncz = (blad, wynik) => {
      if (zakonczone) return;
      zakonczone = true;
      clearTimeout(zegar);
      if (strumien) strumien.destroy();
      if (blad) { zadanie.destroy(); odrzuc(blad); } else gotowe(wynik);
    };
    const bladSieci = () => zakoncz(Object.assign(bladJawny("Przerwano połączenie z YouTube.", 502), { wznow: true }));
    const zadanie = https.request(url, { method: metoda, headers: naglowki }, (odpowiedz) => {
      const kawalki = [];
      let bajty = 0;
      odpowiedz.on("data", (kawalek) => {
        bajty += kawalek.length;
        if (bajty > 1024 * 1024) {
          zakoncz(bladJawny("Zbyt duża odpowiedź YouTube.", 502));
          odpowiedz.destroy();
        } else kawalki.push(kawalek);
      });
      odpowiedz.on("error", bladSieci);
      odpowiedz.on("aborted", bladSieci);
      odpowiedz.on("end", () => {
        let dane = {};
        const tekst = Buffer.concat(kawalki).toString("utf8");
        try { if (tekst) dane = JSON.parse(tekst); } catch { /* Kod HTTP nadal okresla blad. */ }
        zakoncz(null, { kod: odpowiedz.statusCode, naglowki: odpowiedz.headers, dane });
      });
    });
    zadanie.on("error", bladSieci);
    zadanie.setTimeout(60000, bladSieci);
    zegar = setTimeout(bladSieci, plik ? 30 * 60 * 1000 : 90000);
    if (plik) {
      strumien = fs.createReadStream(plik, { start: poczatek, end: rozmiar - 1 });
      strumien.on("error", () => zakoncz(bladJawny("Nie udało się odczytać pliku wideo.", 500)));
      strumien.pipe(zadanie);
    } else zadanie.end(cialo);
  });
}

async function wymienToken(pola) {
  const cialo = new URLSearchParams(pola).toString();
  const dane = sprawdzGoogle(await zadanieGoogle("https://oauth2.googleapis.com/token", "POST", {
    "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(cialo),
  }, cialo));
  if (!dane.access_token || !Number.isFinite(Number(dane.expires_in)) || Number(dane.expires_in) <= 0) {
    throw bladJawny("YouTube nie zwrócił poprawnego tokena.", 502);
  }
  return { access_token: dane.access_token, refresh_token: dane.refresh_token,
    wygasa: new Date(Date.now() + Number(dane.expires_in) * 1000).toISOString() };
}

function budujOAuth(n) {
  const daneKlienta = klient(n);
  if (!daneKlienta.client_id || !daneKlienta.client_secret) throw bladJawny("Uzupełnij klienta OAuth YouTube w Ustawieniach.");
  const port = Number(n.port());
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw bladJawny("Serwer Studio nie ma poprawnego portu.", 500);
  const stan = sesja(n);
  const proba = { state: kryptografia.randomBytes(32).toString("hex"), wygasa: Date.now() + 10 * 60000,
    przekierowanie: "http://127.0.0.1:" + port + "/api/youtube/callback", klient: daneKlienta };
  stan.proba = proba;
  stan.pokolenie++;
  stan.blad = null;
  const adres = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  adres.search = new URLSearchParams({ client_id: daneKlienta.client_id, redirect_uri: proba.przekierowanie,
    response_type: "code", access_type: "offline", prompt: "consent", scope: ZAKRES, state: proba.state }).toString();
  return adres.href;
}

async function aktualnyToken(n) {
  const stan = sesja(n);
  const zapisane = tokeny(n);
  if (!zapisane.refresh_token) throw bladJawny(PONOWNE_LOGOWANIE, 401);
  if (zapisane.access_token && Date.parse(zapisane.wygasa) - Date.now() >= 120000) return zapisane.access_token;
  if (stan.odswiezanie) return stan.odswiezanie;
  const pokolenie = stan.pokolenie;
  const daneKlienta = klient(n);
  if (!daneKlienta.client_id || !daneKlienta.client_secret) throw bladJawny("Uzupełnij klienta OAuth YouTube w Ustawieniach.");
  const obietnica = (async () => {
    const nowe = await wymienToken({ client_id: daneKlienta.client_id, client_secret: daneKlienta.client_secret,
      grant_type: "refresh_token", refresh_token: zapisane.refresh_token });
    if (pokolenie !== stan.pokolenie) throw bladJawny("Połączenie YouTube zostało zmienione. Spróbuj ponownie.", 409);
    n.zapiszJson(plikTokenu(n), { ...zapisane, ...nowe, refresh_token: nowe.refresh_token || zapisane.refresh_token });
    stan.blad = null;
    return nowe.access_token;
  })();
  stan.odswiezanie = obietnica;
  try { return await obietnica; }
  catch (blad) { if (pokolenie === stan.pokolenie) stan.blad = blad.jawny ? blad.message : "Nie udało się odświeżyć połączenia YouTube."; throw blad; }
  finally { if (stan.odswiezanie === obietnica) stan.odswiezanie = null; }
}

function zlozFilm(pozycja) {
  const opis = typeof pozycja.opis === "string" ? pozycja.opis : "";
  const tytul = String(pozycja.youtube_tytul || opis.split(/\r?\n/)[0]).trim();
  return { snippet: { title: Array.from(tytul).slice(0, 100).join(""), description: opis, categoryId: "17",
    tags: Array.isArray(pozycja.youtube_tagi) ? pozycja.youtube_tagi.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim()) : [] },
  status: { privacyStatus: ["private", "unlisted", "public"].includes(pozycja.youtube_prywatnosc) ? pozycja.youtube_prywatnosc : "private",
    selfDeclaredMadeForKids: false } };
}

async function opublikujNaYouTube(n, pozycja, ustawStatus = () => {}) {
  const film = zlozFilm(pozycja);
  if (!film.snippet.title) throw bladJawny("Wpisz tytuł YouTube lub pierwszą linię opisu.");
  let rozmiar;
  try {
    const info = fs.statSync(pozycja.plik);
    if (!info.isFile() || !info.size) throw new Error();
    rozmiar = info.size;
  } catch { throw bladJawny("Nie ma poprawnego pliku wideo do wysłania."); }
  const stan = sesja(n);
  const pokolenie = stan.pokolenie;
  const autoryzacja = async () => {
    if (pokolenie !== stan.pokolenie) throw bladJawny("Połączenie YouTube zostało zmienione. Sprawdź film w YouTube Studio.", 409);
    return "Bearer " + await aktualnyToken(n);
  };
  ustawStatus("youtube", "YouTube: zaczynam wysyłkę");
  const cialo = JSON.stringify(film);
  const poczatek = await zadanieGoogle("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", "POST", {
    Authorization: await autoryzacja(), "Content-Type": "application/json; charset=UTF-8", "Content-Length": Buffer.byteLength(cialo),
    "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(rozmiar),
  }, cialo);
  sprawdzGoogle(poczatek);
  if (!poczatek.naglowki.location) throw bladJawny("YouTube nie otworzył sesji wysyłki.", 502);
  const adres = bezpiecznyAdres(poczatek.naglowki.location).href;
  const wyslij = async (offset) => zadanieGoogle(adres, "PUT", {
    Authorization: await autoryzacja(), "Content-Type": "video/mp4", "Content-Length": String(rozmiar - offset),
    "Content-Range": "bytes " + offset + "-" + (rozmiar - 1) + "/" + rozmiar,
  }, "", pozycja.plik, offset, rozmiar);
  ustawStatus("youtube", "YouTube: wysyłam plik");
  let wynik;
  try { wynik = await wyslij(0); }
  catch (blad) { if (!blad.wznow) throw blad; }
  if (!wynik || wynik.kod === 308 || wynik.kod >= 500) {
    ustawStatus("youtube", "YouTube: sprawdzam i wznawiam wysyłkę");
    wynik = await zadanieGoogle(adres, "PUT", { Authorization: await autoryzacja(),
      "Content-Length": "0", "Content-Range": "bytes */" + rozmiar });
    if (wynik.kod === 308) {
      const zakres = wynik.naglowki.range;
      const dopasowanie = zakres && /^bytes=0-(\d+)$/i.exec(zakres);
      if (zakres && !dopasowanie) throw bladJawny("YouTube zwrócił nieprawidłowy zakres wysyłki.", 502);
      const offset = dopasowanie ? Number(dopasowanie[1]) + 1 : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= rozmiar) throw bladJawny("Niepewny wynik wysyłki. Sprawdź film w YouTube Studio.", 502);
      wynik = await wyslij(offset);
    }
  }
  if (wynik.kod === 308 || wynik.kod >= 500) throw bladJawny("Nie ukończono wysyłki. Sprawdź film w YouTube Studio przed ponowieniem.", 502);
  const dane = sprawdzGoogle(wynik);
  if (typeof dane.id !== "string" || !/^[\w-]+$/.test(dane.id)) throw bladJawny("YouTube nie potwierdził filmu. Sprawdź YouTube Studio przed ponowieniem.", 502);
  return { video_id: dane.id, link: "https://youtube.com/shorts/" + dane.id,
    prywatnosc: ["private", "unlisted", "public"].includes(dane.status?.privacyStatus) ? dane.status.privacyStatus : film.status.privacyStatus };
}

function stronaCallback(odpowiedz, kod, komunikat) {
  const tekst = komunikat.replace(/[&<>"']/g, (znak) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[znak]);
  odpowiedz.writeHead(kod, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'" });
  odpowiedz.end('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube | Studio</title><style>@font-face{font-family:Poppins;src:url(/fonty/Poppins-Regular.ttf)}body{margin:0;background:#0E0E12;color:#EFE9DA;font-family:Poppins,sans-serif;padding:48px 24px}main{max-width:640px;margin:auto;background:#141419;border:1px solid #C9A455;border-radius:10px;padding:24px}h1{font-size:20px}</style><main><h1>' + tekst + '</h1></main></html>');
}

async function obsluz(zadanie, odpowiedz, url, n) {
  if (!url.pathname.startsWith("/api/youtube/")) return false;
  const stan = sesja(n);
  const wyslij = (kod, dane) => { n.odpowiedzJson(odpowiedz, kod, dane); return true; };
  const callback = url.pathname === "/api/youtube/callback" && zadanie.method === "GET";
  try {
    if (zadanie.method === "GET" && url.pathname === "/api/youtube/stan") {
      await odswiezStatystyki(n);
      const zapisane = tokeny(n);
      return wyslij(200, { skonfigurowany: !!klient(n).client_id, polaczony: !!zapisane.refresh_token,
        kanal: zapisane.kanal ? { id: zapisane.kanal.id, tytul: zapisane.kanal.tytul, miniatura: zapisane.kanal.miniatura,
          subskrybenci: zapisane.kanal.subskrybenci ?? null, filmy: zapisane.kanal.filmy ?? null,
          wyswietlenia: zapisane.kanal.wyswietlenia ?? null } : null, blad: stan.blad });
    }
    if (zadanie.method === "GET" && url.pathname === "/api/youtube/polacz") return wyslij(200, { url: budujOAuth(n) });
    if (callback) {
      const proba = stan.proba;
      const podany = url.searchParams.get("state") || "";
      if (!proba || proba.wygasa < Date.now() || !/^[a-f0-9]{64}$/.test(podany) ||
          !kryptografia.timingSafeEqual(Buffer.from(podany), Buffer.from(proba.state))) {
        throw bladJawny("Nieprawidłowy lub wygasły stan logowania. Połącz YouTube ponownie.");
      }
      stan.proba = null; // Jednorazowy state, rowniez przy odmowie zgody.
      const pokolenie = stan.pokolenie;
      if (url.searchParams.has("error")) throw bladJawny("Nie udzielono zgody na połączenie z YouTube.");
      const kod = url.searchParams.get("code");
      if (!kod) throw bladJawny("Brak kodu logowania YouTube.");
      const nowe = await wymienToken({ client_id: proba.klient.client_id, client_secret: proba.klient.client_secret,
        grant_type: "authorization_code", code: kod, redirect_uri: proba.przekierowanie });
      if (!nowe.refresh_token) throw bladJawny("YouTube nie zwrócił zgody offline. Połącz ponownie.");
      const dane = sprawdzGoogle(await zadanieGoogle("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", "GET", { Authorization: "Bearer " + nowe.access_token }));
      const kanal = dane.items?.[0];
      if (!kanal?.id) throw bladJawny("Nie znaleziono kanału YouTube dla tego konta.");
      if (pokolenie !== stan.pokolenie) throw bladJawny("Logowanie zostało anulowane. Połącz YouTube ponownie.");
      nowe.kanal = daneKanalu(kanal);
      nowe.statystyki_czas = Date.now();
      n.zapiszJson(plikTokenu(n), nowe);
      stan.blad = null;
      stronaCallback(odpowiedz, 200, "Połączono z YouTube, możesz zamknąć tę kartę");
      return true;
    }
    if (zadanie.method === "POST" && url.pathname === "/api/youtube/rozlacz") {
      stan.pokolenie++;
      stan.proba = null;
      stan.odswiezanie = null;
      fs.rmSync(plikTokenu(n), { force: true });
      stan.blad = null;
      return wyslij(200, { ok: true });
    }
    return wyslij(404, { blad: "Nie ma takiego adresu YouTube." });
  } catch (blad) {
    const tekst = blad.jawny ? blad.message : "Nie udało się obsłużyć połączenia YouTube.";
    stan.blad = tekst;
    if (callback) { stronaCallback(odpowiedz, blad.jawny ? blad.kod : 500, tekst); return true; }
    return wyslij(blad.jawny ? blad.kod : 500, { blad: tekst });
  }
}

module.exports = { obsluz, opublikujNaYouTube, budujOAuth, zlozFilm, tlumaczBlad };
