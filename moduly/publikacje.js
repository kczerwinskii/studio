"use strict";

// Zakladka Publikacje: kolejka rolek do wyslania na Instagram prosto z pliku na dysku.
// Instagram Graph API, "resumable upload" dla rolek:
//   1. POST /{ig_id}/media?media_type=REELS&upload_type=resumable  -> { id: kontener, uri }
//   2. POST uri z naglowkami Authorization: OAuth <token>, offset: 0, file_size: N, cialo = bajty pliku
//   3. GET /{kontener}?fields=status_code,status  az bedzie FINISHED (albo ERROR / EXPIRED)
//   4. POST /{ig_id}/media_publish?creation_id={kontener} -> { id: media }
// Harmonogram: co minute sprawdza kolejke i wysyla to, czego termin minal (dziala, gdy Studio jest otwarte).

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");
let opublikujNaYouTube, opublikujNaTikToku;
try { ({ opublikujNaYouTube } = require("./youtube")); } catch {}
try { ({ opublikujNaTikToku } = require("./tiktok")); } catch {}

// Wstrzykiwanie atrap bez uruchamiania transportu w testach offline.
function _ustawPublikatorow(p) {
  if (p.instagram) opublikujRolke = p.instagram;
  if (p.facebook) opublikujNaFacebooku = p.facebook;
  if (p.youtube) opublikujNaYouTube = p.youtube;
  if (p.tiktok) opublikujNaTikToku = p.tiktok;
}

function stanPlatform(n, platforma) {
  const d = n.czytajJson(path.join(n.sciezki.config, platforma + "_token.json"), {}) || {};
  if (platforma === "youtube") return { polaczony: !!d.refresh_token,
    kanal: d.kanal ? { id: d.kanal.id, tytul: d.kanal.tytul } : null };
  return { polaczony: !!d.refresh_token && Date.parse(d.refresh_wygasa) > Date.now(),
    konto: d.konto ? { open_id: d.konto.open_id, nazwa: d.konto.nazwa } : null };
}

const GRAPH = "https://graph.facebook.com/v25.0";
let harmonogram = null;
let wysylanie = null; // id pozycji, ktora wlasnie leci (jedna naraz)

function plikKolejki(n) {
  return path.join(n.sciezki.dane, "publikacje.json");
}

function katalogPlikow(n) {
  return path.join(n.sciezki.dane, "publikacje");
}

function wczytaj(n) {
  const d = n.czytajJson(plikKolejki(n), { pozycje: [] });
  if (!Array.isArray(d.pozycje)) d.pozycje = [];
  return d;
}

function bladHttp(kod, tekst) {
  return Object.assign(new Error(tekst), { http: kod });
}

// Synchroniczna transakcja: zadne await nie rozdziela odczytu od zapisu.
function zmien(n, id, fn) {
  const d = wczytaj(n);
  const p = id == null ? null : d.pozycje.find((x) => x.id === id);
  if (id != null && !p) throw bladHttp(404, "Nie ma takiej pozycji");
  if (fn.constructor.name === "AsyncFunction") throw new Error("Zmiana kolejki musi być synchroniczna");
  const wynik = fn(p, d);
  if (wynik && typeof wynik.then === "function") throw new Error("Zmiana kolejki musi być synchroniczna");
  n.zapiszJson(plikKolejki(n), d);
  return p;
}

function sprawdzEdycje(p) {
  if (p.status === "wysylanie" || p.status === "opublikowane" || p.instagram?.media_id || p.niepewna)
    throw bladHttp(409, "Ta pozycja jest wysyłana, opublikowana lub wymaga sprawdzenia wyniku.");
}

function bezpiecznyBlad(e) {
  // Zewnetrzne odpowiedzi moga zawierac token lub adres z sekretem.
  return String(e.message || e).replace(/https?:\/\/[^\s]+/g, "[adres]")
    .replace(/(access_token|authorization|token)[\s:=]+[^\s,;]+/gi, "$1 [ukryto]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[ukryto]").slice(0, 600);
}

function nowyId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function bezpiecznaNazwa(nazwa) {
  return (nazwa || "plik").replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]+/g, "_").slice(0, 120);
}

function dlugoscPliku(sciezka) {
  return new Promise((resolve) => {
    execFile("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sciezka], { timeout: 30000 }, (err, out) => {
      const s = parseFloat(String(out).trim());
      resolve(!err && Number.isFinite(s) ? Math.round(s * 10) / 10 : null);
    });
  });
}

// ---------- klatki do wyboru okladki ----------

function katalogKlatek(n) {
  return path.join(n.sciezki.dane, "publikacje", "klatki");
}

function wytnijKlatke(plik, sekunda, docelowy) {
  return new Promise((resolve) => {
    execFile(
      "ffmpeg",
      ["-y", "-v", "error", "-ss", String(sekunda), "-i", plik, "-frames:v", "1", "-vf", "scale=216:-2", "-q:v", "4", docelowy],
      { timeout: 30000 },
      (err) => resolve(!err && fs.existsSync(docelowy))
    );
  });
}

async function klatkiPozycji(n, pozycja, ile = 8) {
  const kat = katalogKlatek(n);
  fs.mkdirSync(kat, { recursive: true });
  const dl = pozycja.dlugosc || (await dlugoscPliku(pozycja.plik)) || 10;
  const klatki = [];
  for (let i = 0; i < ile; i++) {
    const sekunda = Math.round(((i + 0.5) * dl) / ile * 10) / 10;
    const docelowy = path.join(kat, pozycja.id + "_" + i + ".jpg");
    if (!fs.existsSync(docelowy)) {
      const tmp = path.join(kat, pozycja.id + "_" + nowyId() + ".jpg");
      try {
        const gotowa = await wytnijKlatke(pozycja.plik, sekunda, tmp);
        if (!wczytaj(n).pozycje.some((p) => p.id === pozycja.id)) return [];
        if (gotowa && !fs.existsSync(docelowy)) fs.renameSync(tmp, docelowy);
      } finally { usunLokalny(n, tmp); }
    }
    if (fs.existsSync(docelowy)) klatki.push({ n: i, sekunda, url: "/api/publikacje/klatka?id=" + pozycja.id + "&n=" + i });
  }
  return klatki;
}

// ---------- wysylka na Instagram ----------

// Jeden transport dla wszystkich zapisow i odczytow Meta: timeout, limit i zamykanie strumieni.
function zadanieMeta(opcje, cialo, plik) {
  return new Promise((resolve, reject) => {
    let req, res, strumien, koniec = false;
    const timer = setTimeout(() => zakoncz(new Error("Przekroczono czas połączenia z Meta.")), 10 * 60 * 1000);
    function zakoncz(blad, dane) {
      if (koniec) return;
      koniec = true; clearTimeout(timer);
      if (strumien) strumien.destroy();
      if (blad) { if (req) req.destroy(); if (res) res.destroy(); reject(blad); }
      else resolve(dane);
    }
    try {
      req = https.request(opcje, (odpowiedz) => {
        res = odpowiedz;
        let tekst = "";
        res.setEncoding("utf8");
        res.on("error", (e) => zakoncz(e));
        res.on("aborted", () => zakoncz(new Error("Połączenie z Meta przerwano podczas odbioru odpowiedzi.")));
        res.on("close", () => { if (!res.complete) zakoncz(new Error("Niepełna odpowiedź Meta.")); });
        res.on("data", (k) => {
          tekst += k;
          if (tekst.length > 2 * 1024 * 1024) zakoncz(new Error("Odpowiedź Meta jest zbyt duża."));
        });
        res.on("end", () => {
          try {
            const dane = JSON.parse(tekst);
            if (res.statusCode < 200 || res.statusCode >= 300 || dane.error || dane.success === false)
              return zakoncz(new Error("Meta odrzuciła żądanie (HTTP " + res.statusCode + "). Sprawdź uprawnienia i plik."));
            zakoncz(null, dane);
          } catch { zakoncz(new Error("Niepoprawna odpowiedź Meta (HTTP " + res.statusCode + ").")); }
        });
      });
      req.on("error", (e) => zakoncz(e));
      req.setTimeout(60000, () => zakoncz(new Error("Brak odpowiedzi Meta przez 60 sekund.")));
      if (plik) {
        strumien = fs.createReadStream(plik);
        strumien.on("error", () => zakoncz(new Error("Nie można odczytać pliku podczas wysyłki.")));
        strumien.pipe(req);
      } else req.end(cialo);
    } catch (e) { zakoncz(e); }
  });
}

function graphGet(n, sciezka, parametry, token) {
  const zapytanie = new URLSearchParams(parametry).toString();
  return zadanieMeta({ method: "GET", hostname: "graph.facebook.com", path: "/v25.0" + sciezka + "?" + zapytanie,
    headers: { Authorization: "Bearer " + token } });
}

function wyslijBajty(uri, token, sciezka) {
  const u = new URL(uri);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") ||
      !(u.hostname === "facebook.com" || u.hostname.endsWith(".facebook.com") || u.hostname.endsWith(".fbcdn.net")))
    throw new Error("Meta zwróciła niedozwolony adres wysyłki.");
  const rozmiar = fs.statSync(sciezka).size;
  return zadanieMeta({ method: "POST", hostname: u.hostname, path: u.pathname + u.search,
    headers: { Authorization: "OAuth " + token, offset: "0", file_size: String(rozmiar),
      "Content-Type": "application/octet-stream", "Content-Length": String(rozmiar) } }, null, sciezka);
}

function graphPost(sciezka, parametry, token) {
  const cialo = new URLSearchParams(parametry).toString();
  return zadanieMeta({ method: "POST", hostname: "graph.facebook.com", path: "/v25.0" + sciezka,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(cialo) } }, cialo);
}

const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Facebook: token strony, hosting okladki, rolki na stronie ----------

function plikTokenuStrony(n) {
  return path.join(n.sciezki.config, "meta_page_token.json");
}

async function tokenStrony(n, odswiez) {
  const zapisany = n.czytajJson(plikTokenuStrony(n), null);
  const ust = n.ustawienia();
  if (zapisany && zapisany.token && zapisany.strona_id === ust.strona_id && !odswiez) return zapisany;
  const token = n.token();
  if (!token) throw new Error("Brak tokena użytkownika");
  if (!ust.strona_id) throw new Error("Wybierz stronę Facebooka w Ustawieniach.");
  let strona, po = null;
  const widziane = new Set();
  do {
    const json = await graphGet(n, "/me/accounts", { fields: "id,name,access_token", ...(po ? { after: po } : {}) }, token);
    strona = (json.data || []).find((s) => s.id === ust.strona_id);
    if (strona) break;
    po = json.paging?.next ? json.paging?.cursors?.after : null;
    if (po && widziane.has(po)) throw new Error("Meta powtórzyła stronę wyników.");
    if (po) widziane.add(po);
  } while (po);
  if (!strona?.access_token) throw new Error("Brak dostępu do wskazanej strony Facebooka. Sprawdź konto i uprawnienia.");
  const dane = { token: strona.access_token, strona_id: strona.id, strona: strona.name, pobrano: new Date().toISOString() };
  n.zapiszJson(plikTokenuStrony(n), dane);
  return dane;
}

let uprawnieniaCache = { czas: 0, lista: [] };
async function uprawnienia(n) {
  if (Date.now() - uprawnieniaCache.czas < 10 * 60 * 1000) return uprawnieniaCache.lista;
  const token = n.token();
  if (!token) return [];
  try {
    const json = await graphGet(n, "/me/permissions", {}, token);
    uprawnieniaCache = { czas: Date.now(), lista: (json.data || []).filter((u) => u.status === "granted").map((u) => u.permission) };
  } catch {
    uprawnieniaCache = { czas: Date.now(), lista: [] };
  }
  return uprawnieniaCache.lista;
}

async function facebookDostepny(n) {
  const u = await uprawnienia(n);
  return u.includes("pages_manage_posts") && u.includes("pages_show_list");
}

// Wysylka multipart (plik z dysku) na Graph API, bez zaleznosci.
function graphMultipart(sciezka, pola, plik, nazwaPola, token) {
  return new Promise((resolve, reject) => {
    const granica = "----StudioGranica" + Date.now().toString(36);
    const czesci = [];
    for (const [k, v] of Object.entries({ ...pola, access_token: token })) {
      czesci.push(Buffer.from("--" + granica + "\r\nContent-Disposition: form-data; name=\"" + k + "\"\r\n\r\n" + v + "\r\n"));
    }
    const typ = /\.png$/i.test(plik) ? "image/png" : "image/jpeg";
    czesci.push(Buffer.from("--" + granica + "\r\nContent-Disposition: form-data; name=\"" + nazwaPola + "\"; filename=\"" + path.basename(plik) + "\"\r\nContent-Type: " + typ + "\r\n\r\n"));
    if (fs.statSync(plik).size > 20 * 1024 * 1024) return reject(new Error("Okładka jest zbyt duża."));
    czesci.push(fs.readFileSync(plik));
    czesci.push(Buffer.from("\r\n--" + granica + "--\r\n"));
    const cialo = Buffer.concat(czesci);
    if (cialo.length > 25 * 1024 * 1024) return reject(new Error("Okładka jest zbyt duża."));
    zadanieMeta({ method: "POST", hostname: "graph.facebook.com", path: "/v25.0" + sciezka,
      headers: { "Content-Type": "multipart/form-data; boundary=" + granica, "Content-Length": cialo.length } }, cialo).then(resolve, reject);
  });
}

function doJpg(zrodlo, docelowy) {
  return new Promise((resolve) => {
    execFile("ffmpeg", ["-y", "-v", "error", "-i", zrodlo, "-vf", "scale='min(1080,iw)':-2", "-q:v", "2", docelowy], { timeout: 30000 }, (err) =>
      resolve(!err && fs.existsSync(docelowy) ? docelowy : null)
    );
  });
}

// Instagram wymaga adresu okladki w sieci: wrzucamy ja jako NIEPUBLIKOWANE zdjecie na stronie Kuby
// na Facebooku, bierzemy adres z CDN, a po publikacji rolki kasujemy zdjecie.
async function hostujOkladke(n, pozycja) {
  const ts = await tokenStrony(n);
  let plik = pozycja.okladka_plik;
  let konwersja = null;
  try {
    if (!/\.jpe?g$/i.test(plik)) {
      const jpg = plik.replace(/\.[^.]+$/, "") + "_jpg.jpg";
      konwersja = jpg;
      plik = (await doJpg(plik, jpg)) || plik;
    }
    const zdj = await graphMultipart("/" + ts.strona_id + "/photos", { published: "false", caption: "okładka rolki (Studio)" }, plik, "source", ts.token);
    if (!zdj.id) throw new Error("Facebook nie przyjął okładki");
    zmien(n, pozycja.id, (p) => { p.okladka_zdjecie_id = zdj.id; });
    const info = await graphGet(n, "/" + zdj.id, { fields: "images" }, ts.token);
    const obrazy = (info.images || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0));
    if (!obrazy.length || !obrazy[0].source) throw new Error("Facebook nie oddał adresu okładki");
    return { url: obrazy[0].source, zdjecie_id: zdj.id, token: ts.token };
  } finally { if (konwersja) usunLokalny(n, konwersja); }
}

async function usunZdjecie(n, zdjecie_id, token) {
  const wynik = await zadanieMeta({ method: "DELETE", hostname: "graph.facebook.com", path: "/v25.0/" + zdjecie_id,
    headers: { Authorization: "Bearer " + token } });
  if (wynik !== true && wynik.success !== true) throw new Error("Meta nie potwierdziła usunięcia tymczasowej okładki.");
}

const wyslijBajtyFb = wyslijBajty;

// Rolka na stronie Facebooka (Reels API): start -> wysylka bajtow -> finish (PUBLISHED).
async function opublikujNaFacebooku(n, pozycja, ustawStatus) {
  const ts = await tokenStrony(n);
  ustawStatus("facebook", "Facebook: zaczynam wysyłkę");
  const start = await graphPost("/" + ts.strona_id + "/video_reels", { upload_phase: "start" }, ts.token);
  if (!start.video_id || !start.upload_url) throw new Error("Facebook nie otworzył wysyłki rolki");
  zmien(n, pozycja.id, (p) => { p.facebook_video_id = start.video_id; });
  ustawStatus("facebook", "Facebook: wysyłam plik");
  await wyslijBajtyFb(start.upload_url, ts.token, pozycja.plik);
  ustawStatus("facebook", "Facebook: publikuję");
  const opis = (pozycja.opis || "").trim();
  zmien(n, pozycja.id, (p) => { p.niepewna = "facebook"; });
  const wynik = await graphPost(
    "/" + ts.strona_id + "/video_reels",
    { upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description: opis },
    ts.token
  );
  if (wynik.success !== true) throw new Error("Facebook nie opublikował rolki");
  const fb = { video_id: start.video_id, link: "https://www.facebook.com/reel/" + start.video_id };
  zmien(n, pozycja.id, (p) => { p.facebook_wynik = fb; p.niepewna = null; });
  return fb;
}

function parametryKontenera(pozycja, okladka) {
  const parametry = {
    media_type: "REELS",
    upload_type: "resumable",
    caption: pozycja.opis || "",
    share_to_feed: pozycja.do_feedu === false ? "false" : "true",
  };
  if (!okladka && pozycja.okladka_s != null && pozycja.okladka_s !== "") parametry.thumb_offset = String(Math.round(Number(pozycja.okladka_s) * 1000));
  if (okladka) parametry.cover_url = okladka.url;
  // rolka probna (trial reel): trafia tylko do nieobserwujacych; MANUAL = Kuba sam przenosi ja
  // do obserwujacych w aplikacji, SS_PERFORMANCE = Instagram robi to sam, gdy dobrze idzie
  if (pozycja.probna) {
    parametry.trial_params = JSON.stringify({
      graduation_strategy: pozycja.probna_status === "SS_PERFORMANCE" ? "SS_PERFORMANCE" : "MANUAL",
    });
  }
  return parametry;
}

async function opublikujRolke(n, pozycja, ustawStatus, tylkoTest) {
  const token = n.token();
  const ust = n.ustawienia();
  if (!token) throw new Error("Brak tokena. Wklej go w Ustawieniach.");
  if (!ust.ig_id) throw new Error("Brak identyfikatora konta Instagram. Otwórz Ustawienia i sprawdź token.");
  if (!pozycja.plik || !fs.existsSync(pozycja.plik)) throw new Error("Nie ma pliku wideo: " + pozycja.plik);

  let okladka = null;
  try {
    if (pozycja.okladka_plik && fs.existsSync(pozycja.okladka_plik)) {
      ustawStatus("okladka", "Wrzucam okładkę na stronę Facebooka");
      try {
        okladka = await hostujOkladke(n, pozycja);
      } catch (e) {
        throw new Error("Własna okładka nie przeszła: " + e.message + ". Wybierz kadr z filmu albo podepnij Facebooka w Ustawieniach.");
      }
    }

    ustawStatus("kontener", "Tworzę kontener na Instagramie");
    const parametry = parametryKontenera(pozycja, okladka);
    const kontener = await graphPost("/" + ust.ig_id + "/media", parametry, token);
    if (!kontener.id || !kontener.uri) throw new Error("Meta nie zwróciła kontenera do wysyłki");
    zmien(n, pozycja.id, (p) => { p.instagram_kontener = kontener.id; });

    ustawStatus("wysylka", "Wysyłam plik");
    await wyslijBajty(kontener.uri, token, pozycja.plik);

    ustawStatus("przetwarzanie", "Instagram przetwarza wideo");
    let status = "";
    for (let i = 0; i < 60; i++) {
      await czekaj(5000);
      const s = await graphGet(n, "/" + kontener.id, { fields: "status_code,status" }, token);
      status = s.status_code;
      if (status === "FINISHED") break;
      if (status === "ERROR" || status === "EXPIRED") throw new Error("Instagram odrzucił wideo: " + (s.status || status));
      ustawStatus("przetwarzanie", "Instagram przetwarza wideo (" + (i + 1) * 5 + " s)");
    }
    if (status !== "FINISHED") throw new Error("Instagram nie skończył przetwarzać wideo w 5 minut, spróbuj ponownie");

    if (tylkoTest) {
      return { kontener: kontener.id, test: true, okladka: !!okladka };
    }

    ustawStatus("publikacja", "Publikuję");
    zmien(n, pozycja.id, (p) => { p.niepewna = "instagram"; });
    const wynik = await graphPost("/" + ust.ig_id + "/media_publish", { creation_id: kontener.id }, token);
    if (!wynik.id) throw new Error("Brak potwierdzenia identyfikatora opublikowanej rolki.");
    zmien(n, pozycja.id, (p) => { p.instagram = { media_id: wynik.id, permalink: null }; p.niepewna = null; });
    let permalink = null;
    try {
      const m = await graphGet(n, "/" + wynik.id, { fields: "permalink" }, token);
      permalink = m.permalink || null;
    } catch {}
    return { kontener: kontener.id, media_id: wynik.id, permalink };
  } finally {
    const p = wczytaj(n).pozycje.find((x) => x.id === pozycja.id);
    if (p?.okladka_zdjecie_id) {
      try {
        const ts = await tokenStrony(n);
        await usunZdjecie(n, p.okladka_zdjecie_id, ts.token);
        zmien(n, p.id, (x) => { x.okladka_zdjecie_id = null; x.okladka_sprzatanie_blad = null; });
      } catch (e) {
        zmien(n, p.id, (x) => { x.okladka_sprzatanie_blad = bezpiecznyBlad(e); });
      }
    }
  }
}

function wyslij(n, id, tylkoTest) {
  if (wysylanie) throw bladHttp(409, "Trwa już wysyłka rolki, poczekaj.");
  const poz = zmien(n, id, (p) => {
    if (p.status === "wysylanie" || p.niepewna)
      throw bladHttp(409, "Sprawdź wynik poprzedniej wysyłki na platformie. Ponowienie zablokowane, aby uniknąć duplikatu.");
    if (p.instagram?.media_id && (tylkoTest || !p.facebook || p.facebook_wynik))
      throw bladHttp(409, "Ta rolka jest już opublikowana.");
    if (p.status === "opublikowane" && !p.instagram?.media_id)
      throw bladHttp(409, "Ta rolka jest już opublikowana.");
    p.status_przed_testem = p.status;
    p.status = "wysylanie";
    p.blad = null;
  });
  wysylanie = id;
  return wykonajWysylke(n, poz, tylkoTest);
}

async function wykonajWysylke(n, poz, tylkoTest) {
  const ustawStatus = (etap, opis) => zmien(n, poz.id, (p) => {
    p.etap = etap; p.etap_opis = opis;
  });
  try {
    const wynik = poz.instagram?.media_id ? poz.instagram : await opublikujRolke(n, poz, ustawStatus, tylkoTest);
    zmien(n, poz.id, (p) => {
      if (tylkoTest) {
        p.status = p.status_przed_testem;
        p.test_kontener = wynik.kontener;
        p.test_wynik = { ok: true, czas: new Date().toISOString() };
        p.etap_opis = "Test przeszedł: plik przyjęty i przetworzony, nie opublikowano";
      } else {
        p.instagram = { media_id: wynik.media_id, permalink: wynik.permalink };
        p.opublikowano = p.opublikowano || new Date().toISOString();
      }
      p.etap = null;
    });
    if (!tylkoTest) {
      for (const [platforma, publikator] of [["facebook", opublikujNaFacebooku], ["youtube", opublikujNaYouTube], ["tiktok", opublikujNaTikToku]]) {
        // Ponowienie samego FB nie powtarza zakonczonych ani niepewnych wysylek.
        if (poz.instagram?.media_id && platforma !== "facebook") continue;
        if (!poz[platforma] || poz[platforma + "_wynik"] || poz[platforma + "_proba"]) continue;
        try {
          if (!publikator) throw new Error("Brak modułu publikacji: " + platforma);
          if (platforma !== "facebook") zmien(n, poz.id, (p) => { p[platforma + "_proba"] = true; });
          const wynikPlatformy = await publikator(n, poz, ustawStatus);
          zmien(n, poz.id, (p) => { p[platforma + "_wynik"] = wynikPlatformy; p["blad_" + platforma] = null; });
        } catch (e) {
          zmien(n, poz.id, (p) => {
            p["blad_" + platforma] = bezpiecznyBlad(e) + " Sprawdź wynik na platformie przed ponowną publikacją.";
          });
        }
      }
    }
    if (!tylkoTest) zmien(n, poz.id, (p) => {
      p.status = "opublikowane"; p.etap = null; p.etap_opis = null; p.blad = null;
    });
    return wynik;
  } catch (e) {
    zmien(n, poz.id, (p) => {
      p.status = "blad";
      if (tylkoTest) p.test_wynik = { ok: false, czas: new Date().toISOString() };
      p.blad = (p.instagram?.media_id ? "Instagram OK. " : "") + bezpiecznyBlad(e)
        + (p.niepewna ? " Wynik wysyłki jest niepewny. Sprawdź platformę przed dalszym działaniem." : " Pozycja pozostaje w kolejce do ponowienia.");
      p.etap = null; p.etap_opis = null;
    });
    throw e;
  } finally { wysylanie = null; }
}

function odzyskaj(n) {
  zmien(n, null, (_, d) => {
    for (const p of d.pozycje) if (p.status === "wysylanie") {
      if (p.instagram?.media_id) {
        for (const platforma of ["facebook", "youtube", "tiktok"]) {
          if (p[platforma] && !p[platforma + "_wynik"])
            p["blad_" + platforma] = "Studio przerwano. Sprawdź wynik na platformie przed ponowną publikacją.";
        }
        if (p.etap === "facebook" && !p.facebook_wynik) p.niepewna = "facebook";
        p.status = "opublikowane"; p.blad = null; p.etap = null; p.etap_opis = null;
        continue;
      }
      // Starsze wersje nie zapisywaly flagi niepewnego wyniku.
      if (!p.niepewna && p.etap === "publikacja" && !p.instagram?.media_id) p.niepewna = "instagram";
      if (!p.niepewna && p.etap === "facebook" && !p.facebook_wynik) p.niepewna = "facebook";
      p.status = "blad";
      p.blad = p.niepewna ? "Studio przerwano podczas publikowania. Sprawdź wynik na platformie; ponowienie zablokowane."
        : "Studio przerwano podczas wysyłki. Możesz ponowić pozycję.";
      p.etap = null; p.etap_opis = null;
    }
  });
}

// ---------- harmonogram ----------

function uruchomHarmonogram(n) {
  if (harmonogram) return;
  odzyskaj(n);
  harmonogram = setInterval(async () => {
    try {
      if (wysylanie) return;
      const d = wczytaj(n);
      const teraz = Date.now();
      const gotowa = d.pozycje.filter((p) => p.status === "zaplanowane" && p.termin && new Date(p.termin).getTime() <= teraz)
        .sort((a, b) => new Date(a.termin) - new Date(b.termin))[0];
      if (gotowa) {
        try {
          await wyslij(n, gotowa.id, false);
        } catch {
          /* blad zapisany przy pozycji */
        }
      }
    } catch { /* Blad odczytu nie zatrzymuje nastepnego obiegu. */ }
  }, 60000);
}

// ---------- HTTP ----------

function usunLokalny(n, plik) {
  if (!plik) return;
  const wzgledna = path.relative(path.resolve(katalogPlikow(n)), path.resolve(plik));
  if (!wzgledna || wzgledna.startsWith("..") || path.isAbsolute(wzgledna)) return;
  try { fs.unlinkSync(plik); } catch (e) { if (e.code !== "ENOENT") throw e; }
}

function czytajPlik(req, docelowy, limit = 1024 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(docelowy), { recursive: true });
    const tmp = docelowy + "." + nowyId() + ".tmp";
    const strumien = fs.createWriteStream(tmp, { flags: "wx" });
    let bajty = 0, blad = null;
    const timer = setTimeout(() => przerwij(new Error("Przekroczono czas wgrywania pliku.")), 10 * 60 * 1000);
    function przerwij(e) {
      if (blad) return;
      blad = e; req.unpipe(strumien); strumien.destroy(); req.resume();
    }
    req.on("data", (k) => { bajty += k.length; if (bajty > limit) przerwij(bladHttp(413, "Plik przekracza dozwolony rozmiar.")); });
    req.on("error", przerwij);
    req.on("aborted", () => przerwij(new Error("Wgrywanie pliku przerwano.")));
    strumien.on("error", przerwij);
    strumien.on("close", () => {
      clearTimeout(timer);
      try {
        if (blad || !bajty || !strumien.writableFinished) {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          reject(blad || bladHttp(400, "Plik jest pusty albo niekompletny."));
        } else { fs.renameSync(tmp, docelowy); resolve(bajty); }
      } catch (e) { try { fs.unlinkSync(tmp); } catch {} reject(e); }
    });
    req.pipe(strumien);
  });
}

async function obsluz(req, res, url, n) {
  const sc = url.pathname;
  if (!sc.startsWith("/api/publikacje")) return false;
  try {
    uruchomHarmonogram(n);
    if (req.method === "GET" && sc === "/api/publikacje") {
      const d = wczytaj(n);
      let fb = { dostepny: false, strona: null };
      try {
        if (await facebookDostepny(n)) {
          const ts = await tokenStrony(n);
          fb = { dostepny: true, strona: ts.strona };
        }
      } catch {
        fb = { dostepny: false, strona: null };
      }
      return n.odpowiedzJson(res, 200, { pozycje: wczytaj(n).pozycje, wysylanie, facebook: fb,
        youtube: stanPlatform(n, "youtube"), tiktok: stanPlatform(n, "tiktok") }) || true;
    }
    // PUT /api/publikacje/plik?nazwa=rolka.mp4  (cialo = surowe bajty pliku)
    if (req.method === "PUT" && sc === "/api/publikacje/plik") {
      const nazwa = bezpiecznaNazwa(url.searchParams.get("nazwa"));
      if (!/\.(mp4|mov|m4v)$/i.test(nazwa)) {
        n.odpowiedzJson(res, 400, { blad: "Instagram przyjmuje rolki jako MP4 lub MOV" });
        return true;
      }
      const id = nowyId();
      const docelowy = path.join(katalogPlikow(n), id + "_" + nazwa);
      const bajty = await czytajPlik(req, docelowy);
      const dlugosc = await dlugoscPliku(docelowy);
      const pozycja = {
        id,
        plik: docelowy,
        nazwa,
        rozmiar: bajty,
        dlugosc,
        opis: "",
        okladka_s: null,
        do_feedu: true,
        termin: null,
        status: "szkic",
        dodano: new Date().toISOString(),
        blad: null,
      };
      zmien(n, null, (_, d) => d.pozycje.unshift(pozycja));
      n.odpowiedzJson(res, 200, { pozycja });
      return true;
    }
    if (req.method === "GET" && sc === "/api/publikacje/klatki") {
      const d = wczytaj(n);
      const p = d.pozycje.find((x) => x.id === url.searchParams.get("id"));
      if (!p) {
        n.odpowiedzJson(res, 404, { blad: "nie ma takiej pozycji" });
        return true;
      }
      n.odpowiedzJson(res, 200, { klatki: await klatkiPozycji(n, p) });
      return true;
    }
    if (req.method === "GET" && sc === "/api/publikacje/klatka") {
      const id = (url.searchParams.get("id") || "").replace(/[^a-z0-9]/gi, "");
      const nr = String(parseInt(url.searchParams.get("n"), 10) || 0);
      const plik = path.join(katalogKlatek(n), id + "_" + nr + ".jpg");
      if (!fs.existsSync(plik)) {
        res.writeHead(404);
        res.end();
        return true;
      }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" });
      fs.createReadStream(plik).on("error", () => res.destroy()).pipe(res);
      return true;
    }
    if (req.method === "GET" && sc === "/api/publikacje/okladka") {
      const d = wczytaj(n);
      const p = d.pozycje.find((x) => x.id === url.searchParams.get("id"));
      if (!p || !p.okladka_plik || !fs.existsSync(p.okladka_plik)) {
        res.writeHead(404);
        res.end();
        return true;
      }
      res.writeHead(200, { "Content-Type": /\.png$/i.test(p.okladka_plik) ? "image/png" : "image/jpeg", "Cache-Control": "no-store" });
      fs.createReadStream(p.okladka_plik).on("error", () => res.destroy()).pipe(res);
      return true;
    }
    // PUT /api/publikacje/okladka?id=...&nazwa=okladka.jpg  (wlasny obraz okladki)
    if (req.method === "PUT" && sc === "/api/publikacje/okladka") {
      const d = wczytaj(n);
      const p = d.pozycje.find((x) => x.id === url.searchParams.get("id"));
      if (!p) {
        n.odpowiedzJson(res, 404, { blad: "nie ma takiej pozycji" });
        return true;
      }
      const nazwa = bezpiecznaNazwa(url.searchParams.get("nazwa"));
      if (!/\.(jpe?g|png)$/i.test(nazwa)) {
        n.odpowiedzJson(res, 400, { blad: "Okładka musi być JPG albo PNG" });
        return true;
      }
      sprawdzEdycje(p);
      const docelowy = path.join(katalogPlikow(n), p.id + "_okladka_" + nowyId() + path.extname(nazwa).toLowerCase());
      await czytajPlik(req, docelowy, 20 * 1024 * 1024);
      let stara;
      let aktualna;
      try {
        aktualna = zmien(n, p.id, (poz) => {
          sprawdzEdycje(poz);
          stara = poz.okladka_plik;
          poz.okladka_plik = docelowy; poz.okladka_s = null;
        });
      } catch (e) { usunLokalny(n, docelowy); throw e; }
      usunLokalny(n, stara);
      n.odpowiedzJson(res, 200, { pozycja: aktualna });
      return true;
    }
    if (req.method === "POST" && sc === "/api/publikacje/zapisz") {
      const cialo = await n.czytajCialo(req);
      const p = zmien(n, cialo.id, (p) => {
        sprawdzEdycje(p);
        for (const pole of ["youtube", "tiktok"]) {
          if (pole in cialo && typeof cialo[pole] !== "boolean") throw bladHttp(400, "Platforma musi mieć wartość tak lub nie.");
        }
        if ("youtube_tytul" in cialo && (typeof cialo.youtube_tytul !== "string" || Array.from(cialo.youtube_tytul).length > 100))
          throw bladHttp(400, "Tytuł YouTube może mieć do 100 znaków.");
        if ("youtube_tagi" in cialo && (!Array.isArray(cialo.youtube_tagi) || cialo.youtube_tagi.some((tag) => typeof tag !== "string")))
          throw bladHttp(400, "Tagi YouTube muszą być tablicą tekstów.");
        for (const [pole, dozwolone] of [["youtube_prywatnosc", ["private", "unlisted", "public"]],
          ["tiktok_widocznosc", ["SELF_ONLY", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR"]]]) {
          if (pole in cialo && !dozwolone.includes(cialo[pole])) throw bladHttp(400, "Niepoprawna widoczność publikacji.");
        }
        for (const pole of ["youtube", "youtube_tytul", "youtube_tagi", "youtube_prywatnosc", "tiktok", "tiktok_widocznosc"])
          if (pole in cialo) p[pole] = cialo[pole];
        p.youtube_prywatnosc ??= "private";
        p.tiktok_widocznosc ??= "SELF_ONLY";
        if ("termin" in cialo && cialo.termin != null && cialo.termin !== "") {
          if (typeof cialo.termin !== "string" || !Number.isFinite(Date.parse(cialo.termin)) || Date.parse(cialo.termin) <= Date.now())
            throw bladHttp(400, "Podaj poprawny przyszły termin publikacji.");
        }
        if ("okladka_s" in cialo && cialo.okladka_s != null && cialo.okladka_s !== "" &&
          (!Number.isFinite(Number(cialo.okladka_s)) || Number(cialo.okladka_s) < 0)) throw bladHttp(400, "Niepoprawny czas okładki.");
        if (typeof cialo.opis === "string") p.opis = cialo.opis;
        if ("okladka_s" in cialo) p.okladka_s = cialo.okladka_s === "" || cialo.okladka_s == null ? null : Number(cialo.okladka_s);
        if ("do_feedu" in cialo) p.do_feedu = !!cialo.do_feedu;
        if ("probna" in cialo) p.probna = !!cialo.probna;
        if ("facebook" in cialo) p.facebook = !!cialo.facebook;
        if ("probna_status" in cialo) p.probna_status = cialo.probna_status || null;
        if (cialo.usun_okladke) {
          usunLokalny(n, p.okladka_plik);
          p.okladka_plik = null;
        }
        if ("termin" in cialo) {
          p.termin = cialo.termin || null;
          if (p.status !== "opublikowane") p.status = p.termin ? "zaplanowane" : "szkic";
        }
        p.blad = null;
      });
      n.odpowiedzJson(res, 200, { pozycja: p });
      return true;
    }
    if (req.method === "POST" && sc === "/api/publikacje/wyslij") {
      const { id, test } = await n.czytajCialo(req);
      wyslij(n, id, !!test).catch(() => {});
      n.odpowiedzJson(res, 202, { ok: true });
      return true;
    }
    if (req.method === "POST" && sc === "/api/publikacje/usun") {
      const { id } = await n.czytajCialo(req);
      const p = zmien(n, id, (p, d) => {
        if (p.status === "wysylanie") throw bladHttp(409, "Ta pozycja właśnie się wysyła.");
        d.pozycje = d.pozycje.filter((x) => x.id !== id);
      });
      usunLokalny(n, p.plik);
      usunLokalny(n, p.okladka_plik);
      for (const kat of [katalogPlikow(n), katalogKlatek(n)]) {
        if (fs.existsSync(kat)) for (const nazwa of fs.readdirSync(kat)) {
          if (nazwa.startsWith(p.id + "_") && fs.statSync(path.join(kat, nazwa)).isFile()) usunLokalny(n, path.join(kat, nazwa));
        }
      }
      n.odpowiedzJson(res, 200, { ok: true });
      return true;
    }
    n.odpowiedzJson(res, 404, { blad: "nie ma takiego adresu" });
    return true;
  } catch (e) {
    n.odpowiedzJson(res, e.http || 500, { blad: bezpiecznyBlad(e) });
    return true;
  }
}

module.exports = { obsluz, opublikujRolke, _ustawPublikatorow };
