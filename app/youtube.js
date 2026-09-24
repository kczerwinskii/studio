"use strict";
// Osobny panel ustawien, bez zmieniania wspolnego CSS i ukladu aplikacji.
window.YouTube = (() => {
  let ostatni = null;
  let zajety = false;
  let blad = "";
  let oczekiwanie = 0;
  let zegar = null;
  let odczyt = null;
  let nasluch = false;

  async function api(koncowka, metoda = "GET") {
    const odpowiedz = await fetch("/api/youtube/" + koncowka, { method: metoda, cache: "no-store" });
    const dane = await odpowiedz.json();
    if (!odpowiedz.ok) throw new Error(dane.blad || "Nie udało się połączyć z YouTube.");
    return dane;
  }

  function element(znacznik, klasa, tekst) {
    const wezel = document.createElement(znacznik);
    if (klasa) wezel.className = klasa;
    if (tekst) wezel.textContent = tekst;
    return wezel;
  }

  function rysuj() {
    const kontener = document.getElementById("youtube-ustawienia");
    if (!kontener) return;
    kontener.replaceChildren();
    const plansza = element("div", "plansza");
    plansza.append(element("h3", "", "YouTube"));
    const polaczony = ostatni?.polaczony;
    plansza.append(element("p", "", polaczony ? "Połączono z YouTube" : "YouTube nie jest połączony"));
    if (polaczony && ostatni.kanal) {
      const konto = element("div", "konto");
      try {
        const adres = new URL(ostatni.kanal.miniatura);
        if (adres.protocol === "https:") {
          const obraz = element("img");
          obraz.src = adres.href;
          obraz.alt = "";
          obraz.referrerPolicy = "no-referrer";
          konto.append(obraz);
        }
      } catch { /* Brak miniatury nie blokuje nazwy kanalu. */ }
      const ile = ostatni.kanal.subskrybenci;
      konto.append(element("span", "", ostatni.kanal.tytul + (ile == null ? "" :
        " · " + ile.toLocaleString("pl-PL") + (ile === 1 ? " subskrybent" : " subskrybentów"))));
      plansza.append(konto);
    }
    plansza.append(element("p", "pod", "Do audytu Google filmy z aplikacji pozostają prywatne. Widoczność zmienisz w YouTube Studio."));
    if (ostatni && !ostatni.skonfigurowany) plansza.append(element("p", "pod", "Najpierw zapisz Client ID i Client secret w Ustawieniach."));
    const przycisk = element("button", "przycisk", polaczony ? "Rozłącz" : "Połącz z YouTube");
    przycisk.type = "button";
    przycisk.disabled = zajety || !ostatni || (!polaczony && !ostatni.skonfigurowany);
    przycisk.addEventListener("click", async () => {
      zajety = true;
      blad = "";
      rysuj();
      try {
        // Odczyt rozpoczęty przed kliknięciem nie może przywrócić starego stanu.
        if (odczyt) await odczyt;
        if (polaczony) {
          await api("rozlacz", "POST");
          oczekiwanie = 0;
        } else {
          const dane = await api("polacz");
          const adres = new URL(dane.url);
          if (adres.origin !== "https://accounts.google.com" || adres.pathname !== "/o/oauth2/v2/auth") throw new Error("Nieprawidłowy adres logowania YouTube.");
          window.open(adres.href, "_blank");
          oczekiwanie = Date.now() + 10 * 60000;
        }
        await wczytaj();
      } catch (wyjatek) { blad = wyjatek.message || "Nie udało się zmienić połączenia YouTube."; }
      finally { zajety = false; rysuj(); zaplanuj(); }
    });
    plansza.append(przycisk);
    if (oczekiwanie && !polaczony) plansza.append(element("p", "pod", "Dokończ logowanie w przeglądarce. Studio sprawdzi połączenie automatycznie."));
    if (blad || ostatni?.blad) {
      const komunikat = element("p", "pod", blad || ostatni.blad);
      komunikat.setAttribute("role", "status");
      plansza.append(komunikat);
    }
    kontener.append(plansza);
  }

  function zaplanuj() {
    clearTimeout(zegar);
    if (oczekiwanie > Date.now()) zegar = setTimeout(() => { void wczytaj(); }, 2000);
    else if (oczekiwanie) { oczekiwanie = 0; rysuj(); }
  }

  async function wczytaj() {
    if (odczyt) return odczyt;
    odczyt = (async () => {
      try {
        ostatni = await api("stan");
        blad = "";
        if (ostatni.polaczony) oczekiwanie = 0;
      } catch { blad = "Nie udało się odczytać stanu YouTube. Wróć do Ustawień, aby ponowić."; }
      finally { rysuj(); zaplanuj(); }
    })();
    try { await odczyt; } finally { odczyt = null; }
  }

  async function start() {
    if (!document.getElementById("youtube-style")) {
      const styl = element("style");
      styl.id = "youtube-style";
      styl.textContent = "#youtube-ustawienia h3{margin:0 0 12px}#youtube-ustawienia .konto{margin:12px 0}#youtube-ustawienia .pod{margin-top:12px}";
      document.head.append(styl);
    }
    if (!nasluch) {
      window.addEventListener("focus", () => { void wczytaj(); });
      nasluch = true;
    }
    await wczytaj();
  }

  return { start, stan: () => ostatni ? { ...ostatni, kanal: ostatni.kanal ? { ...ostatni.kanal } : null } : null };
})();
