"use strict";

// Studio - front bez frameworka. Dane z /api/..., liczenie w app/analiza.js (window.Analiza).

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const stan = {
  rolki: [],
  notatki: {},
  paryReczne: {},
  przeliczone: [],
  podsumowanie: null,
  pary: {},
  sort: { pole: "data", kierunek: "desc" },
  filtr: "wszystkie",
  szukaj: "",
  tylkoRolki: true,
  konto: null,
  token: null,
};

// ---------- pomocnicze ----------

async function api(sciezka, dane) {
  const odp = await fetch(sciezka, dane ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dane) } : undefined);
  const json = await odp.json().catch(() => ({}));
  if (!odp.ok) throw new Error(json.blad || "błąd " + odp.status);
  return json;
}

const fmtData = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
};
const fmtDataPelna = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "");
const fmtLiczba = (n) => (n == null ? "–" : Math.round(n).toLocaleString("pl-PL"));
const fmtProc = (u) => (u == null ? "–" : Math.round(u * 100) + "%");
const fmt1 = (n) => (n == null ? "–" : (Math.round(n * 100) / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 }));
const fmtSek = (s) => (s == null ? "–" : Math.round(s) + " s");
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// Silnik: window.Analiza (port analiza.py). Gdy go nie ma, minimalna wersja awaryjna.
function silnik() {
  if (window.Analiza && typeof window.Analiza.przelicz === "function") return window.Analiza;
  const BENCH = [[15, 0.66], [30, 0.315], [60, 0.221], [1e9, 0.164]];
  const benchmark = (d) => (BENCH.find(([p]) => d <= p) || BENCH[3])[1];
  const mediana = (w) => {
    const s = w.filter((x) => x != null).sort((a, b) => a - b);
    if (!s.length) return null;
    const n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };
  return {
    awaryjny: true,
    przelicz(r) {
      const w = r.wyswietlenia || 0;
      const ret = r.czas_ogl != null && r.dlugosc ? r.czas_ogl / r.dlugosc : null;
      return {
        ...r,
        retencja: ret,
        indeks: ret != null ? ret / benchmark(r.dlugosc) : null,
        zapisy_1k: w ? (r.zapisania * 1000) / w : 0,
        udost_1k: w ? (r.udostepnienia * 1000) / w : 0,
        obs_1k: r.obserwujacy != null && w ? (r.obserwujacy * 1000) / w : null,
        powtorki: r.zasieg ? w / r.zasieg : null,
        wysw_na_obs: r.obserwujacy ? w / r.obserwujacy : null,
      };
    },
    podsumuj(rolki) {
      const z = rolki.filter((r) => r.retencja != null);
      const sumW = rolki.reduce((s, r) => s + (r.wyswietlenia || 0), 0) || 1;
      const zObs = rolki.filter((r) => r.obserwujacy != null);
      return {
        n: z.length,
        med_ret: mediana(z.map((r) => r.retencja)),
        med_indeks: mediana(z.map((r) => r.indeks)),
        wsk_zapisy: (rolki.reduce((s, r) => s + (r.zapisania || 0), 0) * 1000) / sumW,
        wsk_obs: zObs.length ? (zObs.reduce((s, r) => s + r.obserwujacy, 0) * 1000) / sumW : null,
        przedzialy: {},
      };
    },
    sygnaly(r, p) {
      if (r.retencja == null) return [{ kod: "brak_czasu", tekst: "Brak czasu oglądania albo długości rolki." }];
      const s = [];
      if (r.retencja >= 1) s.push({ kod: "petla", tekst: "Pętla: ludzie odtwarzają ponownie, końcówka zadziałała." });
      if (p && p.med_indeks) {
        const prog = Math.max(p.med_indeks * 0.2, 1.5 / r.dlugosc / benchmark(r.dlugosc));
        const delta = r.indeks - p.med_indeks;
        if (delta < -prog) s.push({ kod: "ponizej", tekst: "Retencja poniżej Twojej mediany (indeks " + fmt1(r.indeks) + "): hook albo przejście." });
        else if (delta > prog) s.push({ kod: "powyzej", tekst: "Retencja powyżej mediany (indeks " + fmt1(r.indeks) + "): sprawdź, co zadziałało, i powtórz." });
      }
      return s.length ? s : [{ kod: "norma", tekst: "W normie." }];
    },
    pary: () => ({}),
    benchmark,
    mediana,
  };
}

// ---------- liczenie ----------

function przelicz() {
  const A = silnik();
  const zrodlo = stan.tylkoRolki ? stan.rolki.filter((r) => r.typ === "rolka") : stan.rolki;
  stan.przeliczone = zrodlo.map((r) => A.przelicz(r));
  stan.podsumowanie = A.podsumuj(stan.przeliczone);
  stan.pary = A.pary ? A.pary(stan.przeliczone) : {};
  // reczne oznaczenia Kuby maja pierwszenstwo przed zgadywaniem po kolejnosci publikacji
  for (const [id, rola] of Object.entries(stan.paryReczne)) {
    const para = stan.pary[id];
    const tekst = rola === "probna" ? "próbna" : "zwykła";
    const odwrotna = rola === "probna" ? "zwykła" : "próbna";
    stan.pary[id] = { rola: tekst, para: para ? para.para : null, reczna: true };
    if (para && para.para) stan.pary[para.para] = { rola: odwrotna, para: id, reczna: true };
  }
  for (const r of stan.przeliczone) {
    r.sygnaly = A.sygnaly(r, stan.podsumowanie);
    r.kody = r.sygnaly.map((s) => s.kod);
    r.notatka = stan.notatki[r.id] ? stan.notatki[r.id].tekst : "";
  }
  stan.medPominiecia = A.mediana(stan.przeliczone.map((r) => r.pominiecia));
}

function widoczne() {
  const q = stan.szukaj.trim().toLowerCase();
  let lista = stan.przeliczone.filter((r) => {
    if (q && !(r.tytul + " " + r.opis).toLowerCase().includes(q)) return false;
    switch (stan.filtr) {
      case "powyzej": return r.kody.includes("powyzej");
      case "ponizej": return r.kody.includes("ponizej");
      case "sygnal": return !r.kody.includes("norma");
      case "bez_czasu": return r.retencja == null;
      default: return true;
    }
  });
  const { pole, kierunek } = stan.sort;
  const znak = kierunek === "asc" ? 1 : -1;
  lista.sort((a, b) => {
    const x = a[pole], y = b[pole];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string") return znak * x.localeCompare(y, "pl");
    return znak * (x - y);
  });
  return lista;
}

// ---------- rysowanie ----------

// Teksty sygnalow pod aplikacje (silnik ma teksty ze skillu, pisane pod prace ze zrzutami).
const TEKSTY_SYGNALOW = {
  brak_czasu: () => "Brak średniego czasu oglądania albo długości rolki. Instagram podaje czas dopiero po kilku godzinach od publikacji, spróbuj pobrać dane jutro.",
  petla: () => "Pętla: ludzie odtwarzają rolkę ponownie, końcówka zadziałała.",
  ponizej: (r) => `Retencja poniżej Twojej mediany (indeks ${fmt1(r.indeks)}). Najczęściej winny jest hook albo przejście po hooku.`,
  powyzej: (r) => `Retencja powyżej mediany (indeks ${fmt1(r.indeks)}). Sprawdź, co zadziałało, i powtórz w następnej rolce.`,
  zero_zapisan: (r, s) => (s.tekst || "").replace(/^[A-ZĄĆĘŁŃÓŚŹŻ ]+/, (m) => m.charAt(0) + m.slice(1).toLowerCase()),
  zero_obs: (r, s) => (s.tekst || "").replace(/^[A-ZĄĆĘŁŃÓŚŹŻ ,]+/, (m) => m.charAt(0) + m.slice(1).toLowerCase()),
  norma: () => "W normie: retencja blisko Twojej mediany, zapisania i obserwujący bez odchyleń.",
};

// Pasek ogladania: dlugosc rolki, strefa pierwszych 3 s z odsetkiem pominiec, znacznik sredniego czasu.
function pasekOgladania(r) {
  if (!r.dlugosc) return "";
  const dl = r.dlugosc;
  const proc = (s) => Math.max(0, Math.min(100, (s / dl) * 100));
  const zostaje = r.pominiecia != null ? Math.round(100 - r.pominiecia) : null;
  const sr = r.czas_ogl != null ? Math.min(r.czas_ogl, dl) : null;
  return `<div class="pasek-ogl">
    <div class="pasek-ogl-tor">
      <div class="pasek-ogl-hook" style="width:${proc(3)}%"></div>
      ${sr != null ? `<div class="pasek-ogl-sredni" style="left:${proc(sr)}%"></div>` : ""}
    </div>
    <div class="pasek-ogl-opisy">
      <span>${zostaje != null ? `po 3 s zostaje <b>${zostaje}%</b>` : "pominięcia: brak danych"}</span>
      <span>${sr != null ? `średnio oglądają do <b>${fmt1(sr)} s</b> (${fmtProc(r.retencja)})` : "średni czas: brak danych"}</span>
      <span>koniec: ${fmtSek(dl)}</span>
    </div>
  </div>`;
}

function zdaniePominiec(r) {
  if (r.pominiecia == null || stan.medPominiecia == null) return "";
  const d = r.pominiecia - stan.medPominiecia;
  let ocena = "tyle co zwykle";
  if (d >= 8) ocena = "więcej niż zwykle, hook nie zatrzymał";
  else if (d <= -8) ocena = "mniej niż zwykle, hook zatrzymał";
  return `<li>Pominięcia w pierwszych 3 sekundach: <b>${Math.round(r.pominiecia)}%</b> przy medianie ${Math.round(stan.medPominiecia)}%, ${ocena}.</li>`;
}

function opisSygnalu(s, r) {
  const f = TEKSTY_SYGNALOW[s.kod];
  return f ? f(r, s) : s.tekst;
}

function etykietaSygnalu(r) {
  const k = r.kody;
  if (k.includes("powyzej")) return '<span class="sygnal dobry">powtórz</span>';
  if (k.includes("petla")) return '<span class="sygnal dobry">pętla</span>';
  if (k.includes("ponizej")) return '<span class="sygnal">hook / przejście?</span>';
  if (k.includes("zero_obs")) return '<span class="sygnal">zasięg, 0 obs.</span>';
  if (k.includes("zero_zapisan")) return '<span class="sygnal">zero zapisań</span>';
  if (k.includes("brak_czasu")) return '<span class="sygnal cichy">brak czasu</span>';
  return '<span class="sygnal cichy">na medianie</span>';
}

function rysujKafelki() {
  const p = stan.podsumowanie;
  const teraz = Date.now();
  const w30 = stan.przeliczone
    .filter((r) => teraz - new Date(r.data).getTime() < 30 * 864e5)
    .reduce((s, r) => s + (r.wyswietlenia || 0), 0);
  const kafelek = (e, w, d) => `<div class="kafelek"><div class="etykieta">${e}</div><div class="wartosc">${w}</div>${d ? `<div class="dopisek">${d}</div>` : ""}</div>`;
  $("#kafelki").innerHTML =
    kafelek("Mediana retencji", fmtProc(p && p.med_ret), p ? `z ${p.n} rolek z czasem` : "") +
    kafelek("Mediana indeksu", fmt1(p && p.med_indeks), "retencja ÷ benchmark długości") +
    kafelek("Zapisania / 1000 wyśw.", fmt1(p && p.wsk_zapisy), "z całej puli") +
    (p && p.wsk_obs != null
      ? kafelek("Obserwujący / 1000 wyśw.", fmt1(p.wsk_obs), "z całej puli")
      : kafelek("Wyświetlenia, 30 dni", fmtLiczba(w30), "suma z rolek"));
}

function rysujTabele() {
  const lista = widoczne();
  const tbody = $("#wiersze");
  tbody.innerHTML = lista
    .map((r) => {
      const typ = r.typ === "rolka" ? "" : `<span class="typ">${esc(r.typ)}</span>`;
      const para = stan.pary[r.id];
      const znacznik = para ? `<span class="typ ${para.rola.includes("próbna") ? "probna" : "zwykla"}">${para.rola.includes("próbna") ? "próbna" : "zwykła"}</span>` : "";
      const klasaRet = r.kody.includes("powyzej") || r.kody.includes("petla") ? "zlota" : r.retencja == null ? "szara" : "mocna";
      return `<tr data-id="${r.id}">
        <td class="szara">${fmtData(r.data)}</td>
        <td title="${esc(r.tytul)}">${typ}${znacznik}${esc(r.tytul)}</td>
        <td class="liczba">${fmtSek(r.dlugosc)}</td>
        <td class="liczba ${klasaRet}">${fmtProc(r.retencja)}</td>
        <td class="liczba">${fmt1(r.indeks)}</td>
        <td class="liczba ${r.pominiecia != null && stan.medPominiecia != null && r.pominiecia <= stan.medPominiecia - 8 ? "zlota" : ""}">${r.pominiecia == null ? "–" : Math.round(r.pominiecia) + "%"}</td>
        <td class="liczba">${fmtLiczba(r.zapisania)}</td>
        <td class="liczba">${fmtLiczba(r.udostepnienia)}</td>
        <td class="liczba">${r.obserwujacy == null ? "–" : fmtLiczba(r.obserwujacy)}</td>
        <td class="liczba">${fmtLiczba(r.wyswietlenia)}</td>
        <td>${etykietaSygnalu(r)}</td>
      </tr>`;
    })
    .join("");
  $("#licznik").textContent = lista.length ? `${lista.length} z ${stan.przeliczone.length}` : "";
  // kolumna obserwujacych tylko wtedy, gdy API dalo te liczbe choc raz
  $("#tabela").classList.toggle("bez-obs", !stan.przeliczone.some((r) => r.obserwujacy != null));
  $("#tabela").classList.toggle("bez-pomin", !stan.przeliczone.some((r) => r.pominiecia != null));
  $("#pusto").classList.toggle("ukryty", stan.rolki.length > 0);
  $("#tabela").classList.toggle("ukryty", stan.rolki.length === 0);
  $$("#tabela th").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === stan.sort.pole) th.classList.add("sort-" + stan.sort.kierunek);
  });
}

function rysujNaglowek() {
  const n = stan.rolki.filter((r) => r.typ === "rolka").length;
  const ost = stan.ostatniePobranie ? fmtDataPelna(stan.ostatniePobranie) : null;
  $("#analiza-pod").textContent = stan.rolki.length
    ? `${n} rolek, ${stan.rolki.length - n} innych postów, ostatnie pobranie ${ost || "?"}`
    : "Brak danych. Pobierz je z Instagrama.";
  if (silnik().awaryjny) $("#analiza-pod").textContent += " (silnik awaryjny: brak app/analiza.js)";
}

function rysujAnalize() {
  przelicz();
  rysujNaglowek();
  rysujKafelki();
  rysujTabele();
}

// ---------- karta rolki ----------

function otworzKarte(id) {
  const r = stan.przeliczone.find((x) => x.id === id);
  if (!r) return;
  const p = stan.podsumowanie || {};
  const para = stan.pary[id];
  const liczba = (e, w) => `<div><div class="etykieta">${e}</div><div class="wartosc">${w}</div></div>`;
  $("#karta-tresc").innerHTML = `
    <div class="karta-gora">
      ${r.miniatura ? `<img src="${esc(r.miniatura)}" alt="">` : ""}
      <div style="min-width:0">
        <div class="karta-tytul">${esc(r.tytul)}</div>
        <div class="karta-meta">${fmtDataPelna(r.data)} · ${r.typ === "rolka" ? "rolka" : esc(r.typ)} · ${fmtSek(r.dlugosc)}
          ${r.permalink ? ` · <a href="${esc(r.permalink)}" target="_blank" rel="noopener">otwórz na Instagramie</a>` : ""}
          ${para ? ` · <b>${esc(para.reczna ? para.rola : "prawdopodobnie " + para.rola.replace("prawdopodobnie ", ""))}</b> <button class="link" id="para-zamien">zamień</button>` : ""}</div>
        <div class="karta-opis">${esc(r.opis)}</div>
      </div>
    </div>
    <div class="liczby">
      ${liczba("Wyświetlenia", fmtLiczba(r.wyswietlenia))}
      ${liczba("Zasięg", fmtLiczba(r.zasieg))}
      ${liczba("Powtórki (wyśw. ÷ zasięg)", fmt1(r.powtorki))}
      ${liczba("Średni czas", r.czas_ogl != null ? fmt1(r.czas_ogl) + " s" : "–")}
      ${liczba("Pominięcia w 3 s", r.pominiecia == null ? "–" : Math.round(r.pominiecia) + "%" + (stan.medPominiecia != null ? ` <span class="pod">/ mediana ${Math.round(stan.medPominiecia)}%</span>` : ""))}
      ${liczba("Retencja", fmtProc(r.retencja))}
      ${liczba("Indeks", fmt1(r.indeks) + (p.med_indeks ? ` <span class="pod">/ mediana ${fmt1(p.med_indeks)}</span>` : ""))}
      ${liczba("Zapisania", fmtLiczba(r.zapisania) + ` <span class="pod">${fmt1(r.zapisy_1k)} / 1000</span>`)}
      ${liczba("Udostępnienia", fmtLiczba(r.udostepnienia) + ` <span class="pod">${fmt1(r.udost_1k)} / 1000</span>`)}
      ${liczba("Polubienia", fmtLiczba(r.polubienia))}
      ${liczba("Komentarze", fmtLiczba(r.komentarze))}
      ${liczba("Obserwujący z rolki", r.obserwujacy == null ? "–" : fmtLiczba(r.obserwujacy))}
      ${liczba("Interakcje", fmtLiczba(r.interakcje))}
    </div>
    ${pasekOgladania(r)}
    <h2>Sygnały</h2>
    <ul class="sygnaly">${r.sygnaly.map((s) => `<li>${esc(opisSygnalu(s, r))}</li>`).join("")}${zdaniePominiec(r)}${r.blad ? `<li>Błąd pobierania statystyk: ${esc(r.blad)}</li>` : ""}</ul>
    <div class="notatka">
      <h2>Notatka</h2>
      <textarea id="notatka-pole" placeholder="Co sprawdzić, co zadziałało, hipoteza do następnej rolki">${esc(r.notatka)}</textarea>
      <div class="pod" id="notatka-stan">${stan.notatki[id] ? "zapisano " + fmtDataPelna(stan.notatki[id].zmieniono) : "zapisuje się samo"}</div>
    </div>`;
  $("#tlo-karty").classList.remove("ukryty");
  const zamien = $("#para-zamien");
  if (zamien) {
    zamien.addEventListener("click", async () => {
      const teraz = (stan.pary[id] && stan.pary[id].rola.includes("próbna")) ? "zwykla" : "probna";
      try {
        const odp = await api("/api/para", { id, rola: teraz });
        stan.paryReczne = odp.pary || {};
        rysujAnalize();
        otworzKarte(id);
      } catch (e) {
        alert("Nie zapisano: " + e.message);
      }
    });
  }
  let licznik;
  $("#notatka-pole").addEventListener("input", (e) => {
    clearTimeout(licznik);
    licznik = setTimeout(async () => {
      try {
        await api("/api/notatka", { id, tekst: e.target.value });
        stan.notatki[id] = e.target.value.trim() ? { tekst: e.target.value.trim(), zmieniono: new Date().toISOString() } : undefined;
        if (!stan.notatki[id]) delete stan.notatki[id];
        $("#notatka-stan").textContent = "zapisano " + fmtDataPelna(new Date().toISOString());
      } catch (err) {
        $("#notatka-stan").textContent = "nie zapisano: " + err.message;
      }
    }, 600);
  });
}

function zamknijKarte() {
  $("#tlo-karty").classList.add("ukryty");
}

// ---------- pobieranie ----------

async function pobierz() {
  const przycisk = $("#pobierz");
  przycisk.disabled = true;
  try {
    await api("/api/pobierz", {});
  } catch (e) {
    pokazPostep({ w_toku: false, krok: "błąd", blad: e.message });
    przycisk.disabled = false;
    return;
  }
  const petla = setInterval(async () => {
    const p = await api("/api/postep");
    pokazPostep(p);
    if (!p.w_toku) {
      clearInterval(petla);
      przycisk.disabled = false;
      await wczytajRolki();
      try {
        const s = await api("/api/stan");
        stan.ostatniePobranie = s.rolki && s.rolki.ostatnie_pobranie;
      } catch {}
      rysujAnalize();
      if (!p.blad) setTimeout(() => $("#postep").classList.add("ukryty"), 4000);
    }
  }, 1000);
}

function pokazPostep(p) {
  const el = $("#postep");
  el.classList.remove("ukryty");
  const proc = p.razem ? Math.round((p.zrobione / p.razem) * 100) : p.w_toku ? 5 : 100;
  $("#postep-wypelnienie").style.width = proc + "%";
  const opis = $("#postep-opis");
  opis.classList.toggle("blad", !!p.blad);
  if (p.blad) opis.textContent = "Nie udało się: " + p.blad;
  else if (p.krok === "gotowe") opis.textContent = "Gotowe, dane odświeżone.";
  else if (p.krok === "lista" || p.krok === "konto") opis.textContent = "Pobieram listę materiałów…";
  else if (p.krok === "długość") opis.textContent = `Mierzę długość rolki (${p.zrobione + 1} z ${p.razem})…`;
  else opis.textContent = `Pobieram statystyki (${p.zrobione} z ${p.razem})…`;
}

async function wczytajRolki() {
  const d = await api("/api/rolki");
  stan.rolki = d.rolki || [];
  stan.notatki = d.notatki || {};
  stan.paryReczne = d.pary || {};
}

// ---------- ustawienia ----------

function rysujUstawienia(s) {
  stan.token = s.token;
  stan.konto = s.konto;
  stan.ostatniePobranie = s.rolki && s.rolki.ostatnie_pobranie;
  const konto = $("#konto");
  konto.innerHTML = s.konto
    ? `${s.konto.avatar ? `<img src="${esc(s.konto.avatar)}" alt="">` : ""}<div><div><b>@${esc(s.konto.username)}</b> · ${fmtLiczba(s.konto.obserwujacy)} obserwujących</div><div class="pod">strona: ${esc(s.konto.strona || "")}</div></div>`
    : "Brak połączenia. Wklej token niżej.";
  const t = s.token || {};
  let opis, pasek, zle = false;
  if (!t.jest) { opis = "Nie ma tokena."; pasek = "brak tokena"; zle = true; }
  else if (t.wazny === false) { opis = "Token jest nieważny: " + (t.blad || "wygasł") + ". Wygeneruj nowy w Graph API Explorer i wklej niżej."; pasek = "token wygasł"; zle = true; }
  else if (t.wazny_do) {
    const dni = Math.round((new Date(t.wazny_do) - Date.now()) / 864e5);
    const godz = Math.round((new Date(t.wazny_do) - Date.now()) / 36e5);
    opis = "Token ważny do " + fmtDataPelna(t.wazny_do) + ".";
    pasek = dni >= 2 ? `token ważny ${dni} dni` : godz > 0 ? `token ważny ${godz} godz.` : "token wygasa";
    zle = godz <= 0;
  } else { opis = "Token jest zapisany. Ważność nieznana, kliknij „Sprawdź ważność”."; pasek = "token zapisany"; }
  $("#token-opis").textContent = opis;
  const ts = $("#token-stan");
  ts.textContent = pasek;
  ts.classList.toggle("zle", zle);
  $("#secret-stan").textContent = s.secret ? "app secret zapisany, tokeny są wymieniane na 60-dniowe" : "brak app secret, token krótkotrwały";
}

function komunikatTokena(tekst, blad) {
  const k = $("#token-komunikat");
  k.textContent = tekst;
  k.classList.toggle("blad", !!blad);
  k.classList.remove("ukryty");
}

async function zapiszToken() {
  const token = $("#token-pole").value.trim();
  if (!token) return komunikatTokena("Najpierw wklej token.", true);
  try {
    const s = await api("/api/token", { token });
    rysujUstawienia(s);
    $("#token-pole").value = "";
    komunikatTokena(s.token.wazny === false ? "Zapisano, ale Meta mówi, że token jest nieważny." : "Token zapisany.", s.token.wazny === false);
  } catch (e) {
    komunikatTokena(e.message, true);
  }
}

async function sprawdzToken() {
  try {
    const s = await api("/api/stan?sprawdz=1");
    rysujUstawienia(s);
    komunikatTokena(s.token.wazny ? "Token działa." : "Token nie działa: " + (s.token.blad || "wygasł"), !s.token.wazny);
  } catch (e) {
    komunikatTokena(e.message, true);
  }
}

async function zapiszSecret() {
  const secret = $("#secret-pole").value.trim();
  try {
    const s = await api("/api/secret", { secret });
    rysujUstawienia(s);
    $("#secret-pole").value = "";
    komunikatTokena("App secret zapisany, token wymieniony na długotrwały.");
  } catch (e) {
    komunikatTokena(e.message, true);
  }
}

async function zapiszKlientYouTube() {
  const client_id = $("#yt-client-id").value.trim();
  const client_secret = $("#yt-client-secret").value.trim();
  try {
    await api("/api/ustawienia/youtube_klient", { client_id, client_secret });
    $("#yt-client-id").value = "";
    $("#yt-client-secret").value = "";
    $("#yt-klient-stan").textContent = "klucz zapisany (" + client_id.slice(0, 12) + "…)";
    if (window.YouTube && typeof window.YouTube.start === "function") window.YouTube.start();
  } catch (e) {
    $("#yt-klient-stan").textContent = e.message;
  }
}

// ---------- zakladki ----------

function pokazWidok(nazwa) {
  $$(".widok").forEach((w) => w.classList.toggle("ukryty", w.id !== "widok-" + nazwa));
  $$(".zakladka").forEach((z) => z.classList.toggle("aktywna", z.dataset.widok === nazwa));
  try { localStorage.setItem("studio.widok", nazwa); } catch {}
}

// ---------- start ----------

async function start() {
  $$(".zakladka").forEach((z) => z.addEventListener("click", () => pokazWidok(z.dataset.widok)));
  $("#pobierz").addEventListener("click", pobierz);
  $("#szukaj").addEventListener("input", (e) => { stan.szukaj = e.target.value; rysujTabele(); });
  $("#filtr").addEventListener("change", (e) => { stan.filtr = e.target.value; rysujTabele(); });
  $("#tylko-rolki").addEventListener("change", (e) => { stan.tylkoRolki = e.target.checked; rysujAnalize(); });
  $$("#tabela th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const pole = th.dataset.sort;
      if (stan.sort.pole === pole) stan.sort.kierunek = stan.sort.kierunek === "asc" ? "desc" : "asc";
      else stan.sort = { pole, kierunek: pole === "tytul" ? "asc" : "desc" };
      rysujTabele();
    })
  );
  $("#wiersze").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) otworzKarte(tr.dataset.id);
  });
  $("#karta-zamknij").addEventListener("click", zamknijKarte);
  $("#tlo-karty").addEventListener("click", (e) => { if (e.target === e.currentTarget) zamknijKarte(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") zamknijKarte(); });
  $("#token-zapisz").addEventListener("click", zapiszToken);
  $("#token-sprawdz").addEventListener("click", sprawdzToken);
  $("#secret-zapisz").addEventListener("click", zapiszSecret);
  $("#yt-klient-zapisz").addEventListener("click", zapiszKlientYouTube);
  api("/api/ustawienia/youtube_klient").then((k) => {
    $("#yt-klient-stan").textContent = k.jest ? "klucz zapisany (" + k.client_id.slice(0, 12) + "…)" : "brak klucza";
  }).catch(() => {});

  let widok = "analiza";
  try { widok = localStorage.getItem("studio.widok") || "analiza"; } catch {}
  pokazWidok(widok);

  try {
    const [s] = await Promise.all([api("/api/stan?sprawdz=1"), wczytajRolki()]);
    rysujUstawienia(s);
    if (s.postep && s.postep.w_toku) pobierzWTle();
  } catch (e) {
    $("#token-stan").textContent = "serwer: " + e.message;
  }
  rysujAnalize();
  if (window.Research && typeof window.Research.start === "function") {
    try { window.Research.start(); } catch (e) { console.error("Research:", e); }
  }
  if (window.YouTube && typeof window.YouTube.start === "function") {
    try { window.YouTube.start(); } catch (e) { console.error("YouTube:", e); }
  }
  if (window.Publikacje && typeof window.Publikacje.start === "function") {
    try { window.Publikacje.start(); } catch (e) { console.error("Publikacje:", e); }
  }
}

function pobierzWTle() {
  $("#pobierz").disabled = true;
  const petla = setInterval(async () => {
    const p = await api("/api/postep");
    pokazPostep(p);
    if (!p.w_toku) {
      clearInterval(petla);
      $("#pobierz").disabled = false;
      await wczytajRolki();
      rysujAnalize();
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", start);
