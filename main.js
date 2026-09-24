"use strict";

// Aplikacja desktopowa "Studio" (Electron). Startuje wbudowany serwer (serwer.js)
// i otwiera jedno okno. Wzor: C:\Users\pc\Desktop\skrypty\main.js.

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { start } = require("./serwer.js");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [okno] = BrowserWindow.getAllWindows();
    if (okno) {
      if (okno.isMinimized()) okno.restore();
      okno.focus();
    }
  });
}

app.setAppUserModelId("pl.kuba.studio");

const PLIK_OKNA = path.join(app.getPath("userData"), "okno.json");

function wczytajOkno() {
  try {
    return JSON.parse(fs.readFileSync(PLIK_OKNA, "utf8"));
  } catch {
    return {};
  }
}

function zapamietajOkno(okno) {
  try {
    const dane = { ...okno.getNormalBounds(), maksymalizowane: okno.isMaximized() };
    fs.writeFileSync(PLIK_OKNA, JSON.stringify(dane));
  } catch {
    /* brak zapisu polozenia to nie problem */
  }
}

async function utworzOkno() {
  const { adres } = await start({ katalog: __dirname });
  const zapamietane = wczytajOkno();

  const okno = new BrowserWindow({
    width: zapamietane.width || 1480,
    height: zapamietane.height || 960,
    x: zapamietane.x,
    y: zapamietane.y,
    minWidth: 980,
    minHeight: 640,
    title: "Studio",
    icon: path.join(__dirname, "ikona.ico"),
    backgroundColor: "#0E0E12",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  okno.removeMenu();
  okno.webContents.session.setSpellCheckerLanguages(["pl", "en-US"]);

  okno.once("ready-to-show", () => {
    if (zapamietane.maksymalizowane) okno.maximize();
    okno.show();
  });
  okno.on("close", () => zapamietajOkno(okno));

  // Linki (np. do rolki na Instagramie) ida do zwyklej przegladarki.
  okno.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  okno.loadURL(adres);
}

app.whenReady().then(utworzOkno);

app.on("window-all-closed", () => {
  app.quit();
});
