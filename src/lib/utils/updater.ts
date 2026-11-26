import { writable } from 'svelte/store';

export const updateReady = writable(false);

const CHECK_INTERVAL = 30 * 60 * 1000;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getElectronAPI() {
	if (typeof window === 'undefined') return undefined;
	return window.electronAPI;
}

/** Resolves to false when the check could not run (no desktop app, or it threw). */
export async function checkForUpdate(): Promise<boolean> {
	const electronAPI = getElectronAPI();
	if (!electronAPI) return false;

	try {
		await electronAPI.updater.check();
		return true;
	} catch (e) {
		console.error('Update check failed:', e);
		return false;
	}
}

export async function restartApp() {
	const electronAPI = getElectronAPI();
	if (!electronAPI) return;

	try {
		await electronAPI.updater.quitAndInstall();
	} catch (e) {
		console.error('Relaunch failed:', e);
	}
}

export function startUpdateChecker() {
	const electronAPI = getElectronAPI();
	if (!electronAPI) return;

	electronAPI.updater.onReady(() => updateReady.set(true));

	checkForUpdate();
	intervalId = setInterval(checkForUpdate, CHECK_INTERVAL);
}

export function stopUpdateChecker() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
