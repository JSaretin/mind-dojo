import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

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
		},
	});
	win.setMenuBarVisibility(false);

	if (process.env.VITE_DEV_SERVER_URL) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		win.loadURL('app://./');
	}
}

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
