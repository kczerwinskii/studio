"use strict";
// Zakladka Research, wspolne klasy i paleta jak w Publikacjach.
window.ResearchKonta = (() => {
  const znajdz = (selektor) => document.querySelector(selektor);
  const bezpiecznyTekst = (tekst) => String(tekst ?? "").replace(/[&<>"']/g, (znak) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[znak]));
  const liczba = (wartosc) => wartosc == null ? "brak danych" : wartosc.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  const data = (wartosc) => wartosc && Number.isFinite(Date.parse(wartosc)) ? new Date(wartosc).toLocaleDateString("pl-PL") : "jeszcze nie pobrano";
  const adres = (wartosc) => {
    try { const url = new URL(wartosc); return url.protocol === "https:" ? bezpiecznyTekst(url.href) : ""; } catch { return ""; }
  };
  const stan = { dane: { konta: [], posty: {}, notatki: {}, ustawienia: { prog: 3 } },
    konto: "", szukaj: "", rolki: true, sort: "krotnosc", kierunek: -1, wybrany: null,
    w_toku: false, zajety: false, petla: null, uruchomiony: false, notatki: new Map() };

  async function api(sciezka, dane, metoda = "POST") {
    const odpowiedz = await fetch("/api/research" + sciezka, dane === undefined ? undefined : {
      method: metoda, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dane),
    });
    const wynik = await odpowiedz.json();
    if (!odpowiedz.ok) throw new Error(wynik.blad || "Nie udało się wykonać operacji.");
    return wynik;
  }
  function komunikat(tekst) { znajdz("#res-komunikat").textContent = tekst; }
  function blokady() {
    document.querySelectorAll("#res-dodaj, #res-pobierz, #res-konta button").forEach((przycisk) => {
      przycisk.disabled = stan.w_toku || stan.zajety;
    });
    znajdz("#res-prog").disabled = stan.zajety;
  }
  async function wykonaj(operacja) {
    if (stan.zajety) return;
    stan.zajety = true; blokady(); komunikat("");
    try { await operacja(); } catch (blad) { komunikat(blad.message); }
    finally { stan.zajety = false; blokady(); }
  }

  function szkielet() {
    if (!znajdz("#research-style")) {
      const styl = document.createElement("style");
      styl.id = "research-style";
      styl.textContent = `
        #research-konta-tresc .res-konta {display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
        #research-konta-tresc .res-konto {display:flex;gap:10px;align-items:flex-start;max-width:340px}
        #research-konta-tresc .res-konto img {width:34px;height:34px;border-radius:50%;object-fit:cover}
        #research-konta-tresc .res-konto .pod {overflow-wrap:anywhere}
        #research-konta-tresc .tabela-obszar {overflow-x:auto}
        #research-konta-tresc .tabela {min-width:960px;table-layout:auto}
        #research-konta-tresc th {text-transform:none}
        #research-konta-tresc th button {font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
        #research-konta-tresc .res-tytul {max-width:310px}
        #research-konta-tresc .res-szczegoly td {white-space:normal;cursor:default}
        #research-konta-tresc .res-panel {display:flex;gap:18px;padding:12px;align-items:flex-start}
        #research-konta-tresc .res-panel img {width:150px;max-height:240px;object-fit:contain}
        #research-konta-tresc .res-tresc {min-width:0;flex:1}
        #research-konta-tresc .res-opis {white-space:pre-wrap;overflow-wrap:anywhere}
        #research-konta-tresc textarea {display:block;width:100%;min-height:90px;margin-top:8px;font:inherit}
        #research-konta-tresc progress {accent-color:var(--zloto);width:200px}
        #research-konta-tresc .res-postep {display:flex;gap:10px;align-items:center;margin:8px 0}
      `;
      document.head.appendChild(styl);
    }
    znajdz("#research-konta-tresc").innerHTML = `
      <form id="res-formularz" class="filtry">
        <input id="res-nazwa" placeholder="@nazwa konta" aria-label="Nazwa konta" maxlength="31" required>
        <button id="res-dodaj" class="przycisk zloty">Dodaj konto</button>
        <button type="button" id="res-pobierz" class="przycisk">Pobierz nowe dane</button>
        <label>Próg <select id="res-prog">${[2, 2.5, 3, 4].map((prog) => `<option value="${prog}" ${prog === 3 ? "selected" : ""}>${liczba(prog)}×</option>`).join("")}</select></label>
        <label><input type="checkbox" id="res-rolki" checked> Tylko rolki</label>
      </form>
      <div id="res-postep" class="res-postep" role="status"></div>
      <div id="res-komunikat" class="komunikat" role="status"></div>
      <div id="res-konta" class="res-konta"></div>
      <div id="res-pusto" class="plansza" hidden><p>Opcjonalnie dodaj wybrane konto. Ten starszy widok porównuje polubienia i komentarze, nie wyświetlenia.</p><button class="przycisk zloty" id="res-pierwsze">Dodaj pierwsze konto</button></div>
      <h2>Odstające</h2>
      <div class="filtry"><select id="res-filtr" aria-label="Filtr konta"></select><input id="res-szukaj" placeholder="Szukaj w tytule" aria-label="Szukaj w tytule"></div>
      <div id="res-tabela" class="tabela-obszar"></div>`;
    znajdz("#res-pierwsze").onclick = () => znajdz("#res-nazwa").focus();
    znajdz("#res-formularz").onsubmit = (zdarzenie) => {
      zdarzenie.preventDefault();
      void wykonaj(async () => {
        const wynik = await api("/konto", { username: znajdz("#res-nazwa").value });
        znajdz("#res-nazwa").value = "";
        await wczytaj();
        if (wynik.blad) komunikat(wynik.blad);
      });
    };
    znajdz("#res-pobierz").onclick = () => void wykonaj(async () => {
      await api("/pobierz", {});
      // Nawet bardzo szybkie pobranie musi odswiezyc dane po zakonczeniu.
      stan.w_toku = true;
      await sprawdzPostep();
    });
    znajdz("#res-prog").onchange = () => void wykonaj(async () => {
      try { await api("/prog", { prog: Number(znajdz("#res-prog").value) }); await wczytaj(); }
      finally { znajdz("#res-prog").value = String(stan.dane.ustawienia.prog); }
    });
    znajdz("#res-rolki").onchange = (zdarzenie) => { stan.rolki = zdarzenie.target.checked; tabela(); };
    znajdz("#res-filtr").onchange = (zdarzenie) => { stan.konto = zdarzenie.target.value; tabela(); };
    znajdz("#res-szukaj").oninput = (zdarzenie) => { stan.szukaj = zdarzenie.target.value.toLocaleLowerCase("pl-PL"); tabela(); };
    znajdz("#res-konta").onclick = (zdarzenie) => {
      const przycisk = zdarzenie.target.closest("button[data-usun]");
      if (przycisk && confirm("Usunąć @" + przycisk.dataset.usun + " i jego posty?")) void wykonaj(async () => {
        await api("/konto?username=" + encodeURIComponent(przycisk.dataset.usun), {}, "DELETE"); await wczytaj();
      });
    };
    znajdz("#res-tabela").onclick = (zdarzenie) => {
      const naglowek = zdarzenie.target.closest("button[data-sort]");
      if (naglowek) {
        stan.kierunek = stan.sort === naglowek.dataset.sort ? -stan.kierunek : -1;
        stan.sort = naglowek.dataset.sort; tabela(); return;
      }
      if (zdarzenie.target.closest(".res-szczegoly")) return;
      const wiersz = zdarzenie.target.closest("tr[data-post]");
      if (wiersz) { stan.wybrany = stan.wybrany === wiersz.dataset.post ? null : wiersz.dataset.post; tabela(); }
    };
    znajdz("#res-tabela").onkeydown = (zdarzenie) => {
      if (zdarzenie.target.matches("tr[data-post]") && ["Enter", " "].includes(zdarzenie.key)) {
        zdarzenie.preventDefault(); zdarzenie.target.click();
      }
    };
    znajdz("#res-tabela").oninput = (zdarzenie) => {
      if (!zdarzenie.target.matches("textarea[data-notatka]")) return;
      const id = zdarzenie.target.dataset.notatka;
      let wpis = stan.notatki.get(id);
      if (!wpis) { wpis = { tekst: "", zegar: null, kolejka: Promise.resolve(), wersja: 0, status: "" }; stan.notatki.set(id, wpis); }
      wpis.tekst = zdarzenie.target.value; wpis.wersja++; wpis.status = "Niezapisane zmiany";
      statusNotatki(id, wpis.status);
      clearTimeout(wpis.zegar);
      wpis.zegar = setTimeout(() => zapiszNotatke(id, wpis), 600);
    };
  }

  function statusNotatki(id, tekst) {
    const pole = znajdz("#res-notatka-status");
    if (pole && pole.dataset.id === id) pole.textContent = tekst;
  }
  function zapiszNotatke(id, wpis) {
    const tekst = wpis.tekst;
    const wersja = wpis.wersja;
    // Kolejka dla kazdego posta zapobiega nadpisaniu nowszej notatki starszym zapisem.
    wpis.kolejka = wpis.kolejka.then(async () => {
      try {
        await api("/notatka", { id, tekst });
        if (wpis.wersja === wersja) { wpis.status = "Zapisano"; statusNotatki(id, wpis.status); }
      } catch (blad) {
        wpis.status = "Nie zapisano. Zmień tekst, aby ponowić zapis.";
        statusNotatki(id, wpis.status); komunikat(blad.message);
      }
    });
  }

  async function wczytaj() {
    stan.dane = await api("");
    if (!Array.from(znajdz("#res-prog").options).some((opcja) => Number(opcja.value) === stan.dane.ustawienia.prog)) {
      const opcja = document.createElement("option");
      opcja.value = String(stan.dane.ustawienia.prog);
      opcja.textContent = liczba(stan.dane.ustawienia.prog) + "×";
      znajdz("#res-prog").appendChild(opcja);
    }
    znajdz("#res-prog").value = String(stan.dane.ustawienia.prog);
    znajdz("#res-pusto").hidden = stan.dane.konta.length > 0;
    if (!stan.dane.konta.some((konto) => konto.username === stan.konto)) stan.konto = "";
    znajdz("#res-filtr").innerHTML = '<option value="">Wszystkie konta</option>' + stan.dane.konta.map((konto) => `<option value="${bezpiecznyTekst(konto.username)}">@${bezpiecznyTekst(konto.username)}</option>`).join("");
    znajdz("#res-filtr").value = stan.konto;
    znajdz("#res-konta").innerHTML = stan.dane.konta.map((konto) => `<div class="kafelek res-konto">
      ${adres(konto.avatar) ? `<img src="${adres(konto.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div><strong>@${bezpiecznyTekst(konto.username)}</strong><div class="pod">${liczba(konto.obserwujacy)} obserwujących · ${liczba(konto.media_count)} postów</div>
      <div class="pod">Pobrano: ${data(konto.ostatnie_pobranie)}</div>${konto.blad ? `<div class="komunikat blad">${bezpiecznyTekst(konto.blad)}</div>` : ""}</div>
      <button class="przycisk" data-usun="${bezpiecznyTekst(konto.username)}" aria-label="Usuń @${bezpiecznyTekst(konto.username)}">×</button></div>`).join("");
    tabela(); blokady();
  }

  function panel(post) {
    const wpis = stan.notatki.get(post.id);
    const tekst = wpis ? wpis.tekst : stan.dane.notatki[post.id] || "";
    return `<tr class="res-szczegoly"><td colspan="8"><div class="res-panel">
      ${adres(post.miniatura) ? `<img src="${adres(post.miniatura)}" alt="Miniatura publikacji" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="res-tresc"><p class="res-opis">${bezpiecznyTekst(post.opis)}</p>
      ${adres(post.permalink) ? `<a href="${adres(post.permalink)}" target="_blank" rel="noopener noreferrer">Otwórz na Instagramie</a>` : ""}
      <p class="pod">Mediana konta: ${liczba(post.mediana_konta)} interakcji${post.bez_polubien ? ". Polubienia ukryte, wynik uwzględnia tylko komentarze" : ""}.</p>
      <label>Notatka<textarea maxlength="50000" data-notatka="${bezpiecznyTekst(post.id)}">${bezpiecznyTekst(tekst)}</textarea></label>
      <div class="pod" id="res-notatka-status" data-id="${bezpiecznyTekst(post.id)}" role="status">${bezpiecznyTekst(wpis?.status || "")}</div></div></div></td></tr>`;
  }
  function tabela() {
    const posty = Object.values(stan.dane.posty).flat().filter((post) => post.odstajacy && (!stan.rolki || post.typ === "rolka") &&
      (!stan.konto || stan.konto === post.username) && post.tytul.toLocaleLowerCase("pl-PL").includes(stan.szukaj));
    posty.sort((a, b) => {
      const lewy = stan.sort === "sygnal" ? Number(a.swiezy) : stan.sort === "data" ? Date.parse(a.data) : a[stan.sort];
      const prawy = stan.sort === "sygnal" ? Number(b.swiezy) : stan.sort === "data" ? Date.parse(b.data) : b[stan.sort];
      if (lewy == null) return prawy == null ? 0 : 1;
      if (prawy == null) return -1;
      return (typeof lewy === "number" ? lewy - prawy : String(lewy).localeCompare(String(prawy), "pl")) * stan.kierunek;
    });
    const kolumny = [["data", "Data"], ["username", "Konto"], ["tytul", "Tytuł"], ["typ", "Typ"], ["polubienia", "Polubienia"], ["komentarze", "Komentarze"], ["krotnosc", "Krotność"], ["sygnal", "Sygnał"]];
    znajdz("#res-tabela").innerHTML = `<table class="tabela"><thead><tr>${kolumny.map(([klucz, tytul]) => `<th aria-sort="${stan.sort === klucz ? stan.kierunek === 1 ? "ascending" : "descending" : "none"}"><button data-sort="${klucz}">${tytul}${stan.sort === klucz ? stan.kierunek === 1 ? " ↑" : " ↓" : ""}</button></th>`).join("")}</tr></thead><tbody>${posty.length ? posty.map((post) => `<tr tabindex="0" data-post="${bezpiecznyTekst(post.id)}" aria-expanded="${stan.wybrany === post.id}">
      <td>${data(post.data)}</td><td>@${bezpiecznyTekst(post.username)}</td><td class="res-tytul" title="${bezpiecznyTekst(post.tytul)}">${bezpiecznyTekst(post.tytul || "Bez opisu")}</td>
      <td>${bezpiecznyTekst(post.typ)}</td><td>${post.bez_polubien ? "ukryte" : liczba(post.polubienia)}</td><td>${liczba(post.komentarze)}</td><td>${liczba(post.krotnosc)}×</td>
      <td><span class="sygnal dobry">Ponad próg</span> ${post.swiezy ? '<span class="sygnal">świeże</span>' : ""}</td></tr>${stan.wybrany === post.id ? panel(post) : ""}`).join("") : '<tr><td colspan="8" class="pusto">Brak publikacji ponad próg dla wybranych filtrów.</td></tr>'}</tbody></table>`;
  }

  async function sprawdzPostep() {
    clearTimeout(stan.petla);
    try {
      const postep = await api("/postep");
      const bylo = stan.w_toku;
      stan.w_toku = postep.w_toku;
      znajdz("#res-postep").innerHTML = postep.w_toku ? `<progress max="${Math.max(1, postep.razem)}" value="${postep.zrobione}"></progress><span class="pod">${liczba(postep.zrobione)} / ${liczba(postep.razem)} ${bezpiecznyTekst(postep.konto ? "@" + postep.konto : "")}</span>` : "";
      blokady();
      if (bylo && !postep.w_toku) await wczytaj();
      if (!postep.w_toku && postep.blad) komunikat(postep.blad);
    } catch (blad) { komunikat(blad.message); }
    finally { stan.petla = setTimeout(sprawdzPostep, 1200); }
  }
  async function start() {
    if (stan.uruchomiony) return;
    stan.uruchomiony = true;
    szkielet();
    try { await wczytaj(); } catch (blad) { komunikat(blad.message); }
    await sprawdzPostep();
  }
  return { start };
})();
