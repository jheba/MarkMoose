const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onFileOpened: (callback) => {
    ipcRenderer.removeAllListeners("file-opened");
    ipcRenderer.on("file-opened", (_event, data) => callback(data));
  },
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke("save-file", filePath, content),
  saveFileDialog: (content) => ipcRenderer.invoke("save-file-dialog", content),
  getVersion: () => ipcRenderer.invoke("get-version"),
  showSavePrompt: () => ipcRenderer.invoke("show-save-prompt"),
  confirmClose: () => ipcRenderer.send("safe-to-close"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openImageDialog: () => ipcRenderer.invoke("open-image-dialog"),
  onMenuNewFile: (callback) => {
    ipcRenderer.removeAllListeners("menu-new-file");
    ipcRenderer.on("menu-new-file", () => callback());
  },
  onMenuSave: (callback) => {
    ipcRenderer.removeAllListeners("menu-save");
    ipcRenderer.on("menu-save", () => callback());
  },
  onMenuAbout: (callback) => {
    ipcRenderer.removeAllListeners("menu-about");
    ipcRenderer.on("menu-about", () => callback());
  },
  onMenuHelp: (callback) => {
    ipcRenderer.removeAllListeners("menu-help");
    ipcRenderer.on("menu-help", () => callback());
  },
  onCheckBeforeClose: (callback) => {
    ipcRenderer.removeAllListeners("check-before-close");
    ipcRenderer.on("check-before-close", () => callback());
  },
  print: () => ipcRenderer.invoke("print"),
  exportPdf: () => ipcRenderer.invoke("export-pdf"),
  onMenuSaveAs: (callback) => {
    ipcRenderer.removeAllListeners("menu-save-as");
    ipcRenderer.on("menu-save-as", () => callback());
  },
  onMenuPrint: (callback) => {
    ipcRenderer.removeAllListeners("menu-print");
    ipcRenderer.on("menu-print", () => callback());
  },
  onMenuExportPdf: (callback) => {
    ipcRenderer.removeAllListeners("menu-export-pdf");
    ipcRenderer.on("menu-export-pdf", () => callback());
  },
});
