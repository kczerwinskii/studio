"use strict";

const fs = require("fs");
const sciezka = require("path");
const https = require("https");
const kryptografia = require("crypto");
const sesje = new Map();
const API = "https://open.tiktokapis.com/v2/";
const MB = 1024 * 1024;
const plikTokenu = (n) => sciezka.join(n.sciezki.config, "tiktok_token.json");
const klient = (n) => n.czytajJson(sciezka.join(n.sciezki.config, "tiktok_klient.json"), {}) || {};
const tokeny = (n) => n.czytajJson(plikTokenu(n), {}) || {};
const czekaj = (ms) => new Promise((gotowe) => setTimeout(gotowe, ms));

function sesja(n) {
  const klucz = sciezka.resolve(n.sciezki.config);
  if (!sesje.has(klucz)) sesje.set(klucz, { proba: null, pokolenie: 0, odswiezanie: null, blad: null });
  return sesje.get(klucz);
}

function bladJawny(tekst, kod = 400) {
  return Object.assign(new Error(tekst), { jawny: true, kod });
}

// Nigdy nie pokazujemy surowej odpowiedzi ani opisu bledu zawierajacego sekrety.
function tlumaczBlad(powod, kod = 400) {
  if (["access_token_invalid", "invalid_grant", "invalid_token"].includes(powod) || kod === 401) return "TikTok wylogował aplikację, połącz ponownie";
  if (powod === "rate_limit_exceeded" || kod === 429) return "limit TikToka, spróbuj za chwilę";
  if (powod === "unaudited_client_can_only_post_to_private_accounts") return "aplikacja przed audytem: ustaw widoczność Tylko ja";
  const opisy = {
    privacy_level_option_mismatch: "Wybrana widoczność nie jest dostępna dla tego konta TikTok.",
    video_duration_not_allowed: "Film jest za długi dla tego konta TikTok.",
    file_format_check_failed: "TikTok nie obsługuje formatu tego filmu.",
    video_pull_failed: "TikTok nie otrzymał pliku wideo.",
    spam_risk_too_many_posts: "Osiągnięto limit publikacji TikToka, spróbuj później.",
    spam_risk_user_banned_from_posting: "TikTok zablokował publikowanie na tym koncie.",
    auth_removed: "Usunięto zgodę TikToka, połącz ponownie.",
    invalid_param: "TikTok odrzucił parametry publikacji.",
  };
  return opisy[powod] || "TikTok nie potwierdził operacji. Sprawdź konto przed ponowieniem.";
}

function bezpiecznyAdres(adres) {
  let url;
  try { url = new URL(adres); } catch { throw bladJawny("Nieprawidłowy adres wysyłki TikToka.", 502); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !["tiktokapis.com", "tiktok.com"].some((domena) => url.hostname === domena || url.hostname.endsWith("." + domena))) {
    throw bladJawny("Nieprawidłowy adres wysyłki TikToka.", 502);
  }
  return url;
}

function zadanieTikTok(adres, metoda, naglowki = {}, cialo = "", fragment = null, limit = 90000) {
  const url = bezpiecznyAdres(adres);
  return new Promise((gotowe, odrzuc) => {
    let strumien, zegar;
    let zakonczone = false;
    const zakoncz = (blad, wynik) => {
      if (zakonczone) return;
      zakonczone = true;
      clearTimeout(zegar);
      if (strumien) strumien.destroy();
      if (blad) { zadanie.destroy(); odrzuc(blad); } else gotowe(wynik);
    };
    const bladSieci = () => zakoncz(bladJawny("Przerwano połączenie z TikTokiem. Sprawdź konto przed ponowieniem.", 502));
    const zadanie = https.request(url, { method: metoda, headers: naglowki }, (odpowiedz) => {
      const kawalki = [];
      let bajty = 0;
      odpowiedz.on("data", (kawalek) => {
        bajty += kawalek.length;
        if (bajty > MB) { zakoncz(bladJawny("Zbyt duża odpowiedź TikToka.", 502)); odpowiedz.destroy(); }
        else kawalki.push(kawalek);
      });
      odpowiedz.on("error", bladSieci);
      odpowiedz.on("aborted", bladSieci);
      odpowiedz.on("end", () => {
        let dane = null;
        try { dane = JSON.parse(Buffer.concat(kawalki).toString("utf8")); } catch { /* PUT moze miec pusta odpowiedz. */ }
        zakoncz(null, { kod: odpowiedz.statusCode, dane });
      });
    });
    zadanie.on("error", bladSieci);
    zadanie.setTimeout(Math.min(limit, 60000), bladSieci);
    zegar = setTimeout(bladSieci, limit);
    if (fragment) {
      strumien = fs.createReadStream(fragment.plik, { start: fragment.od, end: fragment.do });
      strumien.on("error", () => zakoncz(bladJawny("Nie udało się odczytać pliku wideo.", 500)));
      strumien.pipe(zadanie);
    } else zadanie.end(cialo);
  });
}

function sprawdz(wynik, pusty = false) {
  const powod = typeof wynik.dane?.error === "string" ? wynik.dane.error : wynik.dane?.error?.code;
  if (wynik.kod < 200 || wynik.kod >= 300 || (powod && powod !== "ok")) throw bladJawny(tlumaczBlad(powod, wynik.kod), 502);
  if (!pusty && (!wynik.dane || typeof wynik.dane !== "object")) throw bladJawny("Nieprawidłowa odpowiedź TikToka.", 502);
  return wynik.dane;
}

function wyzwaniePKCE(weryfikator) {
  return kryptografia.createHash("sha256").update(weryfikator).digest("base64url");
}

function budujOAuth(n) {
  const daneKlienta = klient(n);
  if (!daneKlienta.client_key || !daneKlienta.client_secret) throw bladJawny("Uzupełnij klienta TikToka w Ustawieniach.");
  const port = Number(n.port());
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw bladJawny("Nieprawidłowy port Studio.", 500);
  const stan = sesja(n);
  const proba = { state: kryptografia.randomBytes(32).toString("hex"), weryfikator: kryptografia.randomBytes(32).toString("base64url"),
    wygasa: Date.now() + 600000, przekierowanie: "http://127.0.0.1:" + port + "/api/tiktok/callback", klient: daneKlienta };
  stan.proba = proba;
  stan.pokolenie++;
  stan.blad = null;
  const adres = new URL("https://www.tiktok.com/v2/auth/authorize/");
  adres.search = new URLSearchParams({ client_key: daneKlienta.client_key, scope: "user.info.basic,video.publish,video.upload",
    response_type: "code", redirect_uri: proba.przekierowanie, state: proba.state,
    code_challenge: wyzwaniePKCE(proba.weryfikator), code_challenge_method: "S256" }).toString();
  return adres.href;
}

async function wymienToken(pola) {
  const cialo = new URLSearchParams(pola).toString();
  const dane = sprawdz(await zadanieTikTok(API + "oauth/token/", "POST", {
    "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(cialo),
  }, cialo));
  if (![dane.access_token, dane.refresh_token, dane.open_id].every((wartosc) => typeof wartosc === "string" && wartosc) ||
      ![dane.expires_in, dane.refresh_expires_in].every((wartosc) => Number.isFinite(Number(wartosc)) && Number(wartosc) > 0)) {
    throw bladJawny("TikTok nie zwrócił poprawnego tokena.", 502);
  }
  return { access_token: dane.access_token, refresh_token: dane.refresh_token, open_id: dane.open_id,
    wygasa: new Date(Date.now() + Number(dane.expires_in) * 1000).toISOString(),
    refresh_wygasa: new Date(Date.now() + Number(dane.refresh_expires_in) * 1000).toISOString() };
}

async function aktualnyToken(n) {
  const stan = sesja(n);
  const zapisane = tokeny(n);
  if (!zapisane.refresh_token || !(Date.parse(zapisane.refresh_wygasa) > Date.now())) throw bladJawny(tlumaczBlad("access_token_invalid"), 401);
  if (zapisane.access_token && Date.parse(zapisane.wygasa) - Date.now() >= 120000) return zapisane.access_token;
  if (stan.odswiezanie) return stan.odswiezanie;
  const pokolenie = stan.pokolenie;
  const daneKlienta = klient(n);
  if (!daneKlienta.client_key || !daneKlienta.client_secret) throw bladJawny("Uzupełnij klienta TikToka w Ustawieniach.");
  const obietnica = (async () => {
    const nowe = await wymienToken({ client_key: daneKlienta.client_key, client_secret: daneKlienta.client_secret,
      grant_type: "refresh_token", refresh_token: zapisane.refresh_token });
    if (pokolenie !== stan.pokolenie) throw bladJawny("Połączenie TikToka zostało zmienione.", 409);
    if (nowe.open_id !== zapisane.open_id) throw bladJawny("TikTok zwrócił inne konto. Połącz ponownie.");
    n.zapiszJson(plikTokenu(n), { ...zapisane, ...nowe });
    stan.blad = null;
    return nowe.access_token;
  })();
  stan.odswiezanie = obietnica;
  try { return await obietnica; }
  catch (blad) { if (pokolenie === stan.pokolenie) stan.blad = blad.jawny ? blad.message : "Nie udało się odświeżyć TikToka."; throw blad; }
  finally { if (stan.odswiezanie === obietnica) stan.odswiezanie = null; }
}

function podzielPlik(rozmiar) {
  if (!Number.isSafeInteger(rozmiar) || rozmiar <= 0) throw bladJawny("Nieprawidłowy rozmiar filmu.");
  const kawalek = rozmiar <= 64 * MB ? rozmiar : 10 * MB;
  const liczba = Math.ceil(rozmiar / kawalek);
  if (liczba > 1000) throw bladJawny("Film wymaga zbyt wielu kawałków do wysłania.");
  return { source_info: { source: "FILE_UPLOAD", video_size: rozmiar, chunk_size: kawalek, total_chunk_count: liczba },
    kawalki: Array.from({ length: liczba }, (_, indeks) => ({ od: indeks * kawalek, do: Math.min(rozmiar, (indeks + 1) * kawalek) - 1 })) };
}

function zlozPost(pozycja) {
  const widocznosc = pozycja.tiktok_widocznosc || "SELF_ONLY";
  if (!["SELF_ONLY", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR"].includes(widocznosc)) throw bladJawny("Nieprawidłowa widoczność TikToka.");
  const sekundy = pozycja.okladka_s;
  return { title: Array.from(typeof pozycja.opis === "string" ? pozycja.opis : "").slice(0, 2200).join(""),
    privacy_level: widocznosc, disable_duet: false, disable_comment: false, disable_stitch: false,
    video_cover_timestamp_ms: typeof sekundy === "number" && Number.isFinite(sekundy) && sekundy >= 0 ? Math.round(sekundy * 1000) : 1000 };
}

async function opublikujNaTikToku(n, pozycja, ustawStatus = () => {}) {
  let rozmiar;
  try { const info = fs.statSync(pozycja.plik); if (!info.isFile() || !info.size) throw new Error(); rozmiar = info.size; }
  catch { throw bladJawny("Nie ma poprawnego pliku wideo do wysłania."); }
  const podzial = podzielPlik(rozmiar);
  const post = zlozPost(pozycja);
  const stan = sesja(n);
  const pokolenie = stan.pokolenie;
  const sprawdzPolaczenie = () => {
    if (pokolenie !== stan.pokolenie) throw bladJawny("Połączenie TikToka zostało zmienione. Sprawdź konto przed ponowieniem.", 409);
  };
  const wyslijJson = async (koncowka, dane, termin = Infinity) => {
    sprawdzPolaczenie();
    const token = await aktualnyToken(n);
    sprawdzPolaczenie();
    const pozostalo = termin - Date.now();
    if (pozostalo <= 0) throw bladJawny("TikTok nadal przetwarza film. Sprawdź konto przed ponowieniem.", 504);
    const cialo = JSON.stringify(dane);
    return sprawdz(await zadanieTikTok(API + koncowka, "POST", { Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8", "Content-Length": Buffer.byteLength(cialo) }, cialo, null, Math.min(90000, pozostalo)));
  };
  ustawStatus("tiktok", "TikTok: zaczynam wysyłkę");
  const poczatek = await wyslijJson("post/publish/video/init/", { post_info: post, source_info: podzial.source_info });
  const identyfikator = poczatek.data?.publish_id;
  if (typeof identyfikator !== "string" || !identyfikator) throw bladJawny("TikTok nie zwrócił identyfikatora publikacji.", 502);
  const adres = bezpiecznyAdres(poczatek.data?.upload_url).href;
  for (const [indeks, kawalek] of podzial.kawalki.entries()) {
    sprawdzPolaczenie();
    ustawStatus("tiktok", "TikTok: wysyłam kawałek " + (indeks + 1) + "/" + podzial.kawalki.length);
    // Podpisany upload_url nie otrzymuje tokena OAuth ani automatycznych przekierowan.
    sprawdz(await zadanieTikTok(adres, "PUT", { "Content-Type": "video/mp4", "Content-Length": kawalek.do - kawalek.od + 1,
      "Content-Range": "bytes " + kawalek.od + "-" + kawalek.do + "/" + rozmiar }, "", { plik: pozycja.plik, ...kawalek }, 30 * 60000), true);
  }
  ustawStatus("tiktok", "TikTok: przetwarzam film");
  const termin = Date.now() + 5 * 60000;
  while (Date.now() < termin) {
    await czekaj(Math.min(5000, termin - Date.now()));
    if (Date.now() >= termin) break;
    const wynik = await wyslijJson("post/publish/status/fetch/", { publish_id: identyfikator }, termin);
    if (wynik.data?.status === "FAILED") throw bladJawny(tlumaczBlad(wynik.data.fail_reason), 502);
    if (wynik.data?.status === "PUBLISH_COMPLETE") {
      ustawStatus("tiktok", post.privacy_level === "SELF_ONLY" ? "opublikowano na TikToku (widoczne tylko dla Ciebie do czasu audytu)" : "opublikowano na TikToku");
      return { publish_id: identyfikator, widocznosc: post.privacy_level };
    }
  }
  throw bladJawny("TikTok nadal przetwarza film po 5 minutach. Sprawdź konto przed ponowieniem.", 504);
}

function stronaCallback(odpowiedz, kod, komunikat) {
  const tekst = komunikat.replace(/[&<>"']/g, (znak) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[znak]);
  odpowiedz.writeHead(kod, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'" });
  odpowiedz.end('<!doctype html><html lang="pl"><meta charset="utf-8"><title>TikTok | Studio</title><style>@font-face{font-family:Poppins;src:url(/fonty/Poppins-Regular.ttf)}body{margin:0;background:#0E0E12;color:#EFE9DA;font-family:Poppins,sans-serif;padding:48px 24px}main{max-width:640px;margin:auto;background:#141419;border:1px solid #C9A455;border-radius:10px;padding:24px}h1{font-size:20px}</style><main><h1>' + tekst + '</h1></main></html>');
}

async function obsluz(zadanie, odpowiedz, url, n) {
  if (!url.pathname.startsWith("/api/tiktok/")) return false;
  const stan = sesja(n);
  const wyslij = (kod, dane) => { n.odpowiedzJson(odpowiedz, kod, dane); return true; };
  const callback = zadanie.method === "GET" && url.pathname === "/api/tiktok/callback";
  try {
    if (zadanie.method === "GET" && url.pathname === "/api/tiktok/stan") {
      const zapisane = tokeny(n);
      const daneKlienta = klient(n);
      return wyslij(200, { skonfigurowany: !!(daneKlienta.client_key && daneKlienta.client_secret),
        polaczony: !!zapisane.refresh_token && Date.parse(zapisane.refresh_wygasa) > Date.now(),
        konto: zapisane.konto ? { open_id: zapisane.konto.open_id, nazwa: zapisane.konto.nazwa, avatar: zapisane.konto.avatar } : null, blad: stan.blad });
    }
    if (zadanie.method === "GET" && url.pathname === "/api/tiktok/polacz") return wyslij(200, { url: budujOAuth(n) });
    if (callback) {
      const proba = stan.proba;
      const podany = url.searchParams.get("state") || "";
      if (!proba || proba.wygasa <= Date.now() || !/^[a-f0-9]{64}$/.test(podany) ||
          !kryptografia.timingSafeEqual(Buffer.from(podany), Buffer.from(proba.state))) throw bladJawny("Nieprawidłowy lub wygasły stan logowania. Połącz TikTok ponownie.");
      stan.proba = null;
      const pokolenie = stan.pokolenie;
      if (url.searchParams.has("error")) throw bladJawny("Nie udzielono zgody na połączenie z TikTokiem.");
      const kod = url.searchParams.get("code");
      if (!kod) throw bladJawny("Brak kodu logowania TikToka.");
      const nowe = await wymienToken({ client_key: proba.klient.client_key, client_secret: proba.klient.client_secret,
        grant_type: "authorization_code", code: kod, redirect_uri: proba.przekierowanie, code_verifier: proba.weryfikator });
      if (pokolenie !== stan.pokolenie) throw bladJawny("Logowanie TikToka zostało anulowane.");
      n.zapiszJson(plikTokenu(n), nowe);
      const dane = sprawdz(await zadanieTikTok(API + "user/info/?fields=open_id,display_name,avatar_url", "GET", { Authorization: "Bearer " + nowe.access_token }));
      const konto = dane.data?.user;
      if (!konto || konto.open_id !== nowe.open_id) throw bladJawny("Nie udało się potwierdzić konta TikTok.");
      if (pokolenie !== stan.pokolenie) throw bladJawny("Logowanie TikToka zostało anulowane.");
      // Zachowaj token odswiezony w czasie pobierania profilu.
      n.zapiszJson(plikTokenu(n), { ...tokeny(n), konto: { open_id: konto.open_id, nazwa: konto.display_name || "TikTok", avatar: konto.avatar_url || "" } });
      stan.blad = null;
      stronaCallback(odpowiedz, 200, "Połączono z TikTokiem, możesz zamknąć kartę");
      return true;
    }
    if (zadanie.method === "POST" && url.pathname === "/api/tiktok/rozlacz") {
      stan.pokolenie++;
      stan.proba = null;
      stan.odswiezanie = null;
      fs.rmSync(plikTokenu(n), { force: true });
      stan.blad = null;
      return wyslij(200, { ok: true });
    }
    return wyslij(404, { blad: "Nie ma takiego adresu TikToka." });
  } catch (blad) {
    const tekst = blad.jawny ? blad.message : "Nie udało się obsłużyć połączenia TikToka.";
    stan.blad = tekst;
    if (callback) { stronaCallback(odpowiedz, blad.jawny ? blad.kod : 500, tekst); return true; }
    return wyslij(blad.jawny ? blad.kod : 500, { blad: tekst });
  }
}

module.exports = { obsluz, opublikujNaTikToku, budujOAuth, wyzwaniePKCE, podzielPlik, zlozPost, tlumaczBlad };
