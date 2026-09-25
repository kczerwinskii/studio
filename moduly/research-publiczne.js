"use strict";
// Zwykla publiczna strona w odizolowanym Chromium. Bez logowania, prywatnych API i filmow.
function odczytajDOM() {
  const widoczne = e => !!(e && e.getClientRects().length);
  const tekst = document.body?.innerText || "";
  // Instagram zwraca czasem HTTP 200 z trescia strony niedostepnej.
  const niedostepna = /(?:page|strona).*?(?:isn't available|is not available|nie jest dostępna)|sorry, this page isn't available/i.test(document.title) || /^(?:zaloguj się\s*|log in\s*)?(?:strona page nie jest dostępna|sorry, this page isn't available)/i.test(tekst);
  const blokada = /\/challenge\/|\/accounts\/login|\/accounts\/suspended/.test(location.pathname) || /confirm you're human|potwierdź, że jesteś człowiekiem|verify you are human|try again later|spróbuj ponownie później/i.test(tekst) || [...document.querySelectorAll('iframe[src*="captcha"]')].some(widoczne);
  const posty = [...document.querySelectorAll('a[href*="/reel/"]')].filter(widoczne).map(a => {
    const kod = a.href.match(/\/reel\/([A-Za-z0-9_-]+)\//)?.[1];
    if (!kod) return null;
    const obraz = a.querySelector("img"), film = a.querySelector("video");
    const profil = [...a.querySelectorAll("a[href]")].map(e => new URL(e.href).pathname).find(p => /^\/[a-zA-Z0-9_.]+\/?$/.test(p));
    const linie = a.innerText.split("\n").map(s=>s.trim()).filter(Boolean);
    const licznik = linie.find(s=>/^\d[\d\s.,\u00a0]*\s*(tys\.?|mln|[kmb])?$/i.test(s)) || null;
    return { kod, username: profil?.replace(/^\/|\/$/g, "") || null, opis: obraz?.alt || "", miniatura: obraz?.src || "", film: film?.src || "", licznik, data: a.querySelector("time[datetime]")?.dateTime || null };
  }).filter(Boolean);
  const brama=[...document.querySelectorAll('[role="dialog"]')].some(d=>widoczne(d)&&/zaloguj|log in|sign up|zarejestruj/i.test(d.innerText));
  return { blokada, brama, niedostepna, posty: [...new Map(posty.map(p=>[p.kod,p])).values()].slice(0,100), tytul: document.title };
}
function adresCDN(wartosc) {
  try { const u = new URL(wartosc); return u.protocol === "https:" && !u.username && !u.password && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname) ? u.href : ""; } catch { return ""; }
}
function licznik(wartosc) {
  if (typeof wartosc !== "string") return null;
  const m = wartosc.trim().match(/^(\d[\d\s.,\u00a0]*)\s*(tys\.?|mln|[kmb])?$/i);
  if (!m) return null;
  const sufiks = (m[2] || "").toLowerCase(), mnoznik = /^(k|tys)/.test(sufiks) ? 1e3 : /^(m|mln)$/.test(sufiks) ? 1e6 : sufiks === "b" ? 1e9 : 1;
  const cyfra = m[1].replace(/[\s\u00a0]/g, "");
  // Liczniki bez sufiksu moga miec separator tysiecy; odrzucamy niejednoznaczne ulamki.
  const n = Number(sufiks ? cyfra.replace(",", ".") : cyfra.replace(/[.,](?=\d{3}(?:[.,]|$))/g, ""));
  return Number.isFinite(n) && n >= 0 && (sufiks || Number.isInteger(n)) ? Math.round(n*mnoznik) : null;
}
const skonfigurowane = new WeakSet();
function odczytajSzczegoly(kod) {
  const daty = [...document.querySelectorAll("time[datetime]")].filter(t => {
    const a=t.closest("a[href]");
    if(!a)return false;
    const sciezka=new URL(a.href).pathname;
    return new RegExp("/(?:reel|p)/"+kod+"/?$").test(sciezka);
  }).map(t=>t.dateTime).filter(d=>Number.isFinite(Date.parse(d)));
  const opis=document.querySelector('meta[property="og:description"]')?.content || "";
  const autorzy=[...new Set([...document.querySelectorAll("a[href]")].map(a=>new URL(a.href).pathname.match(new RegExp("^/([A-Za-z0-9_.]{1,30})/(?:reel|p)/"+kod+"/?$"))?.[1]).filter(Boolean))];
  const username=autorzy.length===1?autorzy[0]:opis.match(/^[\d,.\s]+[KMB]? likes?, [\d,.\s]+[KMB]? comments? - ([A-Za-z0-9_.]{1,30}) on /i)?.[1]||null;
  const liczby=opis.match(/^([\d,.\s]+[KMB]?) likes?, ([\d,.\s]+[KMB]?) comments? - /i);
  const kanoniczny=document.querySelector('link[rel="canonical"]')?.href || location.href;
  const zgodny=new RegExp("/(?:reel|p)/"+kod+"/?$").test(new URL(kanoniczny).pathname);
  const rozne=[...new Set(daty)];
  return { gotowe:zgodny && rozne.length===1, zgodny, kod, data:zgodny&&rozne.length===1?rozne[0]:null,
    username:zgodny?username:null,miniatura:zgodny?document.querySelector('meta[property="og:image"]')?.content||"":"",
    polubienia_surowe:zgodny&&liczby?liczby[1]:null,
    komentarze_surowe:zgodny&&liczby?liczby[2]:null,
    zrodlo_szczegolow:location.href };
}
async function pobierzStrone(url, odczyt=odczytajDOM, parametry=[], przewin=0) {
  let electron;
  try { electron = require("electron"); } catch {}
  if (!electron?.BrowserWindow || !electron.app?.isReady()) throw new Error("Odkrywanie działa w aplikacji Studio uruchomionej z pulpitu (Electron).");
  const { BrowserWindow, session } = electron;
  const sesja = session.fromPartition("studio-research-publiczny", { cache: false });
  sesja.setPermissionRequestHandler((_w,_p,odpowiedz)=>odpowiedz(false));
  if (!skonfigurowane.has(sesja)) { sesja.on("will-download", e=>e.preventDefault()); skonfigurowane.add(sesja); }
  sesja.webRequest.onBeforeRequest((szczegoly, odpowiedz) => {
    let dozwolony = false;
    try { const u=new URL(szczegoly.url); dozwolony=u.protocol === "https:" && /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|facebook\.com)$/.test(u.hostname); } catch {}
    odpowiedz({ cancel: !dozwolony || ["media", "image", "font"].includes(szczegoly.resourceType) || /\.(mp4|m4s|mp3)(\?|$)/i.test(szczegoly.url) });
  });
  const okno = new BrowserWindow({ show:false, width:1100, height:850, webPreferences:{ session:sesja, nodeIntegration:false, contextIsolation:true, sandbox:true, backgroundThrottling:false, autoplayPolicy:"document-user-activation-required" } });
  okno.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  const limit = setTimeout(()=>{if(!okno.isDestroyed())okno.destroy()},22000);
  try {
    await okno.loadURL(url);
    let ostatni=null,przewiniecia=0,bezZmian=0;const zebrane=new Map();
    for(let i=0;i<12;i++) {
      const wynik = await okno.webContents.executeJavaScript("(()=>{const w=("+odczyt.toString()+")(..."+JSON.stringify(parametry)+");const d=("+odczytajDOM.toString()+")();return {...w,blokada:d.blokada,niedostepna:d.niedostepna}})()");
      ostatni=wynik;
      if(wynik.blokada) throw Object.assign(new Error("Instagram zatrzymał publiczny odczyt. Nie omijamy logowania ani zabezpieczeń. Otwórz wyszukiwanie na Instagramie."), { blokada:true });
      if(wynik.niedostepna) throw Object.assign(new Error("Instagram nie udostępnia tej strony. To niedostępne źródło, a nie brak rolek na ten temat."), { kod:"STRONA_NIEDOSTEPNA" });
      if(przewin && wynik.posty?.length){
        const bylo=zebrane.size;wynik.posty.forEach(p=>zebrane.set(p.kod,p));bezZmian=zebrane.size===bylo?bezZmian+1:0;
        if(!wynik.brama && przewiniecia<przewin && bezZmian<2){przewiniecia++;await okno.webContents.executeJavaScript("window.scrollTo(0,document.body.scrollHeight)");await new Promise(r=>setTimeout(r,900));continue}
        return {...wynik,posty:[...zebrane.values()],url};
      }
      if(wynik.gotowe || wynik.posty?.length) return { ...wynik, url };
      await new Promise(r=>setTimeout(r,700));
    }
    if(zebrane.size)return {...ostatni,posty:[...zebrane.values()],url};
    if(odczyt===odczytajSzczegoly && ostatni?.zgodny && (ostatni.polubienia_surowe || ostatni.komentarze_surowe))return {...ostatni,url};
    throw new Error("Publiczna strona nie udostępniła rolek dla tej frazy. Spróbuj innej frazy albo otwórz Instagram.");
  } catch (blad) {
    if (/Instagram|Publiczna strona/.test(blad.message)) throw blad;
    throw new Error("Nie udało się odczytać publicznej strony Instagrama. Spróbuj później lub otwórz ją w przeglądarce.");
  } finally { clearTimeout(limit); if(!okno.isDestroyed())okno.destroy(); }
}
function pobierzPubliczne(fraza) {
  return pobierzStrone("https://www.instagram.com/popular/"+encodeURIComponent(fraza.trim().replace(/\s+/g,"-"))+"/");
}
async function pobierzSzczegoly(kod) {
  if(!/^[A-Za-z0-9_-]{5,40}$/.test(kod))throw new Error("Niepoprawny kod rolki.");
  const w=await pobierzStrone("https://www.instagram.com/reel/"+kod+"/",odczytajSzczegoly,[kod]);
  return {...w,polubienia:licznik(w.polubienia_surowe),komentarze:licznik(w.komentarze_surowe)};
}
async function pobierzProfil(username) {
  if(!/^[a-zA-Z0-9_.]{1,30}$/.test(username))throw new Error("Niepoprawna nazwa profilu.");
  const wynik=await pobierzStrone("https://www.instagram.com/"+username+"/reels/",odczytajDOM,[],6);
  return {...wynik,posty:wynik.posty.map(p=>({...p,username}))};
}
module.exports = { odczytajDOM, odczytajSzczegoly, adresCDN, licznik, pobierzPubliczne, pobierzSzczegoly, pobierzProfil };
