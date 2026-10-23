const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const APP_URL = "https://44-english-app.pages.dev/";
const APP_ORIGIN = new URL(APP_URL).origin;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    title: "Words 44",
    backgroundColor: "#101126",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === "https:" && target.origin === APP_ORIGIN) {
        return { action: "allow" };
      }
      if (target.protocol === "https:") shell.openExternal(url);
    } catch (_) {}
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    try {
      const target = new URL(url);
      if (target.origin !== APP_ORIGIN && target.hostname !== "accounts.google.com" && target.hostname !== "pamebquqyvlzpznfrrvt.supabase.co") {
        event.preventDefault();
        if (target.protocol === "https:") shell.openExternal(url);
      }
    } catch (_) {
      event.preventDefault();
    }
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.words44.desktop");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
