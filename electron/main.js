import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
		},
	},
]);

function createWindow() {
	const iconPath = path.join(app.getAppPath(), 'build', 'fav_512.png');
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

	protocol.handle('app', (request) => {
		const url = new URL(request.url);
		let pathname = decodeURIComponent(url.pathname);
		if (pathname === '/' || pathname === '') {
			pathname = '/index.html';
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
