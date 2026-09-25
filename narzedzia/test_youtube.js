"use strict";

// Wszystkie polaczenia HTTPS zastapione atrapa. Nie wczytuje konfiguracji Studio.
const asercja = require("assert/strict");
const fs = require("fs");
const sciezka = require("path");
const os = require("os");
const vm = require("vm");
const { Writable: StrumienZapisu, PassThrough: StrumienPrzelotowy } = require("stream");
const katalog = fs.mkdtempSync(sciezka.join(os.tmpdir(), "studio-youtube-test-"));
const scenariusz = [];
let liczbaZadan = 0;
let bladAtrapy = null;
let czas = Date.now();
class DataTestowa extends Date {
  static now() { return czas; }
}
const atrapaHttps = {
  request(adres, opcje, odbierz) {
    const krok = scenariusz.shift();
    liczbaZadan++;
    if (!krok) throw new Error("Niespodziewane żądanie HTTPS, sieć jest zablokowana w teście");
    const kawalki = [];
    const zadanie = new StrumienZapisu({ write(kawalek, kodowanie, gotowe) { kawalki.push(kawalek); gotowe(); } });
    zadanie.setTimeout = () => zadanie;
    zadanie.on("finish", () => {
      try { krok.sprawdz?.(adres, opcje, Buffer.concat(kawalki)); }
      catch (blad) { bladAtrapy = blad; zadanie.emit("error", blad); return; }
      if (krok.zerwij) { zadanie.emit("error", new Error("Testowe zerwanie")); return; }
      const odpowiedz = new StrumienPrzelotowy();
      odpowiedz.statusCode = krok.kod || 200;
      odpowiedz.headers = krok.naglowki || {};
      odbierz(odpowiedz);
      odpowiedz.end(krok.dane ? JSON.stringify(krok.dane) : "");
    });
    return zadanie;
  },
};
const kontekst = { module: { exports: {} }, URL, URLSearchParams, Buffer, setTimeout, clearTimeout, Date: DataTestowa,
  require(nazwa) { return nazwa === "https" ? atrapaHttps : require(nazwa); } };
vm.runInNewContext(fs.readFileSync(sciezka.join(__dirname, "../moduly/youtube.js"), "utf8"), kontekst);
const youtube = kontekst.module.exports;
const n = {
  sciezki: { config: katalog }, port: () => 43123,
  czytajJson(plik, domyslne) { try { return JSON.parse(fs.readFileSync(plik, "utf8")); } catch { return domyslne; } },
  zapiszJson(plik, dane) { fs.writeFileSync(plik + ".tmp", JSON.stringify(dane)); fs.renameSync(plik + ".tmp", plik); },
  odpowiedzJson(odpowiedz, kod, dane) { odpowiedz.kod = kod; odpowiedz.dane = dane; },
};
const plikTokenu = sciezka.join(katalog, "youtube_token.json");
const plikKlienta = sciezka.join(katalog, "youtube_klient.json");
const zapisaneTokeny = () => n.czytajJson(plikTokenu, {});
async function wywolaj(adres, metoda = "GET") {
  const odpowiedz = { writeHead(kod, naglowki) { this.kod = kod; this.naglowki = naglowki; }, end(tekst) { this.tekst = tekst; } };
  asercja.equal(await youtube.obsluz({ method: metoda }, odpowiedz, new URL(adres, "http://127.0.0.1:43123"), n), true);
  return odpowiedz;
}
const normalny = (dane) => JSON.parse(JSON.stringify(dane));

async function test() {
  let wynik = await wywolaj("/api/youtube/stan");
  asercja.deepEqual(normalny(wynik.dane), { skonfigurowany: false, polaczony: false, kanal: null, blad: null });
  asercja.equal((await wywolaj("/api/youtube/polacz")).kod, 400);
  n.zapiszJson(plikKlienta, { client_id: "test.apps.googleusercontent.com", client_secret: "sekret-testowy" });
  const oauth = new URL((await wywolaj("/api/youtube/polacz")).dane.url);
  asercja.equal(oauth.origin + oauth.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  const parametry = oauth.searchParams;
  for (const [klucz, wartosc] of Object.entries({ client_id: "test.apps.googleusercontent.com", response_type: "code",
    redirect_uri: "http://127.0.0.1:43123/api/youtube/callback", access_type: "offline", prompt: "consent",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly" })) {
    asercja.equal(parametry.get(klucz), wartosc, klucz);
  }
  const stan = parametry.get("state");
  asercja.match(stan, /^[a-f0-9]{64}$/);
  asercja.equal(parametry.has("client_secret"), false);
  wynik = await wywolaj("/api/youtube/callback?code=kod&state=bledny");
  asercja.equal(wynik.kod, 400);
  asercja.equal(liczbaZadan, 0, "Błędny state nie może wywołać HTTPS");
  asercja.equal((await wywolaj("/api/youtube/callback?code=kod&state=" + encodeURIComponent("ą".repeat(64)))).kod, 400);
  scenariusz.push({ dane: { access_token: "dostep-test", refresh_token: "odswiez-test", expires_in: 3600 }, sprawdz(adres, opcje, cialo) {
    asercja.equal(adres.href, "https://oauth2.googleapis.com/token");
    asercja.equal(opcje.method, "POST");
    const pola = new URLSearchParams(cialo.toString());
    asercja.equal(pola.get("grant_type"), "authorization_code");
    asercja.equal(pola.get("code"), "kod");
    asercja.equal(pola.get("redirect_uri"), parametry.get("redirect_uri"));
  } }, { dane: { items: [{ id: "kanal", statistics: { subscriberCount: "512", videoCount: "10", viewCount: "12345" }, snippet: { title: "Kanał testowy", thumbnails: { default: { url: "https://example.invalid/avatar" } } } }] }, sprawdz(adres, opcje) {
    asercja.equal(adres.search, "?part=snippet,statistics&mine=true");
    asercja.equal(opcje.headers.Authorization, "Bearer dostep-test");
  } });
  wynik = await wywolaj("/api/youtube/callback?code=kod&state=" + stan);
  asercja.equal(wynik.kod, 200);
  asercja.match(wynik.tekst, /Połączono z YouTube/);
  asercja.equal(zapisaneTokeny().refresh_token, "odswiez-test");
  asercja.equal(zapisaneTokeny().wygasa, new Date(czas + 3600000).toISOString());
  wynik = await wywolaj("/api/youtube/stan");
  asercja.equal(wynik.dane.kanal.tytul, "Kanał testowy");
  asercja.equal(wynik.dane.kanal.subskrybenci, 512);
  asercja.equal(zapisaneTokeny().kanal.wyswietlenia, 12345);
  asercja.equal(JSON.stringify(wynik.dane).includes("dostep-test"), false);
  asercja.equal(JSON.stringify(wynik.dane).includes("odswiez-test"), false);
  asercja.equal((await wywolaj("/api/youtube/callback?code=kod&state=" + stan)).kod, 400, "State jest jednorazowy");

  const noweOAuth = new URL(youtube.budujOAuth(n));
  asercja.notEqual(noweOAuth.searchParams.get("state"), stan);
  czas += 11 * 60000;
  asercja.equal((await wywolaj("/api/youtube/callback?code=kod&state=" + noweOAuth.searchParams.get("state"))).kod, 400);
  const odmowa = new URL(youtube.budujOAuth(n));
  asercja.equal((await wywolaj("/api/youtube/callback?error=access_denied&state=" + odmowa.searchParams.get("state"))).kod, 400);
  asercja.equal(liczbaZadan, 2);

  let film = youtube.zlozFilm({ opis: "Pierwsza linia\nDruga linia" });
  asercja.deepEqual(normalny(film), { snippet: { title: "Pierwsza linia", description: "Pierwsza linia\nDruga linia", categoryId: "17", tags: [] },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false } });
  film = youtube.zlozFilm({ youtube_tytul: "💪".repeat(120), opis: "Opis", youtube_prywatnosc: "unlisted", youtube_tagi: [" trening ", 12, ""] });
  asercja.equal(Array.from(film.snippet.title).length, 100);
  asercja.deepEqual(normalny(film.snippet.tags), ["trening"]);
  asercja.equal(film.status.privacyStatus, "unlisted");
  asercja.equal(youtube.zlozFilm({ youtube_prywatnosc: "public" }).status.privacyStatus, "public");
  asercja.equal(youtube.zlozFilm({ youtube_prywatnosc: "bledna" }).status.privacyStatus, "private");
  asercja.equal(youtube.tlumaczBlad(401), "YouTube wylogował aplikację, połącz ponownie w Ustawieniach");
  asercja.equal(youtube.tlumaczBlad(400, { error: "invalid_grant" }), youtube.tlumaczBlad(401));
  asercja.equal(youtube.tlumaczBlad(403, { error: { errors: [{ reason: "quotaExceeded" }] } }), "limit dzienny YouTube wyczerpany, spróbuj jutro");
  asercja.match(youtube.tlumaczBlad(403, { error: { message: "SEKRET", errors: [{ reason: "forbidden" }] } }), /odmówił dostępu/);
  asercja.equal(youtube.tlumaczBlad(500, { error: { message: "SEKRET" } }).includes("SEKRET"), false);

  const plik = sciezka.join(katalog, "film.mp4");
  fs.writeFileSync(plik, "0123456789");
  const pozycja = { plik, opis: "Test filmu" };
  const adresSesji = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test";
  const start = () => ({ naglowki: { location: adresSesji }, sprawdz(adres, opcje, cialo) {
    asercja.equal(adres.searchParams.get("uploadType"), "resumable");
    asercja.equal(opcje.headers["X-Upload-Content-Length"], "10");
    asercja.equal(JSON.parse(cialo).status.privacyStatus, "private");
  } });
  const etapy = [];
  scenariusz.push(start(), { zerwij: true, sprawdz(adres, opcje, cialo) { asercja.equal(cialo.toString(), "0123456789"); } },
    { kod: 308, naglowki: { range: "bytes=0-3" }, sprawdz(adres, opcje, cialo) {
      asercja.equal(opcje.headers["Content-Range"], "bytes */10"); asercja.equal(cialo.length, 0);
    } }, { dane: { id: "film-1", status: { privacyStatus: "private" } }, sprawdz(adres, opcje, cialo) {
      asercja.equal(opcje.headers["Content-Range"], "bytes 4-9/10");
      asercja.equal(opcje.headers["Content-Length"], "6"); asercja.equal(cialo.toString(), "456789");
    } });
  asercja.deepEqual(normalny(await youtube.opublikujNaYouTube(n, pozycja, (etap, opis) => etapy.push(opis))),
    { video_id: "film-1", link: "https://youtube.com/shorts/film-1", prywatnosc: "private" });
  asercja.equal(etapy.length, 3);

  // Wygasajacy token zostaje odswiezony przed rozpoczeciem kolejnej wysylki.
  n.zapiszJson(plikTokenu, { ...zapisaneTokeny(), wygasa: new Date(czas + 119000).toISOString() });
  scenariusz.push({ dane: { access_token: "nowy-test", expires_in: 3600 }, sprawdz(adres, opcje, cialo) {
    asercja.equal(new URLSearchParams(cialo.toString()).get("grant_type"), "refresh_token");
  } }, start(), { dane: { id: "film-2" }, sprawdz(adres, opcje) { asercja.equal(opcje.headers.Authorization, "Bearer nowy-test"); } });
  asercja.equal((await youtube.opublikujNaYouTube(n, pozycja)).video_id, "film-2");
  asercja.equal(zapisaneTokeny().refresh_token, "odswiez-test");
  asercja.equal(zapisaneTokeny().kanal.id, "kanal");

  // Utrata odpowiedzi po pelnym transferze nie powoduje drugiej publikacji.
  scenariusz.push(start(), { zerwij: true }, { dane: { id: "film-3" } });
  asercja.equal((await youtube.opublikujNaYouTube(n, pozycja)).video_id, "film-3");
  // Brak Range oznacza 0 potwierdzonych bajtow.
  scenariusz.push(start(), { kod: 503 }, { kod: 308 }, { dane: { id: "film-4" }, sprawdz(adres, opcje, cialo) {
    asercja.equal(cialo.toString(), "0123456789");
  } });
  asercja.equal((await youtube.opublikujNaYouTube(n, pozycja)).video_id, "film-4");
  // Maksymalnie jedno wznowienie, bez otwierania nowej sesji.
  scenariusz.push(start(), { zerwij: true }, { kod: 308, naglowki: { range: "bytes=0-1" } }, { kod: 308 });
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /Sprawdź film/);
  scenariusz.push(start(), { kod: 401 });
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /wylogował/);
  scenariusz.push({ kod: 403, dane: { error: { errors: [{ reason: "quotaExceeded" }] } } });
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /limit dzienny/);
  scenariusz.push({ naglowki: { location: "https://example.invalid/kradziez" } });
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /nieprawidłowy adres/);
  scenariusz.push({ naglowki: { location: adresSesji }, sprawdz() { fs.unlinkSync(plik); } }, {});
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /odczytać pliku/);
  fs.writeFileSync(plik, "0123456789");
  asercja.equal(scenariusz.length, 0);
  if (bladAtrapy) throw bladAtrapy;

  // Rozlaczenie w czasie odswiezania nie odtwarza usunietego tokena.
  n.zapiszJson(plikTokenu, { ...zapisaneTokeny(), wygasa: new Date(czas).toISOString() });
  let rozlaczenie;
  scenariusz.push({ dane: { access_token: "spozniony-test", expires_in: 3600 }, sprawdz() {
    rozlaczenie = wywolaj("/api/youtube/rozlacz", "POST");
  } });
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /zostało zmienione/);
  await rozlaczenie;
  asercja.equal(fs.existsSync(plikTokenu), false);

  const przedRozlaczeniem = new URL(youtube.budujOAuth(n));
  asercja.equal((await wywolaj("/api/youtube/rozlacz", "POST")).kod, 200);
  asercja.equal(fs.existsSync(plikTokenu), false);
  asercja.equal((await wywolaj("/api/youtube/stan")).dane.polaczony, false);
  asercja.equal((await wywolaj("/api/youtube/callback?code=x&state=" + przedRozlaczeniem.searchParams.get("state"))).kod, 400);
  await asercja.rejects(youtube.opublikujNaYouTube(n, pozycja), /wylogował/);
  asercja.equal((await wywolaj("/api/youtube/rozlacz", "POST")).kod, 200);
  // Statystyki: jeden odczyt na 10 minut, wspolny dla rownoleglych odswiezen.
  czas += 3600000;
  n.zapiszJson(plikTokenu, { access_token: "stat-dostep", refresh_token: "stat-odswiez",
    wygasa: new Date(czas + 3600000).toISOString(), kanal: { id: "kanal", tytul: "Kanał" } });
  const statystyki = (ile) => ({ items: [{ id: "kanal", snippet: { title: "Kanał" },
    statistics: { subscriberCount: String(ile), videoCount: "12", viewCount: "3456" } }] });
  const przedStatystykami = liczbaZadan;
  scenariusz.push({ dane: statystyki(1234) });
  const odczyty = await Promise.all([wywolaj("/api/youtube/stan"), wywolaj("/api/youtube/stan")]);
  asercja.equal(liczbaZadan, przedStatystykami + 1);
  asercja.equal(odczyty[0].dane.kanal.subskrybenci, 1234);
  asercja.equal(zapisaneTokeny().kanal.filmy, 12);
  asercja.equal(zapisaneTokeny().kanal.wyswietlenia, 3456);
  asercja.ok(!JSON.stringify(odczyty).includes("stat-dostep"));
  czas += 599999;
  await wywolaj("/api/youtube/stan");
  asercja.equal(liczbaZadan, przedStatystykami + 1);
  czas++;
  scenariusz.push({ dane: statystyki(1235) });
  asercja.equal((await wywolaj("/api/youtube/stan")).dane.kanal.subskrybenci, 1235);
  czas += 600000;
  scenariusz.push({ kod: 503 });
  asercja.equal((await wywolaj("/api/youtube/stan")).dane.kanal.subskrybenci, 1235);
  const poAwarii = liczbaZadan;
  await wywolaj("/api/youtube/stan");
  asercja.equal(liczbaZadan, poAwarii);
  czas += 600000;
  scenariusz.push({ dane: statystyki(9999), sprawdz() { rozlaczenie = wywolaj("/api/youtube/rozlacz", "POST"); } });
  asercja.equal((await wywolaj("/api/youtube/stan")).dane.polaczony, false);
  await rozlaczenie;
  asercja.equal(fs.existsSync(plikTokenu), false);
  asercja.equal(scenariusz.length, 0);
  if (bladAtrapy) throw bladAtrapy;
  console.log("OK: OAuth, callback, tokeny, metadane, błędy, strumień i wznowienie wysyłki, rozłączenie, statystyki i cache 10 minut (offline)");
}

test().catch((blad) => { console.error(bladAtrapy || blad); process.exitCode = 1; }).finally(() => {
  // Katalog utworzony przez mkdtempSync, zawiera wylacznie dane tego testu.
  fs.rmSync(katalog, { recursive: true, force: true });
});
