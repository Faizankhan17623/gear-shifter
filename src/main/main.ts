import { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeTheme } from 'electron';
import path from 'node:path';
import { createAppIcon, createTrayIcon } from './icon';
import { getGearConfig, setGearConfig, resetGearConfig } from './store';
import { buildModelCommand } from '../shared/models';
import { getActiveWindow, keyboard, Key, type Window } from '@nut-tree-fork/nut-js';

const isDev = !app.isPackaged && process.env.ELECTRON_START_URL !== undefined;

// nut-js defaults to a 300ms delay between simulated keystrokes (meant for
// human-like typing simulation in test automation) — for typing a ~25
// character /model command that's 6-7+ seconds, which reads as a hang from
// the UI's perspective. A very low delay (single-digit ms) was tested and
// found to occasionally drop characters in the target app, presumably
// because keystrokes were queued faster than the target window's input
// handling could keep up. 25ms is a middle ground: still well under a
// second for the whole command, but slow enough to be reliably delivered.
keyboard.config.autoDelayMs = 25;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// The OS window that was focused right before Gear Shifter's own window took
// focus — presumptively the user's terminal. Electron has no "give me the
// previously focused window" API, and a window that's about to take focus
// via a new BrowserWindow generally grabs OS focus atomically — there is no
// reliable race-window immediately around window creation/blur to poll for
// the outgoing window. Instead we continuously track whatever window is
// active WHENEVER it isn't Gear Shifter itself, on a fast, always-on
// interval. In practice this means: while the user is working in their
// terminal (which is most of the time Gear Shifter is idle in the
// background/tray), that terminal is continuously recorded, so by the time
// they switch to Gear Shifter to shift a gear, the most recent sample is
// almost always still their terminal.
let lastExternalWindow: Window | null = null;
let trackerTimer: ReturnType<typeof setInterval> | null = null;

function ownWindowTitle(): string {
  return mainWindow?.getTitle() ?? 'Gear Shifter';
}

// Transient OS chrome that can briefly report as the "active window" during
// a focus transition (Alt-Tab overlay, the Windows task-switching surface,
// empty titles from windows still initializing, etc.) — never a real target
// to type into, so these are excluded even though they aren't Gear Shifter.
const IGNORED_WINDOW_TITLES = ['Task Switching', 'Task View', 'Program Manager'];

function isCapturableWindow(title: string): boolean {
  if (title.trim() === '') return false;
  if (title.includes(ownWindowTitle())) return false;
  if (IGNORED_WINDOW_TITLES.some((ignored) => title.includes(ignored))) return false;
  return true;
}

function startExternalWindowTracking(): void {
  if (trackerTimer) return;
  trackerTimer = setInterval(async () => {
    try {
      const active = await getActiveWindow();
      const title = await active.title;
      if (isCapturableWindow(title)) {
        lastExternalWindow = active;
      }
    } catch {
      // Best-effort — a transient failure just means we keep the last value.
    }
  }, 200);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 420,
    minHeight: 640,
    title: 'Gear Shifter',
    backgroundColor: '#0e0e12',
    icon: createAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  // Minimize-to-tray: hide instead of closing, unless the user is actually quitting.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Gear Shifter');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Gear Shifter',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createWindow();
  createTray();
  startExternalWindowTracking();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (trackerTimer) clearInterval(trackerTimer);
});

app.on('window-all-closed', () => {
  // Keep the app running in the tray on all platforms for this app's purpose.
  // (Standard mac-only behavior would be `if (process.platform !== 'darwin') app.quit()`,
  // but a tray-resident utility should stay alive on Windows/Linux too.)
});

// ---- IPC handlers ----

ipcMain.handle('clipboard:copy-model', (_event, modelId: string) => {
  if (typeof modelId !== 'string' || modelId.trim() === '') {
    return false;
  }
  clipboard.writeText(buildModelCommand(modelId));
  return true;
});

ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

ipcMain.handle('config:get', () => {
  return getGearConfig();
});

ipcMain.handle('config:set', (_event, config) => {
  setGearConfig(config);
  return getGearConfig();
});

ipcMain.handle('config:reset', () => {
  return resetGearConfig();
});

// Reports the title of whatever window auto-type would target, so the
// renderer can show the user an explicit "type into <this window>?"
// confirmation before anything is actually sent. Window-focus tracking on
// Windows is inherently best-effort (the OS restricts which processes can
// query/steal foreground focus), and testing showed it can occasionally
// resolve to an unexpected window — the confirmation step is the safety net
// that keeps a wrong guess from silently typing a command somewhere
// unintended, like a browser address bar or an open chat.
ipcMain.handle('autotype:get-target', async () => {
  if (!lastExternalWindow) {
    return { ok: false, reason: 'no-target-window' };
  }
  try {
    const title = await lastExternalWindow.title;
    return { ok: true, title };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown-error' };
  }
});

// Types "/model <id>" plus Enter into whatever external window was last
// focused before Gear Shifter (tracked by startExternalWindowTracking).
// This is best-effort OS-level automation, not a real integration with
// Claude Code — there is no API for that. Only call this after the
// renderer has shown the user the target window's name (via
// autotype:get-target) and they've explicitly confirmed it — this handler
// re-checks the active window right before typing as a last-moment guard,
// but that alone isn't sufficient since the wrong window can still be
// legitimately focused at that instant.
ipcMain.handle('autotype:commit', async (_event, modelId: string) => {
  if (typeof modelId !== 'string' || modelId.trim() === '') {
    return { ok: false, reason: 'invalid-model-id' };
  }
  if (!lastExternalWindow) {
    return { ok: false, reason: 'no-target-window' };
  }
  try {
    await lastExternalWindow.focus();
    // Give the OS a moment to actually complete the focus switch before
    // sending keystrokes — sending immediately can race the window manager
    // and land keystrokes on whatever still had focus a frame ago, or have
    // the first couple characters swallowed/garbled mid-transition.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const command = buildModelCommand(modelId);
    await keyboard.type(command);
    await keyboard.pressKey(Key.Enter);
    await keyboard.releaseKey(Key.Enter);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown-error' };
  }
});
