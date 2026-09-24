"use strict";

// Testy offline: izolowana kolejka, katalog tymczasowy i atrapy transportu.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { PassThrough, Writable } = require("node:stream");
const kod = fs.readFileSync(path.join(__dirname, "../moduly/publikacje.js"), "utf8");
const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "studio-publikacje-test-"));
let liczba = 0;

function srodowisko(pozycje = []) {
  let dane = { pozycje: structuredClone(pozycje), zachowane: true };
  let obieg;
  const kontekst = vm.createContext({
    require: (nazwa) => {
      if (nazwa === "https") return { request() { throw new Error("Test zabrania sieci"); } };
      return require(nazwa);
    },
    module: { exports: {} }, Buffer, URL, URLSearchParams, console,
    setTimeout: (fn, ms) => setTimeout(fn, ms === 5000 ? 0 : ms), clearTimeout,
    setInterval: (fn) => { obieg = fn; return 1; },
  });
  vm.runInContext(kod, kontekst);
  const n = {
    sciezki: { dane: katalog, config: katalog },
    czytajJson: (plik, domyslne) => plik.endsWith("publikacje.json") ? structuredClone(dane) : domyslne,
    zapiszJson: (plik, d) => { if (plik.endsWith("publikacje.json")) dane = structuredClone(d); },
    token: () => "test-token",
    ustawienia: () => ({ ig_id: "ig", strona_id: "strona" }),
    czytajCialo: async (req) => req.cialo,
    odpowiedzJson: (res, status, d) => Object.assign(res, { status, dane: d }),
  };
  kontekst.n = n;
  return {
    k: kontekst, n, dane: () => dane,
    kod: (s) => vm.runInContext(s, kontekst),
    obieg: () => obieg(),
    async trasa(sciezka, cialo, metoda = "POST", req = {}) {
      const res = {};
      req.method = metoda; req.cialo = cialo;
      await kontekst.obsluz(req, res, new URL("http://lokalnie" + sciezka), n);
      return res;
    },
  };
}

async function test(nazwa, fn) {
  await fn(); liczba++; console.log("OK " + nazwa);
}

async function main() {
  await test("transakcje zachowują inne pozycje i pola, wyjątek nie zapisuje zmian", async () => {
    const s = srodowisko([{ id: "a", opis: "stary" }]);
    s.k.zmien(s.n, "a", (p) => { p.opis = "nowy"; });
    s.k.zmien(s.n, null, (_, d) => { d.pozycje.push({ id: "b" }); });
    s.k.zmien(s.n, "a", (p) => { p.okladka_s = 2; });
    assert.equal(s.dane().pozycje.length, 2);
    assert.equal(s.dane().pozycje[0].opis, "nowy");
    assert.equal(s.dane().zachowane, true);
    assert.throws(() => s.k.zmien(s.n, "a", (p) => { p.opis = "utrata"; throw Error("stop"); }));
    assert.equal(s.dane().pozycje[0].opis, "nowy");
    assert.throws(() => s.k.zmien(s.n, "brak", () => {}), { http: 404 });
    assert.throws(() => s.k.zmien(s.n, "a", async () => {}), /synchroniczna/);
  });
  await test("test przywraca zaplanowanie i nie zmienia terminu", async () => {
    const termin = "2099-01-01T10:00:00.000Z";
    const s = srodowisko([{ id: "a", status: "zaplanowane", termin }]);
    s.kod('opublikujRolke = async () => ({ kontener: "test", test: true })');
    await s.k.wyslij(s.n, "a", true);
    assert.equal(s.dane().pozycje[0].status, "zaplanowane");
    assert.equal(s.dane().pozycje[0].termin, termin);
    assert.equal(s.dane().pozycje[0].test_wynik.ok, true);
  });
  await test("rezerwacja odrzuca duplikat, brak ID i gotową publikację", async () => {
    const s = srodowisko([{ id: "a", status: "szkic" }]);
    s.kod('opublikujRolke = () => new Promise((r) => globalThis.dokoncz = r)');
    const pierwsza = await s.trasa("/api/publikacje/wyslij", { id: "a" });
    assert.equal(pierwsza.status, 202);
    assert.equal((await s.trasa("/api/publikacje/wyslij", { id: "a" })).status, 409);
    s.k.dokoncz({ media_id: "media" });
    await new Promise(setImmediate);
    assert.equal((await s.trasa("/api/publikacje/wyslij", { id: "a" })).status, 409);
    assert.equal((await s.trasa("/api/publikacje/wyslij", { id: "brak" })).status, 404);
  });
  await test("błąd transportu pozostawia pozycję i zwalnia blokadę", async () => {
    const s = srodowisko([{ id: "a", status: "szkic" }]);
    s.kod('opublikujRolke = async () => { throw new Error("Połączenie zerwane"); }');
    await assert.rejects(s.k.wyslij(s.n, "a", false));
    assert.equal(s.dane().pozycje[0].status, "blad");
    assert.match(s.dane().pozycje[0].blad, /ponowienia/);
    assert.equal(s.kod("wysylanie"), null);
  });
  await test("restart rozróżnia przerwany upload i niepewną publikację", async () => {
    const s = srodowisko([{ id: "a", status: "wysylanie" }, { id: "b", status: "wysylanie", niepewna: "instagram" }]);
    s.k.odzyskaj(s.n);
    assert.equal(s.dane().pozycje[0].status, "blad");
    assert.equal(s.dane().pozycje[1].status, "blad");
    assert.throws(() => s.k.wyslij(s.n, "b", false), { http: 409 });
  });
  await test("ponowienie samego Facebooka nie publikuje drugi raz Instagrama", async () => {
    const s = srodowisko([{ id: "a", status: "blad", instagram: { media_id: "ig" }, facebook: true }]);
    s.kod('opublikujRolke = async () => { throw Error("Duplikat IG"); }; opublikujNaFacebooku = async () => ({ video_id: "fb" })');
    await s.k.wyslij(s.n, "a", false);
    assert.equal(s.dane().pozycje[0].instagram.media_id, "ig");
    assert.equal(s.dane().pozycje[0].facebook_wynik.video_id, "fb");
    assert.equal(s.dane().pozycje[0].status, "opublikowane");
  });
  await test("parametry kontenera: okładka wyklucza kadr, feed i trial", async () => {
    const p = srodowisko().k.parametryKontenera;
    assert.equal(p({ okladka_s: 1.25 }).thumb_offset, "1250");
    const wynik = p({ okladka_s: 2, do_feedu: false, probna: true }, { url: "okladka" });
    assert.equal(wynik.thumb_offset, undefined);
    assert.equal(wynik.cover_url, "okladka");
    assert.equal(wynik.share_to_feed, "false");
    assert.equal(JSON.parse(wynik.trial_params).graduation_strategy, "MANUAL");
  });
  await test("dokładna strona FB, stronicowanie i brak zastępstwa", async () => {
    const s = srodowisko();
    s.kod('graphGet = async () => ({ data: [{ id: "obca", access_token: "sekret" }] })');
    await assert.rejects(s.k.tokenStrony(s.n), /wskazanej strony/);
    s.kod('graphGet = async (n, sc, p) => p.after ? { data: [{ id: "strona", access_token: "sekret" }] } : { data: [], paging: { next: "adres", cursors: { after: "dalej" } } }');
    assert.equal((await s.k.tokenStrony(s.n)).strona_id, "strona");
  });
  await test("walidacja terminów i blokada edycji gotowej pozycji", async () => {
    const s = srodowisko([{ id: "a", status: "szkic" }]);
    for (const termin of ["bzdura", "2000-01-01", {}, 1])
      assert.equal((await s.trasa("/api/publikacje/zapisz", { id: "a", termin })).status, 400);
    assert.equal((await s.trasa("/api/publikacje/zapisz", { id: "a", termin: "2099-01-01T10:00:00Z" })).status, 200);
    s.k.zmien(s.n, "a", (p) => { p.status = "opublikowane"; });
    assert.equal((await s.trasa("/api/publikacje/zapisz", { id: "a", opis: "nowy" })).status, 409);
  });
  await test("upload okładki nie nadpisuje równoległej edycji", async () => {
    const s = srodowisko([{ id: "okladka", status: "szkic", opis: "stary" }]);
    const req = new PassThrough();
    const upload = s.trasa("/api/publikacje/okladka?id=okladka&nazwa=test.jpg", null, "PUT", req);
    s.k.zmien(s.n, "okladka", (p) => { p.opis = "nowy"; });
    req.end("obraz");
    assert.equal((await upload).status, 200);
    assert.equal(s.dane().pozycje[0].opis, "nowy");
    assert.equal(fs.readFileSync(s.dane().pozycje[0].okladka_plik, "utf8"), "obraz");
  });
  await test("upload nie odtwarza usuniętej pozycji i sprząta plik", async () => {
    const s = srodowisko([{ id: "usunieta", status: "szkic" }]);
    const req = new PassThrough();
    const upload = s.trasa("/api/publikacje/okladka?id=usunieta&nazwa=test.jpg", null, "PUT", req);
    s.k.zmien(s.n, null, (_, d) => { d.pozycje = []; });
    req.end("obraz");
    assert.equal((await upload).status, 404);
    assert.equal(s.dane().pozycje.length, 0);
    assert.equal(fs.readdirSync(path.join(katalog, "publikacje")).some((p) => p.startsWith("usunieta_")), false);
  });
  await test("przerwany i za duży upload zachowują poprzedni plik", async () => {
    const s = srodowisko();
    const plik = path.join(katalog, "stara.jpg");
    fs.writeFileSync(plik, "stara");
    for (const przerwany of [true, false]) {
      const req = new PassThrough();
      const wynik = s.k.czytajPlik(req, plik, 3);
      const odrzucony = assert.rejects(wynik);
      if (przerwany) { req.write("x"); req.emit("aborted"); }
      else req.end("za duzy");
      await odrzucony;
      assert.equal(fs.readFileSync(plik, "utf8"), "stara");
    }
    assert.equal(fs.readdirSync(katalog).some((p) => p.endsWith(".tmp")), false);
  });
  await test("harmonogram wybiera najwcześniejszą zaległość i współdzieli blokadę", async () => {
    const s = srodowisko([{ id: "pozniej", status: "zaplanowane", termin: "2020-02-01" }, { id: "wczesniej", status: "zaplanowane", termin: "2020-01-01" }]);
    s.kod('opublikujRolke = () => new Promise((r) => globalThis.dokoncz = r)');
    s.k.uruchomHarmonogram(s.n);
    const obieg = s.obieg();
    assert.equal(s.kod("wysylanie"), "wczesniej");
    assert.throws(() => s.k.wyslij(s.n, "wczesniej", false), { http: 409 });
    s.k.dokoncz({ media_id: "ig" });
    await obieg;
  });
  await test("utrata odpowiedzi publish zachowuje ID kontenera i blokuje duplikat", async () => {
    const plik = path.join(katalog, "film.mp4"); fs.writeFileSync(plik, "film");
    const s = srodowisko([{ id: "a", status: "szkic", plik }]);
    s.kod('graphPost = async (sc) => { if (sc.endsWith("media_publish")) throw Error("Zerwano odpowiedź"); return { id: "kontener", uri: "upload" }; }; wyslijBajty = async () => ({}); graphGet = async () => ({ status_code: "FINISHED" })');
    await assert.rejects(s.k.wyslij(s.n, "a", false));
    assert.equal(s.dane().pozycje[0].instagram_kontener, "kontener");
    assert.equal(s.dane().pozycje[0].niepewna, "instagram");
    assert.throws(() => s.k.wyslij(s.n, "a", false), { http: 409 });
  });
  await test("transport kończy się po aborted, error i timeout, odrzuca błędy HTTP", async () => {
    for (const rodzaj of ["aborted", "error", "timeout", "http", "success-false"]) {
      const s = srodowisko();
      const odp = new PassThrough(); odp.statusCode = rodzaj === "http" ? 500 : 200;
      const req = new Writable({ write(k, enc, cb) { cb(); } });
      req.setTimeout = (_, fn) => { if (rodzaj === "timeout") setImmediate(fn); };
      s.k.atrapa = (opcje, fn) => {
        setImmediate(() => {
          if (rodzaj === "timeout") return;
          fn(odp);
          if (rodzaj === "aborted") odp.emit("aborted");
          else if (rodzaj === "error") odp.emit("error", Error("zerwano"));
          else odp.end(JSON.stringify({ success: rodzaj !== "success-false" }));
        });
        return req;
      };
      s.kod("https.request = atrapa");
      await assert.rejects(s.k.zadanieMeta({}, "cialo"));
      assert.equal(req.destroyed, true);
    }
  });
  await test("błąd dysku podczas uploadu jest obsłużony", async () => {
    const s = srodowisko();
    const req = new Writable({ write(k, enc, cb) { cb(); } }); req.setTimeout = () => {};
    s.k.atrapa = () => req; s.kod("https.request = atrapa");
    await assert.rejects(s.k.zadanieMeta({}, null, path.join(katalog, "nieistniejacy.mp4")), /odczytać/);
    assert.equal(req.destroyed, true);
  });
  await test("obcy host uploadu nie otrzymuje tokena", async () => {
    const s = srodowisko();
    assert.throws(() => s.k.wyslijBajty("https://obcy.example/upload", "sekret", "film"), /niedozwolony/);
    assert.equal(s.k.bezpiecznyBlad(Error("access_token=sekret https://meta.example/?token=abc")), "access_token [ukryto] [adres]");
  });
  await test("usuwanie sprząta film, okładkę i kadry, zachowuje obce pliki", async () => {
    const kat = path.join(katalog, "publikacje");
    const klatki = path.join(kat, "klatki"); fs.mkdirSync(klatki, { recursive: true });
    const plik = path.join(kat, "sprzatanie_film.mp4");
    const okladka = path.join(kat, "sprzatanie_okladka.jpg");
    const kadr = path.join(klatki, "sprzatanie_0.jpg");
    const obcy = path.join(kat, "obcy.jpg");
    for (const p of [plik, okladka, kadr, obcy]) fs.writeFileSync(p, "plik");
    const s = srodowisko([{ id: "sprzatanie", plik, okladka_plik: okladka, status: "szkic" }]);
    assert.equal((await s.trasa("/api/publikacje/usun", { id: "sprzatanie" })).status, 200);
    for (const p of [plik, okladka, kadr]) assert.equal(fs.existsSync(p), false);
    assert.equal(fs.existsSync(obcy), true);
  });
  await test("błąd po hostowaniu okładki uruchamia sprzątanie zdjęcia FB", async () => {
    const plik = path.join(katalog, "film-okladka.mp4"); fs.writeFileSync(plik, "film");
    const s = srodowisko([{ id: "a", status: "szkic", plik, okladka_plik: plik }]);
    s.kod('hostujOkladke = async (n, p) => { zmien(n, p.id, (x) => { x.okladka_zdjecie_id = "foto"; }); throw Error("Brak adresu zdjęcia"); }; tokenStrony = async () => ({ token: "sekret" }); usunZdjecie = async (n, id) => { globalThis.usuniete = id; }');
    await assert.rejects(s.k.wyslij(s.n, "a", false));
    assert.equal(s.k.usuniete, "foto");
    assert.equal(s.dane().pozycje[0].okladka_zdjecie_id, null);
  });
  await test("późny upload okładki nie zmienia rozpoczętej publikacji", async () => {
    const s = srodowisko([{ id: "pozna", status: "szkic" }]);
    const req = new PassThrough();
    const upload = s.trasa("/api/publikacje/okladka?id=pozna&nazwa=test.jpg", null, "PUT", req);
    s.k.zmien(s.n, "pozna", (p) => { p.status = "wysylanie"; });
    req.end("obraz");
    assert.equal((await upload).status, 409);
    assert.equal(s.dane().pozycje[0].okladka_plik, undefined);
    assert.equal(fs.readdirSync(path.join(katalog, "publikacje")).some((p) => p.startsWith("pozna_")), false);
  });
  await test("panel kończy zapis opisu i platform przed potwierdzeniem publikacji", async () => {
    const zrodlo = fs.readFileSync(path.join(__dirname, "../app/publikacje.js"), "utf8");
    const wywolania = [], potwierdzenia = [], timery = [];
    let awaria = false;
    let pozycja = { id: "a", opis: "stary", status: "szkic", facebook: false };
    const el = { classList: { remove() {}, add() {}, toggle() {} }, textContent: "" };
    const k = vm.createContext({
      window: {}, document: { querySelector: () => el }, console,
      setTimeout: (fn) => { timery.push(fn); return timery.length; }, clearTimeout() {},
      confirm: (tekst) => { potwierdzenia.push(tekst); return true; },
      fetch: async (sc, opcje) => {
        const dane = opcje ? JSON.parse(opcje.body) : null;
        wywolania.push({ sc, dane });
        if (awaria) throw Error("offline");
        if (sc.endsWith("zapisz")) pozycja = { ...pozycja, ...dane };
        return { ok: true, json: async () => ({ pozycja, pozycje: [pozycja] }) };
      },
    });
    vm.runInContext(zrodlo.replace("  return { start };", "  return { start, st, zapiszPole, dokonczZapisy, rozpocznij, wczytaj, bezRysowania: () => { rysuj = () => {}; } };"), k);
    const ui = k.window.Publikacje; ui.bezRysowania();
    ui.st.pozycje = [pozycja]; ui.st.robocze.a = { opis: "najnowszy opis" };
    const zapis = ui.zapiszPole("a", { facebook: true });
    await ui.rozpocznij("a", false); await zapis;
    assert.match(potwierdzenia[0], /najnowszy opis/);
    assert.match(potwierdzenia[0], /Facebooku/);
    const przedWysylka = wywolania.findIndex((x) => x.sc.endsWith("wyslij"));
    assert.equal(wywolania[przedWysylka - 1].dane.opis, "najnowszy opis");
    awaria = true; ui.st.wysylanie = null; ui.st.robocze.a = { opis: "niezapisany" };
    const ile = wywolania.filter((x) => x.sc.endsWith("wyslij")).length;
    await ui.rozpocznij("a", false);
    assert.equal(wywolania.filter((x) => x.sc.endsWith("wyslij")).length, ile);
    const poprzednieTimery = timery.length;
    await ui.wczytaj();
    assert.ok(timery.length > poprzednieTimery);
    assert.equal(ui.st.robocze.a.opis, "niezapisany");
  });
}

main().then(() => console.log(`Przeszło ${liczba} testów offline.`)).catch((e) => {
  console.error(e); process.exitCode = 1;
}).finally(() => {
  // Katalog pochodzi wylacznie z mkdtemp; nigdy nie dotykamy danych aplikacji.
  fs.rmSync(katalog, { recursive: true, force: true });
});
