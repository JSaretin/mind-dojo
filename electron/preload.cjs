const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	// Directory picker
	pickDirectory: () => ipcRenderer.invoke('pick-directory'),

	// File operations for vault sync
	readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
	readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
	writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
	deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
	fileExists: (dirPath) => ipcRenderer.invoke('file-exists', dirPath),
});
