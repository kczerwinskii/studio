"use strict";

// Serwer aplikacji Studio. Zero zaleznosci: http/https/fs/child_process.
// - serwuje app/ (index.html, style.css, app.js, fonty)
// - API pod /api/... : stan konta, pobieranie rolek z Graph API, notatki, ustawienia
// Uruchomienie testowe w przegladarce: node serwer.js 8767

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const GRAPH = "https://graph.facebook.com/v25.0";
const APP_ID = "1823206525790813";

let KATALOG = __dirname;
let PORT = null; // ustawiany po starcie serwera (moduly potrzebuja go np. do OAuth loopback)
const sciezki = () => ({
  app: path.join(KATALOG, "app"),
  config: path.join(KATALOG, "config"),
  dane: path.join(KATALOG, "dane"),
  token: path.join(KATALOG, "config", "meta_user_token.txt"),
  secret: path.join(KATALOG, "config", "meta_app_secret.txt"),
  ustawienia: path.join(KATALOG, "config", "ustawienia.json"),
  rolki: path.join(KATALOG, "dane", "rolki.json"),
  notatki: path.join(KATALOG, "dane", "notatki.json"),
  pary: path.join(KATALOG, "dane", "pary.json"),
  youtube_klient: path.join(KATALOG, "config", "youtube_klient.json"),
});

// ---------- pliki ----------

function czytajJson(plik, domyslne) {
  try {
    return JSON.parse(fs.readFileSync(plik, "utf8"));
  } catch {
    return domyslne;
  }
}

function zapiszJson(plik, dane) {
  fs.mkdirSync(path.dirname(plik), { recursive: true });
  const tmp = plik + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(dane, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, plik);
}

function czytajTekst(plik) {
  try {
    return fs.readFileSync(plik, "utf8").trim();
  } catch {
    return "";
  }
}

function zapiszTekst(plik, tekst) {
  fs.mkdirSync(path.dirname(plik), { recursive: true });
  fs.writeFileSync(plik, tekst.trim() + "\n", "utf8");
}

// ---------- Graph API ----------

function pobierzJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let dane = "";
        res.setEncoding("utf8");
        res.on("data", (k) => (dane += k));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(dane);
          } catch {
            return reject(new Error("Meta odpowiedziała nie-JSON-em (HTTP " + res.statusCode + ")"));
          }
          if (json.error) {
            const e = new Error(json.error.message || "błąd Graph API");
            e.kod = json.error.code;
            e.http = res.statusCode;
            return reject(e);
          }
          resolve(json);
        });
      })
      .on("error", reject);
  });
}

function graph(sciezka, parametry, token) {
  const p = new URLSearchParams({ ...parametry, access_token: token });
  return pobierzJson(GRAPH + sciezka + "?" + p.toString());
}

async function wszystkieStrony(sciezka, parametry, token, limitStron = 20) {
  let url = GRAPH + sciezka + "?" + new URLSearchParams({ ...parametry, access_token: token });
  const wynik = [];
  for (let i = 0; i < limitStron && url; i++) {
    const json = await pobierzJson(url);
    wynik.push(...(json.data || []));
    url = json.paging && json.paging.next;
  }
  return wynik;
}

function dlugoscWideo(url) {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url],
      { timeout: 60000 },
      (err, stdout) => {
        const s = parseFloat(String(stdout).trim());
        resolve(!err && Number.isFinite(s) && s > 0 ? Math.round(s * 10) / 10 : null);
      }
    );
  });
}

// ---------- token ----------

async function sprawdzToken(token) {
  // debug_token: token uzytkownika-dewelopera moze sprawdzic sam siebie
  const info = await graph("/debug_token", { input_token: token }, token);
  const d = info.data || {};
  return {
    wazny: !!d.is_valid,
    wazny_do: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
    uprawnienia: d.scopes || [],
  };
}

async function wymienNaDlugotrwaly(token, secret) {
  const json = await pobierzJson(
    GRAPH +
      "/oauth/access_token?" +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: APP_ID,
        client_secret: secret,
        fb_exchange_token: token,
      })
  );
  return { token: json.access_token, expires_in: json.expires_in || null };
}

async function kontoInstagram(token) {
  const json = await graph(
    "/me/accounts",
    { fields: "id,name,instagram_business_account{id,username,followers_count,media_count,profile_picture_url}" },
    token
  );
  const strona = (json.data || []).find((s) => s.instagram_business_account);
  if (!strona) throw new Error("Żadna z Twoich stron nie ma podpiętego konta Instagram");
  const ig = strona.instagram_business_account;
  return {
    strona_id: strona.id,
    strona: strona.name,
    ig_id: ig.id,
    username: ig.username,
    obserwujacy: ig.followers_count,
    media: ig.media_count,
    avatar: ig.profile_picture_url || null,
  };
}

// ---------- pobieranie rolek ----------

const postep = { w_toku: false, krok: "", zrobione: 0, razem: 0, blad: null, start: null };

function tytulZOpisu(opis) {
  const linia = (opis || "").split(/\r?\n/).map((l) => l.trim()).find((l) => l) || "(bez opisu)";
  return linia.length > 80 ? linia.slice(0, 77) + "…" : linia;
}

const METRYKI_ROLKI =
  "views,reach,saved,shares,likes,comments,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time";
const METRYKI_POSTA = "views,reach,saved,shares,likes,comments,total_interactions";

async function insightsMedia(id, rolka, token) {
  const metryki = rolka ? METRYKI_ROLKI : METRYKI_POSTA;
  const json = await graph("/" + id + "/insights", { metric: metryki }, token);
  const m = {};
  for (const w of json.data || []) {
    m[w.name] = w.values && w.values[0] && w.values[0].value != null ? w.values[0].value : null;
  }
  // Metryki dodatkowe dla rolek (sprawdzone 24.09.2026: `follows` nie dziala dla rolek,
  // `reels_skip_rate` i `reposts` tak). Osobne zapytanie, zeby brak jednej nie psul reszty.
  let dodatkowe = {};
  if (rolka) {
    try {
      const f = await graph("/" + id + "/insights", { metric: "reels_skip_rate,reposts" }, token);
      for (const w of f.data || []) {
        dodatkowe[w.name] = w.values && w.values[0] && w.values[0].value != null ? w.values[0].value : null;
      }
    } catch {
      dodatkowe = {};
    }
  }
  return { m, follows: null, dodatkowe };
}

async function pobierzRolki(token) {
  const p = sciezki();
  postep.w_toku = true;
  postep.blad = null;
  postep.start = new Date().toISOString();
  try {
    postep.krok = "konto";
    const ust = czytajJson(p.ustawienia, {});
    const konto = ust.ig_id ? ust : await kontoInstagram(token);
    if (!ust.ig_id) zapiszJson(p.ustawienia, { ...ust, ...konto });

    postep.krok = "lista";
    const media = await wszystkieStrony(
      "/" + konto.ig_id + "/media",
      {
        fields:
          "id,media_product_type,media_type,timestamp,caption,like_count,comments_count,permalink,thumbnail_url,media_url",
        limit: 50,
      },
      token
    );

    const stare = czytajJson(p.rolki, []);
    const stareWg = new Map(stare.map((r) => [r.id, r]));
    const wynik = [];
    postep.razem = media.length;
    postep.zrobione = 0;

    // Po cztery media naraz: statystyki i pomiar dlugosci czekaja glownie na siec,
    // wiec rownolegle skracaja pobieranie kilkukrotnie. Kolejnosc wyniku = kolejnosc z API.
    const ROWNOLEGLE = 4;
    const opiszMedia = async (m) => {
      const rolka = m.media_product_type === "REELS";
      let ins = { m: {}, follows: null, dodatkowe: {} };
      try {
        ins = await insightsMedia(m.id, rolka, token);
      } catch (e) {
        ins.blad = e.message;
      }
      const poprzednia = stareWg.get(m.id) || {};
      let dlugosc = poprzednia.dlugosc || null;
      if (!dlugosc && rolka && m.media_url) {
        postep.krok = "długość";
        dlugosc = await dlugoscWideo(m.media_url);
      }
      const czas = ins.m.ig_reels_avg_watch_time;
      const czasCalk = ins.m.ig_reels_video_view_total_time;
      postep.zrobione++;
      return {
        id: m.id,
        typ: rolka ? "rolka" : (m.media_type || "post").toLowerCase(),
        data: m.timestamp,
        tytul: tytulZOpisu(m.caption),
        opis: m.caption || "",
        dlugosc,
        wyswietlenia: ins.m.views != null ? ins.m.views : null,
        zasieg: ins.m.reach != null ? ins.m.reach : null,
        zapisania: ins.m.saved != null ? ins.m.saved : 0,
        udostepnienia: ins.m.shares != null ? ins.m.shares : 0,
        polubienia: ins.m.likes != null ? ins.m.likes : m.like_count || 0,
        komentarze: ins.m.comments != null ? ins.m.comments : m.comments_count || 0,
        interakcje: ins.m.total_interactions != null ? ins.m.total_interactions : null,
        obserwujacy: ins.follows,
        pominiecia: ins.dodatkowe && ins.dodatkowe.reels_skip_rate != null ? ins.dodatkowe.reels_skip_rate : null,
        reposty: ins.dodatkowe && ins.dodatkowe.reposts != null ? ins.dodatkowe.reposts : null,
        czas_ogl: czas != null ? Math.round(czas) / 1000 : null,
        czas_calk: czasCalk != null ? Math.round(czasCalk / 1000) : null,
        permalink: m.permalink,
        miniatura: m.thumbnail_url || null,
        blad: ins.blad || null,
        pobrano: new Date().toISOString(),
      };
    };
    postep.krok = "statystyki";
    for (let i = 0; i < media.length; i += ROWNOLEGLE) {
      const paczka = media.slice(i, i + ROWNOLEGLE);
      wynik.push(...(await Promise.all(paczka.map(opiszMedia))));
    }

    zapiszJson(p.rolki, wynik);
    zapiszJson(p.ustawienia, { ...czytajJson(p.ustawienia, {}), ostatnie_pobranie: new Date().toISOString() });
    postep.krok = "gotowe";
  } catch (e) {
    postep.blad = e.message + (e.kod === 190 ? " (token wygasł, wklej nowy w Ustawieniach)" : "");
    postep.krok = "błąd";
  } finally {
    postep.w_toku = false;
  }
}

// ---------- stan ----------

async function stan(sprawdz) {
  const p = sciezki();
  const token = czytajTekst(p.token);
  const ust = czytajJson(p.ustawienia, {});
  const rolki = czytajJson(p.rolki, []);
  const wynik = {
    token: { jest: !!token, wazny: null, wazny_do: ust.token_wazny_do || null, blad: null },
    secret: !!czytajTekst(p.secret),
    konto: ust.ig_id
      ? { username: ust.username, obserwujacy: ust.obserwujacy, strona: ust.strona, avatar: ust.avatar || null }
      : null,
    rolki: { n: rolki.length, ostatnie_pobranie: ust.ostatnie_pobranie || null },
    postep,
  };
  if (token && sprawdz) {
    try {
      const t = await sprawdzToken(token);
      wynik.token.wazny = t.wazny;
      wynik.token.wazny_do = t.wazny_do;
      zapiszJson(p.ustawienia, { ...ust, token_wazny_do: t.wazny_do });
      if (!ust.ig_id && t.wazny) {
        const konto = await kontoInstagram(token);
        zapiszJson(p.ustawienia, { ...czytajJson(p.ustawienia, {}), ...konto });
        wynik.konto = { username: konto.username, obserwujacy: konto.obserwujacy, strona: konto.strona, avatar: konto.avatar };
      }
    } catch (e) {
      // Limit zapytan (#4, #17, #32, #613) nie mowi nic o waznosci tokena: nie udajemy, ze wygasl.
      const limit = /\(#(?:4|17|32|613)\)/.test(e.message || "") || [4, 17, 32, 613].includes(Number(e.kod));
      wynik.token.wazny = limit ? null : false;
      wynik.token.blad = limit ? "Meta ogranicza zapytania (limit aplikacji). Token nie został sprawdzony, odczekaj około godziny." : e.message;
    }
  }
  return wynik;
}

async function ustawToken(token) {
  const p = sciezki();
  token = (token || "").trim();
  if (!/^EAA[A-Za-z0-9]{40,}$/.test(token)) throw new Error("To nie wygląda na token Mety (zaczyna się od EAA)");
  const secret = czytajTekst(p.secret);
  let wazny_do = null;
  if (secret) {
    try {
      const d = await wymienNaDlugotrwaly(token, secret);
      token = d.token;
      if (d.expires_in) wazny_do = new Date(Date.now() + d.expires_in * 1000).toISOString();
    } catch {
      // nieudana wymiana nie blokuje: zapisujemy krotkotrwaly
    }
  }
  zapiszTekst(p.token, token);
  const ust = czytajJson(p.ustawienia, {});
  zapiszJson(p.ustawienia, { ...ust, token_wazny_do: wazny_do });
  return stan(true);
}

async function ustawSecret(secret) {
  const p = sciezki();
  secret = (secret || "").trim();
  if (!/^[a-f0-9]{32}$/.test(secret)) throw new Error("App secret to 32 znaki szesnastkowe");
  zapiszTekst(p.secret, secret);
  const token = czytajTekst(p.token);
  if (token) {
    const d = await wymienNaDlugotrwaly(token, secret);
    zapiszTekst(p.token, d.token);
    const ust = czytajJson(p.ustawienia, {});
    zapiszJson(p.ustawienia, {
      ...ust,
      token_wazny_do: d.expires_in ? new Date(Date.now() + d.expires_in * 1000).toISOString() : null,
    });
  }
  return stan(true);
}

// ---------- HTTP ----------

const TYPY = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function odpowiedzJson(res, kod, dane) {
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(dane));
}

function czytajCialo(req) {
  return new Promise((resolve, reject) => {
    let dane = "";
    req.on("data", (k) => {
      dane += k;
      if (dane.length > 1e6) reject(new Error("za duże żądanie"));
    });
    req.on("end", () => {
      try {
        resolve(dane ? JSON.parse(dane) : {});
      } catch {
        reject(new Error("nieprawidłowy JSON"));
      }
    });
  });
}

// ---------- moduly (zakladki dopisywane osobno: moduly/<nazwa>.js) ----------
// Kazdy modul eksportuje `obsluz(req, res, url, narzedzia)` i zwraca true, gdy obsluzyl zadanie.

let moduly = null;

function wczytajModuly() {
  if (moduly) return moduly;
  moduly = [];
  const kat = path.join(KATALOG, "moduly");
  if (!fs.existsSync(kat)) return moduly;
  for (const plik of fs.readdirSync(kat).filter((f) => f.endsWith(".js")).sort()) {
    try {
      const m = require(path.join(kat, plik));
      if (typeof m.obsluz === "function") moduly.push({ nazwa: plik.replace(/\.js$/, ""), obsluz: m.obsluz });
    } catch (e) {
      console.error("moduł " + plik + " nie wczytał się: " + e.message);
    }
  }
  return moduly;
}

function narzedziaModulow() {
  const p = sciezki();
  return {
    sciezki: p,
    graph,
    wszystkieStrony,
    pobierzJson,
    dlugoscWideo,
    czytajJson,
    zapiszJson,
    czytajTekst,
    zapiszTekst,
    czytajCialo,
    odpowiedzJson,
    token: () => czytajTekst(p.token),
    ustawienia: () => czytajJson(p.ustawienia, {}),
    port: () => PORT,
  };
}

async function api(req, res, url) {
  const p = sciezki();
  const sc = url.pathname;
  try {
    if (req.method === "GET" && sc === "/api/moduly") {
      return odpowiedzJson(res, 200, wczytajModuly().map((m) => m.nazwa));
    }
    for (const m of wczytajModuly()) {
      if (await m.obsluz(req, res, url, narzedziaModulow())) return;
    }
    if (req.method === "GET" && sc === "/api/stan") {
      return odpowiedzJson(res, 200, await stan(url.searchParams.get("sprawdz") === "1"));
    }
    if (req.method === "GET" && sc === "/api/rolki") {
      return odpowiedzJson(res, 200, {
        rolki: czytajJson(p.rolki, []),
        notatki: czytajJson(p.notatki, {}),
        pary: czytajJson(p.pary, {}),
      });
    }
    if (req.method === "GET" && sc === "/api/postep") {
      return odpowiedzJson(res, 200, postep);
    }
    if (req.method === "POST" && sc === "/api/pobierz") {
      const token = czytajTekst(p.token);
      if (!token) return odpowiedzJson(res, 400, { blad: "Brak tokena. Wklej go w Ustawieniach." });
      if (postep.w_toku) return odpowiedzJson(res, 409, { blad: "Pobieranie już trwa." });
      pobierzRolki(token);
      return odpowiedzJson(res, 202, { ok: true });
    }
    if (req.method === "POST" && sc === "/api/notatka") {
      const { id, tekst } = await czytajCialo(req);
      if (!id) return odpowiedzJson(res, 400, { blad: "brak id" });
      const notatki = czytajJson(p.notatki, {});
      if (tekst && tekst.trim()) notatki[id] = { tekst: tekst.trim(), zmieniono: new Date().toISOString() };
      else delete notatki[id];
      zapiszJson(p.notatki, notatki);
      return odpowiedzJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && sc === "/api/para") {
      // reczne oznaczenie: { id, rola: "probna" | "zwykla" | "" }
      const { id, rola } = await czytajCialo(req);
      if (!id) return odpowiedzJson(res, 400, { blad: "brak id" });
      const pary = czytajJson(p.pary, {});
      if (rola === "probna" || rola === "zwykla") pary[id] = rola;
      else delete pary[id];
      zapiszJson(p.pary, pary);
      return odpowiedzJson(res, 200, { ok: true, pary });
    }
    if (req.method === "POST" && sc === "/api/ustawienia/youtube_klient") {
      // klucz OAuth z Google Cloud (Desktop app): client_id + client_secret, czytany przez moduly/youtube.js
      const { client_id, client_secret } = await czytajCialo(req);
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(client_id || "")) {
        return odpowiedzJson(res, 400, { blad: "Client ID powinien kończyć się na .apps.googleusercontent.com" });
      }
      if (!client_secret || client_secret.length < 10) return odpowiedzJson(res, 400, { blad: "Brak client secret" });
      zapiszJson(p.youtube_klient, { client_id: client_id.trim(), client_secret: client_secret.trim(), zapisano: new Date().toISOString() });
      return odpowiedzJson(res, 200, { ok: true });
    }
    if (req.method === "GET" && sc === "/api/ustawienia/youtube_klient") {
      const k = czytajJson(p.youtube_klient, null);
      return odpowiedzJson(res, 200, { jest: !!(k && k.client_id), client_id: k ? k.client_id : null });
    }
    if (req.method === "POST" && sc === "/api/token") {
      const { token } = await czytajCialo(req);
      return odpowiedzJson(res, 200, await ustawToken(token));
    }
    if (req.method === "POST" && sc === "/api/secret") {
      const { secret } = await czytajCialo(req);
      return odpowiedzJson(res, 200, await ustawSecret(secret));
    }
    return odpowiedzJson(res, 404, { blad: "nie ma takiego adresu" });
  } catch (e) {
    return odpowiedzJson(res, 500, { blad: e.message });
  }
}

function statyczny(res, sc) {
  const p = sciezki();
  const plik = path.normalize(path.join(p.app, sc === "/" ? "index.html" : sc));
  if (!plik.startsWith(p.app) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) {
    res.writeHead(404);
    return res.end("nie ma");
  }
  res.writeHead(200, {
    "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(plik).pipe(res);
}

function start(opcje = {}) {
  if (opcje.katalog) KATALOG = opcje.katalog;
  const port = opcje.port || 8767;
  return new Promise((resolve, reject) => {
    const serwer = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) return api(req, res, url);
      return statyczny(res, decodeURIComponent(url.pathname));
    });
    serwer.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        serwer.listen(0, "127.0.0.1");
      } else reject(e);
    });
    serwer.on("listening", () => {
      PORT = serwer.address().port;
      const adres = "http://127.0.0.1:" + PORT + "/";
      resolve({ adres, serwer });
    });
    serwer.listen(port, "127.0.0.1");
  });
}

module.exports = { start };

if (require.main === module) {
  start({ port: parseInt(process.argv[2], 10) || 8767 }).then(({ adres }) => console.log("Studio: " + adres));
}
