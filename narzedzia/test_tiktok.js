"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const sciezka = require("path");
const vm = require("vm");
const { Writable, Readable } = require("stream");
const modul = require("../moduly/tiktok");
const MB = 1024 * 1024;
let liczba = 0;
async function test(nazwa, funkcja) {
  await funkcja();
  liczba++;
  console.log("OK " + nazwa);
}

// Transport w VM zawsze jest atrapa. Zaden test nie korzysta z sieci ani config uzytkownika.
function srodowisko() {
  let czas = Date.now();
  let rozmiar = 3 * MB;
  let awariaPliku = false;
  const pliki = new Map();
  const wywolania = [];
  const odpowiedzi = [];
  const n = { sciezki: { config: "test-tiktok-config" }, port: () => 8767,
    czytajJson: (plik, domyslne) => pliki.get(plik) || domyslne,
    zapiszJson: (plik, dane) => pliki.set(plik, JSON.parse(JSON.stringify(dane))),
    odpowiedzJson: (odpowiedz, kod, dane) => Object.assign(odpowiedz, { kod, dane }) };
  pliki.set(sciezka.join(n.sciezki.config, "tiktok_klient.json"), { client_key: "klucz", client_secret: "TAJNY_KLIENT" });
  const atrapaHttps = { request(adres, opcje, odbierz) {
    const zapis = { adres: adres.href, ...opcje, bajty: 0, cialo: "" };
    wywolania.push(zapis);
    const zadanie = new Writable({ write(kawalek, kodowanie, gotowe) {
      zapis.bajty += kawalek.length;
      if (opcje.method !== "PUT") zapis.cialo += kawalek.toString();
      gotowe();
    } });
    zadanie.setTimeout = () => {};
    zadanie.on("finish", () => {
      const nastepna = odpowiedzi.shift();
      if (!nastepna) { zadanie.destroy(new Error("Brak odpowiedzi atrapy")); return; }
      if (nastepna instanceof Error) { zadanie.destroy(nastepna); return; }
      if (nastepna.sprawdz) nastepna.sprawdz(zapis);
      const odpowiedz = Readable.from(nastepna.dane === undefined ? [] : [Buffer.from(JSON.stringify(nastepna.dane))]);
      odpowiedz.statusCode = nastepna.kod || 200;
      odbierz(odpowiedz);
    });
    return zadanie;
  } };
  const atrapaFs = {
    statSync: () => ({ isFile: () => true, size: rozmiar }),
    rmSync: (plik) => pliki.delete(plik),
    createReadStream: (plik, zakres) => {
      if (awariaPliku) return new Readable({ read() { this.destroy(new Error("TAJNY_BLAD_DYSKU")); } });
      return Readable.from([Buffer.alloc(zakres.end - zakres.start + 1)]);
    },
  };
  const kontekst = { module: { exports: {} }, Buffer, URL, URLSearchParams,
    Date: class extends Date { static now() { return czas; } },
    setTimeout: (funkcja, ms) => { if (ms <= 5000 && funkcja.name !== "bladSieci") queueMicrotask(() => { czas += ms; funkcja(); }); return 1; },
    clearTimeout: () => {}, require: (nazwa) => nazwa === "https" ? atrapaHttps : nazwa === "fs" ? atrapaFs : require(nazwa) };
  vm.runInNewContext(fs.readFileSync(sciezka.join(__dirname, "../moduly/tiktok.js"), "utf8"), kontekst);
  const t = kontekst.module.exports;
  const plikTokenu = sciezka.join(n.sciezki.config, "tiktok_token.json");
  const zapiszToken = (nadpisz = {}) => pliki.set(plikTokenu, { access_token: "TAJNY_ACCESS", refresh_token: "TAJNY_REFRESH", open_id: "konto1",
    wygasa: new Date(czas + 3600000).toISOString(), refresh_wygasa: new Date(czas + 86400000).toISOString(), ...nadpisz });
  const trasa = async (koncowka, metoda = "GET") => {
    const odpowiedz = { writeHead(kod) { this.kod = kod; }, end(tekst) { this.tekst = tekst; } };
    await t.obsluz({ method: metoda }, odpowiedz, new URL("http://127.0.0.1/api/tiktok/" + koncowka), n);
    return odpowiedz;
  };
  return { t, n, pliki, plikTokenu, wywolania, odpowiedzi, zapiszToken, trasa,
    ustawRozmiar: (wartosc) => { rozmiar = wartosc; }, awaria: () => { awariaPliku = true; },
    przesunCzas: (ms) => { czas += ms; } };
}

async function main() {
  await test("PKCE RFC 7636", () => {
    assert.equal(modul.wyzwaniePKCE("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  await test("adres OAuth, jednorazowy state i brak sekretu w URL", () => {
    const s = srodowisko();
    const url = new URL(s.t.budujOAuth(s.n));
    assert.equal(url.origin + url.pathname, "https://www.tiktok.com/v2/auth/authorize/");
    assert.equal(url.searchParams.get("scope"), "user.info.basic,video.publish,video.upload");
    assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:8767/api/tiktok/callback");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_key"), "klucz");
    assert.match(url.searchParams.get("code_challenge"), /^[\w-]{43}$/);
    assert.match(url.searchParams.get("state"), /^[a-f0-9]{64}$/);
    assert.ok(!url.href.includes("TAJNY"));
    assert.notEqual(new URL(s.t.budujOAuth(s.n)).searchParams.get("state"), url.searchParams.get("state"));
  });
  for (const [rozmiar, kawalek, liczbaKawalkow] of [[3 * MB, 3 * MB, 1], [64 * MB, 64 * MB, 1], [150 * MB, 10 * MB, 15], [64 * MB + 1, 10 * MB, 7]]) {
    await test("podzial " + rozmiar + " bajtow", () => {
      const wynik = modul.podzielPlik(rozmiar);
      assert.deepEqual(wynik.source_info, { source: "FILE_UPLOAD", video_size: rozmiar, chunk_size: kawalek, total_chunk_count: liczbaKawalkow });
      assert.equal(wynik.kawalki[0].od, 0);
      assert.equal(wynik.kawalki.at(-1).do, rozmiar - 1);
      assert.equal(wynik.kawalki.reduce((suma, k) => suma + k.do - k.od + 1, 0), rozmiar);
      wynik.kawalki.slice(1).forEach((k, i) => assert.equal(k.od, wynik.kawalki[i].do + 1));
    });
  }
  await test("post_info, Unicode, okladka 0 i widocznosc", () => {
    assert.deepEqual(modul.zlozPost({}), { title: "", privacy_level: "SELF_ONLY", disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 });
    const post = modul.zlozPost({ opis: "😀".repeat(2300), okladka_s: 0, tiktok_widocznosc: "PUBLIC_TO_EVERYONE" });
    assert.equal(Array.from(post.title).length, 2200);
    assert.equal(post.video_cover_timestamp_ms, 0);
    assert.equal(post.privacy_level, "PUBLIC_TO_EVERYONE");
    assert.equal(modul.zlozPost({ okladka_s: 1.234 }).video_cover_timestamp_ms, 1234);
    assert.throws(() => modul.zlozPost({ tiktok_widocznosc: "bledna" }));
    assert.throws(() => modul.podzielPlik(0));
  });
  await test("tlumaczenie bledow bez ujawnienia odpowiedzi", () => {
    assert.equal(modul.tlumaczBlad("access_token_invalid"), "TikTok wylogował aplikację, połącz ponownie");
    assert.equal(modul.tlumaczBlad("rate_limit_exceeded"), "limit TikToka, spróbuj za chwilę");
    assert.equal(modul.tlumaczBlad("unaudited_client_can_only_post_to_private_accounts"), "aplikacja przed audytem: ustaw widoczność Tylko ja");
    assert.ok(!modul.tlumaczBlad("TAJNY_TOKEN").includes("TAJNY_TOKEN"));
  });
  await test("callback, verifier, zapis konta i odrzucenie powtorki", async () => {
    const s = srodowisko();
    const url = new URL(s.t.budujOAuth(s.n));
    s.odpowiedzi.push({ dane: { access_token: "TAJNY_ACCESS", refresh_token: "TAJNY_REFRESH", open_id: "konto1", expires_in: 3600, refresh_expires_in: 86400 }, sprawdz(zapis) {
      const pola = new URLSearchParams(zapis.cialo);
      assert.equal(pola.get("grant_type"), "authorization_code");
      assert.match(pola.get("code_verifier"), /^[\w-]{43}$/);
      assert.equal(modul.wyzwaniePKCE(pola.get("code_verifier")), url.searchParams.get("code_challenge"));
    } }, { dane: { error: { code: "ok" }, data: { user: { open_id: "konto1", display_name: "Kuba", avatar_url: "https://example.com/avatar" } } } });
    const adres = "callback?code=kod&state=" + url.searchParams.get("state");
    assert.equal((await s.trasa(adres)).kod, 200);
    assert.equal(s.pliki.get(s.plikTokenu).konto.nazwa, "Kuba");
    const stan = (await s.trasa("stan")).dane;
    assert.equal(stan.polaczony, true);
    assert.ok(!JSON.stringify(stan).includes("TAJNY"));
    assert.equal((await s.trasa(adres)).kod, 400);
    assert.equal(s.wywolania.length, 2);
    await s.trasa("rozlacz", "POST");
    assert.equal((await s.trasa("stan")).dane.polaczony, false);
  });
  await test("wygasly i obcy state bez transportu", async () => {
    const s = srodowisko();
    const url = new URL(s.t.budujOAuth(s.n));
    assert.equal((await s.trasa("callback?code=x&state=obcy")).kod, 400);
    s.przesunCzas(600001);
    assert.equal((await s.trasa("callback?code=x&state=" + url.searchParams.get("state"))).kod, 400);
    assert.equal(s.wywolania.length, 0);
  });
  await test("upload strumieniem, zakresy i polling do sukcesu", async () => {
    const s = srodowisko();
    s.zapiszToken();
    s.ustawRozmiar(64 * MB + 1);
    s.odpowiedzi.push({ dane: { data: { upload_url: "https://open-upload.tiktokapis.com/video/?podpis=x", publish_id: "publikacja1" } } });
    for (let i = 0; i < 7; i++) s.odpowiedzi.push({ kod: 201 });
    s.odpowiedzi.push({ dane: { data: { status: "PROCESSING_UPLOAD" } } }, { dane: { data: { status: "PUBLISH_COMPLETE" } } });
    const statusy = [];
    const wynik = await s.t.opublikujNaTikToku(s.n, { plik: "film.mp4", opis: "Sylwetka" }, (...args) => statusy.push(args));
    assert.equal(wynik.publish_id, "publikacja1");
    assert.equal(wynik.widocznosc, "SELF_ONLY");
    const wysylki = s.wywolania.filter((w) => w.method === "PUT");
    const zakresy = modul.podzielPlik(64 * MB + 1).kawalki;
    wysylki.forEach((w, i) => {
      assert.equal(w.headers.Authorization, undefined);
      assert.equal(w.headers["Content-Length"], w.bajty);
      assert.equal(w.headers["Content-Range"], "bytes " + zakresy[i].od + "-" + zakresy[i].do + "/" + (64 * MB + 1));
    });
    assert.match(statusy.at(-1)[1], /widoczne tylko dla Ciebie/);
  });
  await test("odswiezenie i rotacja tokenow", async () => {
    const s = srodowisko();
    s.zapiszToken({ wygasa: new Date(0).toISOString() });
    s.odpowiedzi.push({ dane: { access_token: "NOWY_ACCESS", refresh_token: "NOWY_REFRESH", open_id: "konto1", expires_in: 3600, refresh_expires_in: 86400 }, sprawdz(w) {
      assert.equal(new URLSearchParams(w.cialo).get("grant_type"), "refresh_token");
    } }, { dane: { error: { code: "rate_limit_exceeded" } } });
    await assert.rejects(s.t.opublikujNaTikToku(s.n, { plik: "film" }), /limit TikToka/);
    assert.equal(s.pliki.get(s.plikTokenu).refresh_token, "NOWY_REFRESH");
    assert.equal(s.wywolania[1].headers.Authorization, "Bearer NOWY_ACCESS");
  });
  await test("rozlaczenie podczas odswiezania nie odtwarza tokena", async () => {
    const s = srodowisko();
    s.zapiszToken({ wygasa: new Date(0).toISOString() });
    s.odpowiedzi.push({ dane: { access_token: "NOWY", refresh_token: "NOWY_REFRESH", open_id: "konto1", expires_in: 3600, refresh_expires_in: 86400 }, sprawdz() { void s.trasa("rozlacz", "POST"); } });
    await assert.rejects(s.t.opublikujNaTikToku(s.n, { plik: "film" }), /zmienione/);
    assert.equal(s.pliki.has(s.plikTokenu), false);
  });
  for (const przypadek of ["obcy adres", "blad dysku", "FAILED", "limit 5 minut"]) {
    await test(przypadek, async () => {
      const s = srodowisko();
      s.zapiszToken();
      s.odpowiedzi.push({ dane: { data: { publish_id: "p1", upload_url: przypadek === "obcy adres" ? "https://tiktokapis.com.obcy.test/upload" : "https://open-upload.tiktokapis.com/upload" } } });
      if (przypadek === "blad dysku") s.awaria();
      if (!["blad dysku", "obcy adres"].includes(przypadek)) {
        s.odpowiedzi.push({ kod: 201 });
        for (let i = 0; i < 60; i++) s.odpowiedzi.push({ dane: { data: przypadek === "FAILED" ? { status: "FAILED", fail_reason: "video_duration_not_allowed" } : { status: "PROCESSING_UPLOAD" } } });
      }
      const wzorzec = { "obcy adres": /adres wysyłki/, "blad dysku": /odczytać pliku/, FAILED: /za długi/, "limit 5 minut": /5 minut/ }[przypadek];
      await assert.rejects(s.t.opublikujNaTikToku(s.n, { plik: "film" }), wzorzec);
      assert.equal(s.wywolania.filter((w) => w.adres.includes("video/init")).length, 1);
    });
  }
  console.log("OK: " + liczba + " testow offline");
}

main().catch((blad) => { console.error("ROZNICA:", blad.message); process.exitCode = 1; });
