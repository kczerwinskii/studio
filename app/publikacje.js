"use strict";

// Zakladka Publikacje: kalendarz tygodniowy z rolkami, kolejka, panel edycji, wysylka na Instagram.
// Rysuje do #publikacje-tresc, gada z /api/publikacje/... (moduly/publikacje.js).

window.Publikacje = (() => {
  const q = (sel, el) => (el || document).querySelector(sel);
  const qq = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
  const DNI = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
  const MIESIACE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const GODZ_OD = 6;
  const GODZ_DO = 23;
  const WYS_GODZ = 40;

  const st = {
    pozycje: [],
    wysylanie: null,
    wybrana: null,
    widok: "kalendarz",
    tydzien: poczatekTygodnia(new Date()),
    klatki: {},
    wgrywanie: null,
    petla: null,
    robocze: {},
    zapisy: {},
    liczniki: {},
    panelId: null,
    wysylkaKlik: false,
    uploady: {},
  };

  function poczatekTygodnia(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const dz = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dz);
    return x;
  }

  async function api(sciezka, dane, metoda) {
    const opcje = dane ? { method: metoda || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dane) } : undefined;
    const odp = await fetch(sciezka, opcje);
    const json = await odp.json().catch(() => ({}));
    if (!odp.ok) throw new Error(json.blad || "błąd " + odp.status);
    return json;
  }

  const fmtSek = (s) => (s == null ? "–" : Math.round(s) + " s");
  const fmtGodz = (iso) => {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  const fmtDataKrotka = (iso) => {
    const d = new Date(iso);
    return DNI[(d.getDay() + 6) % 7] + " " + d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0") + ", " + fmtGodz(iso);
  };
  const doLokalnego = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  };
  const STATUSY = { szkic: "szkic", zaplanowane: "zaplanowane", wysylanie: "wysyłanie", opublikowane: "opublikowane", blad: "błąd" };

  // ---------- szkielet ----------

  function szkielet() {
    q("#publikacje-tresc").innerHTML = `
      <div class="pub-gora">
        <div class="pub-nawigacja">
          <button class="przycisk" id="pub-wstecz" aria-label="Poprzedni tydzień">‹</button>
          <button class="przycisk" id="pub-tydzien"></button>
          <button class="przycisk" id="pub-dalej" aria-label="Następny tydzień">›</button>
          <button class="link" id="pub-dzis">dziś</button>
        </div>
        <div class="akcje">
          <span class="pod">harmonogram działa, gdy Studio jest otwarte</span>
          <button class="przycisk" id="pub-widok">Lista</button>
          <button class="przycisk zloty" id="pub-dodaj">+ Dodaj rolkę</button>
          <input type="file" id="pub-plik" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" multiple class="ukryty">
        </div>
      </div>
      <div class="pub-wgrywanie ukryty" id="pub-wgrywanie"></div>
      <div class="pub-szkice" id="pub-szkice"></div>
      <div class="pub-cialo">
        <div class="pub-lewa" id="pub-lewa"></div>
        <div class="pub-panel" id="pub-panel"></div>
      </div>
      <div class="pub-strefa ukryty" id="pub-strefa"><div>Upuść rolkę tutaj (MP4 albo MOV)</div></div>`;

    q("#pub-wstecz").addEventListener("click", () => przesunTydzien(-7));
    q("#pub-dalej").addEventListener("click", () => przesunTydzien(7));
    q("#pub-dzis").addEventListener("click", () => { st.tydzien = poczatekTygodnia(new Date()); rysuj(); });
    q("#pub-widok").addEventListener("click", () => { st.widok = st.widok === "kalendarz" ? "lista" : "kalendarz"; rysuj(); });
    q("#pub-dodaj").addEventListener("click", () => q("#pub-plik").click());
    q("#pub-plik").addEventListener("change", (e) => { wgrajPliki(Array.from(e.target.files)); e.target.value = ""; });

    const sekcja = q("#widok-publikacje");
    let licznikDrag = 0;
    sekcja.addEventListener("dragenter", (e) => { if (zPlikami(e)) { e.preventDefault(); licznikDrag++; q("#pub-strefa").classList.remove("ukryty"); } });
    sekcja.addEventListener("dragover", (e) => { if (zPlikami(e)) e.preventDefault(); });
    sekcja.addEventListener("dragleave", () => { licznikDrag = Math.max(0, licznikDrag - 1); if (!licznikDrag) q("#pub-strefa").classList.add("ukryty"); });
    sekcja.addEventListener("drop", (e) => {
      if (!zPlikami(e)) return;
      e.preventDefault();
      licznikDrag = 0;
      q("#pub-strefa").classList.add("ukryty");
      wgrajPliki(Array.from(e.dataTransfer.files));
    });
  }

  const zPlikami = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");

  function przesunTydzien(dni) {
    const t = new Date(st.tydzien);
    t.setDate(t.getDate() + dni);
    st.tydzien = t;
    rysuj();
  }

  // ---------- wgrywanie ----------

  function wgrajPliki(pliki) {
    const wideo = pliki.filter((f) => /\.(mp4|mov|m4v)$/i.test(f.name));
    if (!wideo.length) return komunikat("Instagram przyjmuje rolki jako MP4 albo MOV.", true);
    const kolejka = wideo.slice();
    const nastepny = () => {
      const f = kolejka.shift();
      if (!f) { st.wgrywanie = null; q("#pub-wgrywanie").classList.add("ukryty"); wczytaj(); return; }
      wgrajPlik(f).then(nastepny).catch((e) => { komunikat("Nie wgrano " + f.name + ": " + e.message, true); nastepny(); });
    };
    nastepny();
  }

  function wgrajPlik(plik) {
    return new Promise((resolve, reject) => {
      const el = q("#pub-wgrywanie");
      el.classList.remove("ukryty");
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", "/api/publikacje/plik?nazwa=" + encodeURIComponent(plik.name));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) el.textContent = `Wgrywam ${plik.name}: ${Math.round((e.loaded / e.total) * 100)}%`;
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            el.textContent = `Wgrano ${plik.name}, mierzę długość i wycinam kadry…`;
            if (json.pozycja) st.wybrana = json.pozycja.id;
            resolve(json);
          } else reject(new Error(json.blad || "błąd " + xhr.status));
        } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error("połączenie zerwane"));
      el.textContent = `Wgrywam ${plik.name}…`;
      xhr.send(plik);
    });
  }

  function komunikat(tekst, blad) {
    const el = q("#pub-wgrywanie");
    el.classList.remove("ukryty");
    el.classList.toggle("blad", !!blad);
    el.textContent = tekst;
    setTimeout(() => { el.classList.add("ukryty"); el.classList.remove("blad"); }, 6000);
  }

  // ---------- dane ----------

  async function wczytaj() {
    try {
      const d = await api("/api/publikacje");
      st.pozycje = d.pozycje || [];
      st.wysylanie = d.wysylanie || null;
      st.facebook = d.facebook || { dostepny: false };
      st.youtube = d.youtube || { polaczony: false };
      st.tiktok = d.tiktok || { polaczony: false };
      if (st.wybrana && !st.pozycje.some((p) => p.id === st.wybrana)) st.wybrana = null;
      rysuj();
    } catch (e) { komunikat("Nie wczytano kolejki: " + e.message, true); }
    finally {
      clearTimeout(st.petla);
      st.petla = setTimeout(wczytaj, st.wysylanie ? 4000 : 30000);
    }
  }

  function zapiszPole(id, pola) {
    st.robocze[id] = { ...st.robocze[id], ...pola };
    const poprzedni = st.zapisy[id] || Promise.resolve();
    const zapis = poprzedni.catch(() => {}).then(async () => {
      const odp = await api("/api/publikacje/zapisz", { id, ...pola });
      const i = st.pozycje.findIndex((p) => p.id === id);
      if (i >= 0) st.pozycje[i] = odp.pozycja;
      for (const [klucz, wartosc] of Object.entries(pola)) {
        if (st.robocze[id]?.[klucz] === wartosc) delete st.robocze[id][klucz];
      }
      if (pola.usun_okladke) delete st.uploady[id];
      return odp.pozycja;
    }).catch((e) => { komunikat("Nie zapisano: " + e.message, true); return null; });
    st.zapisy[id] = zapis;
    zapis.finally(() => { if (st.zapisy[id] === zapis) delete st.zapisy[id]; });
    return zapis;
  }

  async function dokonczZapisy(id) {
    if (st.uploady[id] && !await st.uploady[id]) throw new Error("Nie zapisano okładki. Ponów jej wgranie przed publikacją.");
    clearTimeout(st.liczniki[id]);
    if (st.zapisy[id]) await st.zapisy[id];
    const pola = { ...st.robocze[id] };
    if (Object.keys(pola).length && !await zapiszPole(id, pola)) throw new Error("Najpierw zapisz zmiany. Publikacja nie została rozpoczęta.");
    return st.pozycje.find((p) => p.id === id);
  }

  async function rozpocznij(id, tylkoTest) {
    if (st.wysylkaKlik || st.wysylanie) return;
    st.wysylkaKlik = true;
    try {
      const p = await dokonczZapisy(id);
      if (!p) throw new Error("Nie ma takiej pozycji.");
      const platformy = p.instagram?.media_id ? "Facebooku (Instagram jest już opublikowany)" :
        ["Instagramie", ...(p.facebook ? ["Facebooku"] : []), ...(p.youtube ? ["YouTube"] : []), ...(p.tiktok ? ["TikToku"] : [])].join(", ");
      if (!tylkoTest && !confirm(`Opublikować „${tytul(p)}" na ${platformy} teraz?${p.probna ? " Jako rolkę próbną." : ""}`)) return;
      await api("/api/publikacje/wyslij", { id, test: tylkoTest });
      st.wysylanie = id;
      if (tylkoTest) komunikat("Test ruszył: plik idzie do Instagrama, ale nie zostanie opublikowany.");
      await wczytaj();
    } catch (e) { komunikat(e.message, true); }
    finally { st.wysylkaKlik = false; }
  }

  // ---------- rysowanie ----------

  function rysuj() {
    rysujNaglowek();
    rysujSzkice();
    if (st.widok === "kalendarz") rysujKalendarz();
    else rysujListe();
    rysujPanel();
  }

  function rysujNaglowek() {
    const a = st.tydzien;
    const b = new Date(a);
    b.setDate(b.getDate() + 6);
    const tekst = a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${MIESIACE[b.getMonth()]} ${b.getFullYear()}`
      : `${a.getDate()} ${MIESIACE[a.getMonth()]} – ${b.getDate()} ${MIESIACE[b.getMonth()]} ${b.getFullYear()}`;
    q("#pub-tydzien").textContent = tekst;
    q("#pub-widok").textContent = st.widok === "kalendarz" ? "Lista" : "Kalendarz";
    q("#pub-nawigacja") && q("#pub-nawigacja").classList.toggle("ukryty", st.widok !== "kalendarz");
  }

  function miniatura(p, klasa) {
    const src = p.okladka_plik
      ? `/api/publikacje/okladka?id=${p.id}&t=${encodeURIComponent(p.okladka_plik.length)}`
      : `/api/publikacje/klatka?id=${p.id}&n=${kadrNr(p)}`;
    return `<img class="${klasa}" src="${src}" alt="" onerror="this.style.visibility='hidden'">`;
  }

  function kadrNr(p) {
    const kl = st.klatki[p.id];
    if (!kl || !kl.length) return 0;
    if (p.okladka_s == null) return 0;
    let naj = 0;
    for (const k of kl) if (Math.abs(k.sekunda - p.okladka_s) < Math.abs(kl[naj].sekunda - p.okladka_s)) naj = k.n;
    return naj;
  }

  function rysujSzkice() {
    const szkice = st.pozycje.filter((p) => !p.termin && p.status !== "opublikowane");
    const el = q("#pub-szkice");
    if (!szkice.length) { el.innerHTML = ""; return; }
    el.innerHTML = `<span class="pod">Bez terminu:</span>` + szkice.map((p) =>
      `<button class="pub-chip ${p.id === st.wybrana ? "aktywny" : ""}" data-id="${p.id}" draggable="true">${esc(p.nazwa || p.id)}${p.status === "blad" ? ' <span class="pub-blad">błąd</span>' : ""}${p.status === "wysylanie" ? " · wysyłanie" : ""}</button>`
    ).join("");
    qq(".pub-chip", el).forEach((b) => {
      b.addEventListener("click", () => { st.wybrana = b.dataset.id; rysuj(); });
      b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/studio-id", b.dataset.id));
    });
  }

  function rysujKalendarz() {
    const lewa = q("#pub-lewa");
    const dni = [];
    for (let i = 0; i < 7; i++) { const d = new Date(st.tydzien); d.setDate(d.getDate() + i); dni.push(d); }
    const dzis = new Date(); dzis.setHours(0, 0, 0, 0);
    const godziny = [];
    for (let h = GODZ_OD; h <= GODZ_DO; h++) godziny.push(h);
    lewa.innerHTML = `
      <div class="kal">
        <div class="kal-naglowek">
          <div></div>
          ${dni.map((d) => `<div class="${d.getTime() === dzis.getTime() ? "dzis" : ""}">${DNI[(d.getDay() + 6) % 7]}<br><b>${d.getDate()}</b></div>`).join("")}
        </div>
        <div class="kal-siatka" style="height:${godziny.length * WYS_GODZ}px">
          <div class="kal-godziny">${godziny.map((h) => `<div style="height:${WYS_GODZ}px">${h}:00</div>`).join("")}</div>
          ${dni.map((d, i) => `<div class="kal-dzien ${d.getTime() === dzis.getTime() ? "dzis" : ""}" data-dzien="${i}">${godziny.map(() => `<div class="kal-komorka" style="height:${WYS_GODZ}px"></div>`).join("")}</div>`).join("")}
        </div>
        <div class="pod kal-stopka">Przeciągnij rolkę na inny dzień albo godzinę, żeby zmienić termin. Kliknij w rolkę, żeby ją edytować.</div>
      </div>`;

    const koniec = new Date(st.tydzien); koniec.setDate(koniec.getDate() + 7);
    const wTygodniu = st.pozycje.filter((p) => {
      const t = p.termin || p.opublikowano;
      if (!t) return false;
      const d = new Date(t);
      return d >= st.tydzien && d < koniec;
    });
    for (const p of wTygodniu) {
      const t = new Date(p.termin || p.opublikowano);
      const dzien = (t.getDay() + 6) % 7;
      const minuty = (t.getHours() - GODZ_OD) * 60 + t.getMinutes();
      const top = Math.max(0, Math.min((GODZ_DO - GODZ_OD + 1) * 60 - 30, minuty)) * (WYS_GODZ / 60);
      const kol = q(`.kal-dzien[data-dzien="${dzien}"]`, lewa);
      const karta = document.createElement("div");
      karta.className = `kal-karta ${p.status} ${p.id === st.wybrana ? "aktywna" : ""}`;
      karta.style.top = top + "px";
      karta.draggable = p.status !== "opublikowane" && p.status !== "wysylanie";
      karta.dataset.id = p.id;
      karta.innerHTML = `${miniatura(p, "kal-mini")}<div class="kal-tekst"><div class="kal-tytul">${esc(tytul(p))}</div><div class="kal-pod">${fmtGodz(t)} · ${STATUSY[p.status] || p.status}${p.probna ? " · próbna" : ""}</div></div>`;
      karta.addEventListener("click", () => { st.wybrana = p.id; rysuj(); });
      karta.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/studio-id", p.id));
      kol.appendChild(karta);
    }

    qq(".kal-dzien", lewa).forEach((kol, i) => {
      kol.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/studio-id")) e.preventDefault(); });
      kol.addEventListener("drop", async (e) => {
        const id = e.dataTransfer.getData("text/studio-id");
        if (!id) return;
        e.preventDefault();
        const prost = kol.getBoundingClientRect();
        const y = e.clientY - prost.top;
        let minuty = Math.round((y / WYS_GODZ) * 60 / 15) * 15;
        minuty = Math.max(0, Math.min((GODZ_DO - GODZ_OD + 1) * 60 - 15, minuty));
        const t = new Date(st.tydzien);
        t.setDate(t.getDate() + i);
        t.setHours(GODZ_OD, 0, 0, 0);
        t.setMinutes(minuty);
        if (!Number.isFinite(t.getTime()) || t.getTime() < Date.now()) return komunikat("Ten termin już minął.", true);
        await zapiszPole(id, { termin: t.toISOString() });
        st.wybrana = id;
        rysuj();
      });
    });
  }

  function tytul(p) {
    const linia = (p.opis || "").split(/\r?\n/).map((l) => l.trim()).find((l) => l);
    return linia || (p.nazwa || "").replace(/\.(mp4|mov|m4v)$/i, "");
  }

  function rysujListe() {
    const lewa = q("#pub-lewa");
    const lista = st.pozycje.slice().sort((a, b) => {
      const ta = a.termin || a.opublikowano || a.dodano, tb = b.termin || b.opublikowano || b.dodano;
      return new Date(tb) - new Date(ta);
    });
    lewa.innerHTML = lista.length
      ? `<div class="tabela-obszar"><table class="tabela pub-tabela"><thead><tr><th style="width:52px"></th><th>Rolka</th><th class="w-liczba">Dł.</th><th style="width:150px">Termin</th><th style="width:120px">Status</th></tr></thead><tbody>${lista.map((p) => `
          <tr data-id="${p.id}" class="${p.id === st.wybrana ? "aktywny" : ""}">
            <td>${miniatura(p, "pub-mini")}</td>
            <td><div class="mocna">${esc(tytul(p))}</div><div class="pod">${esc(p.nazwa || "")}${p.probna ? " · próbna" : ""}</div></td>
            <td class="liczba">${fmtSek(p.dlugosc)}</td>
            <td class="liczba">${p.termin ? fmtDataKrotka(p.termin) : p.opublikowano ? fmtDataKrotka(p.opublikowano) : "–"}</td>
            <td>${etykieta(p)}</td>
          </tr>`).join("")}</tbody></table></div>`
      : `<div class="pusto"><p>Kolejka jest pusta.</p><p class="pod">Kliknij „+ Dodaj rolkę" albo przeciągnij plik MP4 na tę zakładkę.</p></div>`;
    qq("tr[data-id]", lewa).forEach((tr) => tr.addEventListener("click", () => { st.wybrana = tr.dataset.id; rysuj(); }));
  }

  function etykieta(p) {
    if (p.status === "opublikowane") return '<span class="sygnal">opublikowane</span>';
    if (p.status === "zaplanowane") return '<span class="sygnal dobry">zaplanowane</span>';
    if (p.status === "wysylanie") return `<span class="sygnal dobry">wysyłanie</span>`;
    if (p.status === "blad") return '<span class="sygnal pub-blad">błąd</span>';
    return '<span class="sygnal cichy">szkic</span>';
  }

  // ---------- panel edycji ----------

  function polaPlatform(p, blokada) {
    const opcje = (lista, wybrana) => lista.map(([wartosc, tekst]) => `<option value="${wartosc}" ${wartosc === wybrana ? "selected" : ""}>${tekst}</option>`).join("");
    const tytulYt = p.youtube_tytul ?? Array.from((p.opis || "").split(/\r?\n/)[0]).slice(0, 100).join("");
    const przelacznik = (nazwa, tekst) => `<label class="przelacznik"><input type="checkbox" id="pub-${nazwa}" ${p[nazwa] ? "checked" : ""} ${blokada ? "disabled" : ""}> ${tekst}</label>`;
    return (st.youtube?.polaczony ? przelacznik("youtube", "YouTube") + `
      <div id="pub-youtube-pola" class="${p.youtube ? "" : "ukryty"}">
        <label class="pub-etykieta" for="pub-youtube-tytul">Tytuł na YouTube</label>
        <input id="pub-youtube-tytul" value="${esc(tytulYt)}" ${blokada ? "disabled" : ""}>
        <div class="pod" id="pub-youtube-licznik">${Array.from(tytulYt).length}/100</div>
        <select aria-label="Prywatność YouTube" id="pub-youtube-prywatnosc" ${blokada ? "disabled" : ""}>${opcje([
          ["private", "prywatny, przełączysz w YouTube Studio"], ["unlisted", "niepubliczny (z linkiem)"], ["public", "publiczny"]], p.youtube_prywatnosc || "private")}</select>
        <div class="pod">Bez audytu Google film i tak pozostanie prywatny.</div>
      </div>` : '<div class="pod">YouTube: połącz w Ustawieniach</div>') +
      (st.tiktok?.polaczony ? przelacznik("tiktok", "TikTok") + `
      <div id="pub-tiktok-pola" class="${p.tiktok ? "" : "ukryty"}">
        <select aria-label="Widoczność TikToka" id="pub-tiktok-widocznosc" ${blokada ? "disabled" : ""}>${opcje([
          ["SELF_ONLY", "Tylko ja"], ["PUBLIC_TO_EVERYONE", "Wszyscy"], ["MUTUAL_FOLLOW_FRIENDS", "Znajomi"], ["FOLLOWER_OF_CREATOR", "Obserwujący"]], p.tiktok_widocznosc || "SELF_ONLY")}</select>
        <div class="pod">Do czasu audytu TikToka wybierz „Tylko ja”.</div>
      </div>` : '<div class="pod">TikTok: połącz w Ustawieniach</div>');
  }

  function wynikiPlatform(p) {
    let tekst = "";
    if (p.youtube_wynik?.link) {
      try {
        const adres = new URL(p.youtube_wynik.link);
        if (adres.protocol === "https:" && ["www.youtube.com", "youtube.com", "youtu.be"].includes(adres.hostname))
          tekst += `<div><a href="${esc(adres.href)}" target="_blank" rel="noopener">na YouTube</a></div>`;
      } catch {}
    }
    if (p.tiktok_wynik) tekst += `<div>na TikToku${p.tiktok_wynik.widocznosc === "SELF_ONLY" ? " (widoczne tylko dla Ciebie)" : ""}</div>`;
    for (const [pole, nazwa] of [["facebook", "Facebook"], ["youtube", "YouTube"], ["tiktok", "TikTok"]])
      if (p["blad_" + pole]) tekst += `<div class="pub-blad-tekst">${nazwa}: ${esc(p["blad_" + pole])}</div>`;
    return tekst;
  }

  async function rysujPanel() {
    const panel = q("#pub-panel");
    const zapisany = st.pozycje.find((x) => x.id === st.wybrana);
    // Odświeżanie i odpowiedź z kadrami nie wymieniają edytowanego formularza.
    if (st.panelId === st.wybrana && (panel.contains(document.activeElement) || st.zapisy[st.wybrana])) {
      for (const id of ["#pub-teraz", "#pub-test"]) {
        const przycisk = q(id);
        if (przycisk) przycisk.disabled = !!st.wysylanie || !!zapisany?.niepewna;
      }
      return;
    }
    st.panelId = st.wybrana;
    const p = zapisany ? { ...zapisany, ...st.robocze[zapisany.id] } : null;
    if (!p) {
      panel.innerHTML = `<div class="pod pub-panel-pusty">Wybierz rolkę w kalendarzu albo dodaj nową.<br><br>Rolka trafia do kolejki jako szkic. Ustaw termin, a Studio wyśle ją o czasie, jeśli będzie otwarte. Po otwarciu Studio wyśle zaległe rolki od najwcześniejszego terminu. Terminy są w strefie ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}. „Opublikuj teraz" wysyła od razu.</div>`;
      return;
    }
    if (!st.klatki[p.id]) {
      st.klatki[p.id] = [];
      api("/api/publikacje/klatki?id=" + p.id).then((d) => { st.klatki[p.id] = d.klatki || []; if (st.wybrana === p.id) rysujPanel(); }).catch(() => {});
    }
    const klatki = st.klatki[p.id] || [];
    const blokada = p.status === "wysylanie" || p.status === "opublikowane" || !!p.instagram?.media_id || !!p.niepewna;
    const moznaPonowicFb = p.status === "blad" && p.instagram?.media_id && p.facebook && !p.facebook_wynik && !p.niepewna;
    panel.innerHTML = `
      <div class="pub-panel-gora">
        ${miniatura(p, "pub-okladka")}
        <div style="min-width:0">
          <div class="pub-nazwa" title="${esc(p.nazwa)}">${esc(p.nazwa)}</div>
          <div class="pod">${fmtSek(p.dlugosc)} · ${Math.round((p.rozmiar || 0) / 1048576)} MB${p.termin ? " · " + fmtDataKrotka(p.termin) : ""}</div>
          <div class="pub-status">${etykieta(p)}${p.etap_opis ? ` <span class="pod">${esc(p.etap_opis)}</span>` : ""}</div>
          ${p.blad ? `<div class="pub-blad-tekst">${esc(p.blad)}</div>` : ""}
          ${p.instagram && p.instagram.permalink ? `<a href="${esc(p.instagram.permalink)}" target="_blank" rel="noopener">otwórz na Instagramie</a>` : ""}
          ${p.facebook_wynik && p.facebook_wynik.link ? ` · <a href="${esc(p.facebook_wynik.link)}" target="_blank" rel="noopener">na Facebooku</a>` : ""}
          ${wynikiPlatform(p)}
        </div>
      </div>
      <label class="pub-etykieta">Opis</label>
      <textarea id="pub-opis" rows="5" placeholder="Opis pod rolką, hashtagi, CTA" ${blokada ? "disabled" : ""}>${esc(p.opis || "")}</textarea>
      <label class="pub-etykieta">Termin</label>
      <div class="pub-termin">
        <input type="datetime-local" id="pub-termin" value="${doLokalnego(p.termin)}" ${blokada ? "disabled" : ""}>
        ${p.termin && !blokada ? '<button class="link" id="pub-termin-usun">bez terminu</button>' : ""}
      </div>
      <label class="pub-etykieta">Okładka ${p.okladka_plik ? '<span class="pod">własny obraz</span>' : p.okladka_s != null ? `<span class="pod">kadr z ${p.okladka_s} s</span>` : '<span class="pod">pierwszy kadr</span>'}</label>
      <div class="pub-klatki">
        ${klatki.length ? klatki.map((k) => `<img src="${k.url}" alt="" title="${k.sekunda} s" data-s="${k.sekunda}" class="${!p.okladka_plik && p.okladka_s != null && Math.abs(p.okladka_s - k.sekunda) < 0.05 ? "wybrana" : ""}">`).join("") : '<span class="pod">wycinam kadry…</span>'}
        <button class="pub-wlasna" id="pub-okladka-wlasna" ${blokada ? "disabled" : ""}>${p.okladka_plik ? "zmień własną" : "własna"}</button>
        ${p.okladka_plik && !blokada ? '<button class="link" id="pub-okladka-usun">usuń własną</button>' : ""}
        <input type="file" id="pub-okladka-plik" accept="image/jpeg,image/png,.jpg,.jpeg,.png" class="ukryty">
      </div>
      ${p.okladka_plik && !(st.facebook && st.facebook.dostepny) ? '<div class="pod">Własna okładka wymaga podpiętego Facebooka (Instagram chce adresu obrazka w sieci, a Twoja strona robi za hosting). Wygeneruj token z uprawnieniami strony.</div>' : ""}
      <label class="pub-etykieta">Ustawienia</label>
      <label class="przelacznik"><input type="checkbox" id="pub-probna" ${p.probna ? "checked" : ""} ${blokada ? "disabled" : ""}> rolka próbna (tylko do nieobserwujących)</label>
      <select id="pub-probna-status" class="${p.probna ? "" : "ukryty"}" ${blokada ? "disabled" : ""}>
        <option value="MANUAL" ${p.probna_status !== "SS_PERFORMANCE" ? "selected" : ""}>przenoszę do obserwujących sam, w aplikacji</option>
        <option value="SS_PERFORMANCE" ${p.probna_status === "SS_PERFORMANCE" ? "selected" : ""}>Instagram przeniesie sam, gdy dobrze pójdzie</option>
      </select>
      <label class="przelacznik"><input type="checkbox" id="pub-feed" ${p.do_feedu === false ? "" : "checked"} ${blokada ? "disabled" : ""}> pokaż też w feedzie profilu</label>
      <label class="pub-etykieta">Platformy</label>
      <div class="pub-platformy">
        <div><span class="zloty-znak">☑</span> Instagram</div>
        ${st.facebook && st.facebook.dostepny
          ? `<label class="przelacznik"><input type="checkbox" id="pub-facebook" ${p.facebook ? "checked" : ""} ${blokada ? "disabled" : ""}> Facebook, strona ${esc(st.facebook.strona || "")}</label>`
          : '<div class="pod">☐ Facebook <span class="typ">brak uprawnień strony w tokenie</span></div>'}
        ${polaPlatform(p, blokada)}
      </div>
      <div class="pub-przyciski">
        ${!blokada || moznaPonowicFb ? '<button class="przycisk zloty" id="pub-teraz">Opublikuj teraz</button><button class="przycisk" id="pub-test">Test bez publikacji</button>' : ""}
        ${p.status !== "wysylanie" ? '<button class="przycisk" id="pub-usun">Usuń</button>' : ""}
      </div>`;

    for (const id of ["#pub-teraz", "#pub-test"]) {
      const przycisk = q(id);
      if (przycisk) przycisk.disabled = !!st.wysylanie || !!p.niepewna || (id === "#pub-test" && !!p.instagram?.media_id);
    }
    const opis = q("#pub-opis");
    if (opis) opis.addEventListener("input", () => {
      st.robocze[p.id] = { ...st.robocze[p.id], opis: opis.value };
      clearTimeout(st.liczniki[p.id]);
      st.liczniki[p.id] = setTimeout(() => zapiszPole(p.id, { ...st.robocze[p.id] }), 600);
      const yt = q("#pub-youtube-tytul");
      if (yt && p.youtube_tytul == null && st.robocze[p.id].youtube_tytul == null) {
        yt.value = Array.from(opis.value.split(/\r?\n/)[0]).slice(0, 100).join("");
        q("#pub-youtube-licznik").textContent = Array.from(yt.value).length + "/100";
      }
    });
    for (const [id, pole] of [["youtube", "youtube"], ["tiktok", "tiktok"], ["youtube-tytul", "youtube_tytul"],
      ["youtube-prywatnosc", "youtube_prywatnosc"], ["tiktok-widocznosc", "tiktok_widocznosc"]]) {
      const el = q("#pub-" + id);
      if (!el) continue;
      el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
        if (pole === "youtube_tytul") {
          el.value = Array.from(el.value).slice(0, 100).join("");
          q("#pub-youtube-licznik").textContent = Array.from(el.value).length + "/100";
        }
        st.robocze[p.id] = { ...st.robocze[p.id], [pole]: el.type === "checkbox" ? el.checked : el.value };
        if (el.type === "checkbox") q("#pub-" + id + "-pola").classList.toggle("ukryty", !el.checked);
        clearTimeout(st.liczniki[p.id]);
        st.liczniki[p.id] = setTimeout(() => zapiszPole(p.id, { ...st.robocze[p.id] }), 600);
      });
    }
    const termin = q("#pub-termin");
    if (termin) termin.addEventListener("change", async () => {
      if (!termin.value) return;
      const t = new Date(termin.value);
      if (!Number.isFinite(t.getTime()) || t.getTime() < Date.now()) return komunikat("Ten termin już minął.", true);
      await zapiszPole(p.id, { termin: t.toISOString() });
      st.tydzien = poczatekTygodnia(t);
      rysuj();
    });
    const terminUsun = q("#pub-termin-usun");
    if (terminUsun) terminUsun.addEventListener("click", async () => { await zapiszPole(p.id, { termin: null }); rysuj(); });
    qq(".pub-klatki img").forEach((img) => img.addEventListener("click", async () => {
      if (blokada) return;
      await zapiszPole(p.id, { okladka_s: Number(img.dataset.s), usun_okladke: !!p.okladka_plik });
      rysuj();
    }));
    const wlasna = q("#pub-okladka-wlasna");
    if (wlasna) wlasna.addEventListener("click", () => q("#pub-okladka-plik").click());
    const okladkaPlik = q("#pub-okladka-plik");
    if (okladkaPlik) okladkaPlik.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      st.uploady[p.id] = (async () => {
      try {
        const odp = await fetch("/api/publikacje/okladka?id=" + p.id + "&nazwa=" + encodeURIComponent(f.name), { method: "PUT", body: f });
        const json = await odp.json();
        if (!odp.ok) throw new Error(json.blad || "błąd");
        await wczytaj();
        return true;
      } catch (err) { komunikat("Nie wgrano okładki: " + err.message, true); return false; }
      })();
      await st.uploady[p.id];
    });
    const okladkaUsun = q("#pub-okladka-usun");
    if (okladkaUsun) okladkaUsun.addEventListener("click", async () => { await zapiszPole(p.id, { usun_okladke: true }); rysuj(); });
    const probna = q("#pub-probna");
    if (probna) probna.addEventListener("change", async () => { await zapiszPole(p.id, { probna: probna.checked }); st.panelId = null; rysuj(); });
    const probnaStatus = q("#pub-probna-status");
    if (probnaStatus) probnaStatus.addEventListener("change", () => zapiszPole(p.id, { probna_status: probnaStatus.value }));
    const fbPole = q("#pub-facebook");
    if (fbPole) fbPole.addEventListener("change", () => zapiszPole(p.id, { facebook: fbPole.checked }));
    const feed = q("#pub-feed");
    if (feed) feed.addEventListener("change", () => zapiszPole(p.id, { do_feedu: feed.checked }));
    const teraz = q("#pub-teraz");
    if (teraz) teraz.addEventListener("click", () => rozpocznij(p.id, false));
    const test = q("#pub-test");
    if (test) test.addEventListener("click", () => rozpocznij(p.id, true));
    const usun = q("#pub-usun");
    if (usun) usun.addEventListener("click", async () => {
      if (!confirm(`Usunąć „${tytul(p)}" z kolejki?${p.status === "opublikowane" ? " Rolka na Instagramie zostaje." : ""}`)) return;
      clearTimeout(st.liczniki[p.id]);
      if (st.zapisy[p.id]) await st.zapisy[p.id];
      try { await api("/api/publikacje/usun", { id: p.id }); } catch (e) { return komunikat(e.message, true); }
      delete st.robocze[p.id];
      st.wybrana = null;
      wczytaj();
    });
  }

  // ---------- start ----------

  function start() {
    if (!q("#publikacje-tresc")) return;
    szkielet();
    wczytaj().catch((e) => komunikat("Nie wczytano kolejki: " + e.message, true));
  }

  return { start };
})();
