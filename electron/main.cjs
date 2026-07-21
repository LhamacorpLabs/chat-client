const { app, BrowserWindow, Menu, shell, ipcMain, nativeImage, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const macUpdater = isMac ? require('./macUpdater.cjs') : null;
const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL || 'http://localhost:5173';
const buildDir = path.join(__dirname, '../build');
const appUrl = 'app://local/';

// redirectToLogin() (authRedirect.ts) navigates this window straight to the
// login UI, which redirects back to https://chat.lhamacorp.com/auth/callback
// on success - both legs must stay inside this window (same as the previous
// Tauri build, which had no navigation guard) or the OAuth round trip
// finishes in the system browser instead of coming back to the app.
const authNavigationOrigins = ['https://login.lhamacorp.com', 'https://chat.lhamacorp.com'];

function isAuthNavigation(url) {
	return authNavigationOrigins.some((origin) => url === origin || url.startsWith(`${origin}/`));
}

// SvelteKit's static fallback page (build/index.html) uses root-absolute
// asset paths ("/_app/...") since it must work at any URL depth on a real
// server. Those paths resolve against the filesystem root under file://,
// so we serve the build dir through a custom scheme instead - it behaves
// like an http root, and unmatched paths fall back to index.html for
// client-side routing.
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
	}
]);

// No custom menu is needed - the app is fully controlled through its own UI,
// so drop Electron's default File/Edit/View/Window menu bar entirely.
Menu.setApplicationMenu(null);

let mainWindow = null;

// Small on-disk JSON store (mirrors the durable file-backed store the
// Tauri build used) - keeps auth data available across restarts even if
// localStorage inside the renderer doesn't persist reliably.
const storeFile = path.join(app.getPath('userData'), 'auth.json');

function readStore() {
	try {
		return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
	} catch {
		return {};
	}
}

function writeStore(data) {
	fs.mkdirSync(path.dirname(storeFile), { recursive: true });
	fs.writeFileSync(storeFile, JSON.stringify(data), 'utf8');
}

function createWindow() {
	mainWindow = new BrowserWindow({
		title: 'Chat',
		width: 800,
		height: 600,
		resizable: true,
		fullscreen: false,
		icon: path.join(__dirname, '../build-resources/icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});

	// window.open()/target=_blank must open in the OS browser, not a second
	// app window - deny in-app window creation and hand the URL to shell.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	mainWindow.webContents.on('will-navigate', (event, url) => {
		if (isDev && url.startsWith(devServerUrl)) return;
		if (!isDev && url.startsWith('app://')) return;
		if (isAuthNavigation(url)) return;
		event.preventDefault();
		shell.openExternal(url);
	});

	if (isDev) {
		mainWindow.loadURL(devServerUrl);
	} else {
		mainWindow.loadURL(appUrl);
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

ipcMain.handle('store:get', (_event, key) => readStore()[key]);
ipcMain.handle('store:set', (_event, key, value) => {
	const data = readStore();
	data[key] = value;
	writeStore(data);
});
ipcMain.handle('store:delete', (_event, key) => {
	const data = readStore();
	delete data[key];
	writeStore(data);
});

ipcMain.handle('shell:open-external', (_event, url) => shell.openExternal(url));

ipcMain.handle('badge:set', (_event, count) => {
	const unread = typeof count === 'number' && count > 0 ? count : 0;

	if (process.platform === 'darwin' || process.platform === 'linux') {
		app.setBadgeCount(unread);
		return;
	}

	if (process.platform === 'win32' && mainWindow) {
		if (unread > 0) {
			const dot = nativeImage.createFromPath(path.join(__dirname, '../build-resources/overlay-dot.png'));
			mainWindow.setOverlayIcon(dot, `${unread} unread message${unread === 1 ? '' : 's'}`);
		} else {
			mainWindow.setOverlayIcon(null, '');
		}
	}
});

// macOS auto-update bypasses electron-updater/Squirrel.Mac entirely (see
// macUpdater.cjs) because Squirrel.Mac requires a paid Apple Developer ID
// signature to validate updates. Windows keeps the electron-updater/NSIS
// path below, unchanged.
if (!isMac) {
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = false;

	autoUpdater.on('update-downloaded', () => {
		mainWindow?.webContents.send('updater:ready');
	});

	autoUpdater.on('error', (error) => {
		console.error('Auto updater error:', error);
	});
}

ipcMain.handle('updater:check', async () => {
	if (isDev) return false;
	if (isMac) return macUpdater.checkForUpdate(mainWindow);
	try {
		const result = await autoUpdater.checkForUpdates();
		return !!result;
	} catch (error) {
		console.error('Update check failed:', error);
		return false;
	}
});

ipcMain.handle('updater:quit-and-install', () => {
	if (isMac) {
		macUpdater.quitAndInstall();
		return;
	}
	autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
	protocol.handle('app', (request) => {
		const { pathname } = new URL(request.url);
		let filePath = path.normalize(path.join(buildDir, decodeURIComponent(pathname)));

		if (!filePath.startsWith(buildDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
			filePath = path.join(buildDir, 'index.html');
		}

		return net.fetch(pathToFileURL(filePath).toString());
	});

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
