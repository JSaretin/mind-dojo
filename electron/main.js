import { app, BrowserWindow, protocol, net, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true,
		},
	},
]);

function createWindow() {
	// Icon may be in asar.unpacked for proper display
	const unpackedIcon = path.join(app.getAppPath() + '.unpacked', 'build', 'fav_512.png');
	const asarIcon = path.join(app.getAppPath(), 'build', 'fav_512.png');
	const iconPath = fs.existsSync(unpackedIcon) ? unpackedIcon : asarIcon;

	const win = new BrowserWindow({
		fullscreen: true,
		autoHideMenuBar: true,
		icon: iconPath,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.cjs'),
		},
	});
	win.setMenuBarVisibility(false);

	if (process.env.VITE_DEV_SERVER_URL) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		win.loadURL('app://./');
	}
}

// ── IPC Handlers ──

ipcMain.handle('pick-directory', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openDirectory', 'createDirectory'],
		title: 'Select Journal Vault Directory',
	});
	if (result.canceled || result.filePaths.length === 0) return null;
	return result.filePaths[0];
});

ipcMain.handle('read-dir', async (_event, dirPath) => {
	try {
		const entries = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
		return { ok: true, files: entries };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
});

ipcMain.handle('read-file', async (_event, filePath) => {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		return { ok: true, content };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
	try {
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(filePath, content, 'utf-8');
		return { ok: true };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
});

ipcMain.handle('delete-file', async (_event, filePath) => {
	try {
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
		return { ok: true };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
});

ipcMain.handle('file-exists', async (_event, filePath) => {
	return fs.existsSync(filePath);
});

// ── App Lifecycle ──

app.whenReady().then(() => {
	const buildPath = path.join(app.getAppPath(), 'build');
	const unpackedBuildPath = path.join(app.getAppPath() + '.unpacked', 'build');

	protocol.handle('app', (request) => {
		const url = new URL(request.url);
		let pathname = decodeURIComponent(url.pathname);
		if (pathname === '/' || pathname === '') {
			pathname = '/index.html';
		}

		// For unpacked files (wav, png), serve from the unpacked directory
		const unpackedPath = path.join(unpackedBuildPath, pathname);
		if (fs.existsSync(unpackedPath)) {
			return net.fetch(pathToFileURL(unpackedPath).toString());
		}

		const filePath = path.join(buildPath, pathname);
		return net.fetch(pathToFileURL(filePath).toString());
	});

	createWindow();
});

app.on('window-all-closed', () => {
	app.quit();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
