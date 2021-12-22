const { app, BrowserWindow } = require("electron");
const electronDl = require("electron-dl");

electronDl();

const createWindow = () => {
  const win = new BrowserWindow({
    minWidth: 960,
    minHeight: 640,
    width: 960,
    height: 640,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile("build/index.html");
  } else {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  }
};

app.whenReady().then(() => {
  createWindow();

  // quit the app when all window ad close (windows & linux)
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  // open a window if none are open (macOS)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
