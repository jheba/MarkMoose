const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Handle single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let splashWindow = null;
let fileToOpen = null;

function getFileFromArgs(args) {
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (
      !arg.startsWith("-") &&
      !arg.startsWith("--") &&
      (arg.endsWith(".md") || arg.endsWith(".markdown"))
    ) {
      if (fs.existsSync(arg)) return arg;
    }
  }
  return null;
}

function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "build-resources", "icon.ico");
  }
  return path.join(__dirname, "..", "build-resources", "icon.ico");
}

// ── Splash screen ──────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 360,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Resolve icon path and pass as query param so splash can display it
  const iconPath = getIconPath().replace('.ico', '.png');
  const splashPath = path.join(__dirname, "splash.html");
  splashWindow.loadURL(`file://${splashPath}?icon=${encodeURIComponent(iconPath)}`);
  splashWindow.center();

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

// ── Main window ────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: "MarkMoose Markdown Editor",
    show: false,
    backgroundColor: "#fafaf8",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+T",
          click: () => mainWindow?.webContents.send("menu-new-file"),
        },
        { label: "Open File...", accelerator: "CmdOrCtrl+O", click: () => handleOpenFile() },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu-save"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow?.webContents.send("menu-save-as"),
        },
        { type: "separator" },
        {
          label: "Export to PDF...",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.send("menu-export-pdf"),
        },
        { type: "separator" },
        { label: "New Window", accelerator: "CmdOrCtrl+N", click: () => createWindow() },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" }, { role: "redo" }, { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" }, { role: "togglefullscreen" },
        ...(isDev ? [{ type: "separator" }, { role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Features & Shortcuts",
          click: () => mainWindow?.webContents.send("menu-help"),
        },
        { type: "separator" },
        {
          label: "Rate in Microsoft Store",
          click: () => {
            const { shell } = require("electron");
            shell.openExternal("ms-windows-store://review/?productid=9NJPG77756D4");
          },
        },
        { type: "separator" },
        {
          label: "About MarkMoose",
          click: () => mainWindow?.webContents.send("menu-about"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // When ready: close splash, show main, send pending file
  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      mainWindow.show();

      if (fileToOpen) {
        sendFileToRenderer(fileToOpen);
        fileToOpen = null;
      }
    }, 1000);
  });

  // Prompt to save on close
  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow.webContents.send("check-before-close");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendFileToRenderer(filePath) {
  if (!mainWindow) return;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const name = path.basename(filePath);
    mainWindow.webContents.send("file-opened", { name, content, path: filePath });
    mainWindow.setTitle(`${name} — MarkMoose Markdown Editor`);
  } catch (err) {
    console.error("Failed to read file:", err);
  }
}

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Markdown File",
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    sendFileToRenderer(result.filePaths[0]);
  }
}

// ── App lifecycle ──────────────────────────────────────────────────

fileToOpen = getFileFromArgs(process.argv);

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();
});

app.on("second-instance", (_event, argv) => {
  const file = getFileFromArgs(argv);
  if (file && mainWindow) {
    sendFileToRenderer(file);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    sendFileToRenderer(filePath);
  } else {
    fileToOpen = filePath;
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

ipcMain.handle("open-file-dialog", () => handleOpenFile());

ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { content, name: path.basename(filePath) };
  } catch {
    return null;
  }
});

ipcMain.handle("save-file", async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    const name = path.basename(filePath);
    mainWindow?.setTitle(`${name} — MarkMoose Markdown Editor`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("save-file-dialog", async (_event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Markdown File",
    filters: [
      { name: "Markdown", extensions: ["md"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, content, "utf-8");
      const name = path.basename(result.filePath);
      mainWindow?.setTitle(`${name} — MarkMoose Markdown Editor`);
      return { success: true, path: result.filePath, name };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return null;
});

ipcMain.handle("get-version", () => {
  return app.getVersion();
});

ipcMain.handle("open-image-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Insert Image",
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("open-external", async (_event, url) => {
  const { shell } = require("electron");
  await shell.openExternal(url);
});

ipcMain.handle("export-pdf", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export to PDF",
    defaultPath: "document.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!result.canceled && result.filePath) {
    try {
      const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        marginsType: 0,
      });
      fs.writeFileSync(result.filePath, data);
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return null;
});

ipcMain.on("safe-to-close", () => {
  if (mainWindow) {
    mainWindow.removeAllListeners("close");
    mainWindow.close();
  }
});

ipcMain.handle("show-save-prompt", async (_event, fileName) => {
  const name = fileName || "Untitled";
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved Changes",
    message: `"${name}" has unsaved changes. Do you want to save?`,
  });
  return result.response;
});
