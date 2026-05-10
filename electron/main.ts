import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, screen, session } from 'electron';
import * as path from 'path';
import { registerApiHandlers } from './api';
import { store } from './store';

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://localhost:5173';
const INDEX_HTML = path.join(__dirname, '..', 'dist', 'index.html');

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const getIconPath = () => app.isPackaged
  ? path.join(__dirname, '..', 'dist', 'icon.png')
  : path.join(__dirname, '..', 'public', 'icon.png');

function loadRoute(win: BrowserWindow, route: string) {
  if (isDev) {
    win.loadURL(`${DEV_URL}#${route}`);
  } else {
    win.loadFile(INDEX_HTML, { hash: route });
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#16161E',
    show: false,
    autoHideMenuBar: true,
    title: 'DeepSeek Monitor',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRoute(mainWindow, '/');

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (e) => {
    // Hide to tray instead of quitting
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatWindow() {
  if (floatWindow) {
    floatWindow.show();
    floatWindow.focus();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const winWidth = 300;
  const winHeight = 360;

  const saved = store.get('floatBounds') as { x: number; y: number } | undefined;

  floatWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: saved?.x ?? width - winWidth - 24,
    y: saved?.y ?? 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatWindow.setAlwaysOnTop(true, 'floating');

  loadRoute(floatWindow, '/float');

  floatWindow.on('moved', () => {
    if (!floatWindow) return;
    const [x, y] = floatWindow.getPosition();
    store.set('floatBounds', { x, y });
  });

  floatWindow.on('closed', () => {
    floatWindow = null;
  });
}

function createTray() {
  // Use actual icon for tray
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('DeepSeek Monitor');
  const menu = Menu.buildFromTemplate([
    {
      label: '打开主面板',
      click: () => {
        if (!mainWindow) createMainWindow();
        else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '显示悬浮窗',
      click: () => createFloatWindow(),
    },
    {
      label: '隐藏悬浮窗',
      click: () => floatWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!mainWindow) createMainWindow();
    else {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// IPC: window control
ipcMain.handle('win:min', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle('win:hide', (e) => BrowserWindow.fromWebContents(e.sender)?.hide());

ipcMain.handle('float:show', () => createFloatWindow());
ipcMain.handle('float:hide', () => floatWindow?.hide());
ipcMain.handle('float:toggle', () => {
  if (!floatWindow || floatWindow.isDestroyed()) createFloatWindow();
  else floatWindow.isVisible() ? floatWindow.hide() : floatWindow.show();
});

ipcMain.handle('main:show', () => {
  if (!mainWindow) createMainWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('open:external', (_e, url: string) => shell.openExternal(url));

// Login window: lets the user sign in to platform.deepseek.com,
// then we harvest cookies for authenticated API requests.
ipcMain.handle('auth:loginDeepSeek', async () => {
  return new Promise<{ ok: boolean; cookie?: string; error?: string }>((resolve) => {
    loginWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: '登录 DeepSeek',
      autoHideMenuBar: true,
      backgroundColor: '#16161E',
      webPreferences: {
        partition: 'persist:deepseek',
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    loginWindow.loadURL('https://platform.deepseek.com/sign_in');

    const check = async () => {
      if (!loginWindow) return;
      const url = loginWindow.webContents.getURL();
      if (url.includes('platform.deepseek.com') && !url.includes('sign_in')) {
        try {
          const ses = session.fromPartition('persist:deepseek');
          const cookies = await ses.cookies.get({ domain: '.deepseek.com' });
          const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
          store.set('deepseekCookie', cookieStr);
          loginWindow?.close();
          resolve({ ok: true, cookie: cookieStr });
        } catch (err: any) {
          resolve({ ok: false, error: err?.message ?? String(err) });
        }
      }
    };

    loginWindow.webContents.on('did-navigate', check);
    loginWindow.webContents.on('did-navigate-in-page', check);

    loginWindow.on('closed', () => {
      loginWindow = null;
      resolve({ ok: false, error: '登录窗口已关闭' });
    });
  });
});

registerApiHandlers();

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // keep app alive in tray; do not quit on macOS either
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});
