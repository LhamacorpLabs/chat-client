const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	isElectron: true,

	openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

	store: {
		get: (key) => ipcRenderer.invoke('store:get', key),
		set: (key, value) => ipcRenderer.invoke('store:set', key, value),
		delete: (key) => ipcRenderer.invoke('store:delete', key)
	},

	badge: {
		set: (count) => ipcRenderer.invoke('badge:set', count)
	},

	updater: {
		check: () => ipcRenderer.invoke('updater:check'),
		quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
		onReady: (callback) => {
			ipcRenderer.on('updater:ready', () => callback());
		}
	}
});
