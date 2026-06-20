import { writable } from 'svelte/store';

export const updateReady = writable(false);

const CHECK_INTERVAL = 30 * 60 * 1000;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function checkForUpdate() {
	try {
		const { check } = await import('@tauri-apps/plugin-updater');
		const update = await check();
		if (!update) return;
		await update.downloadAndInstall();
		updateReady.set(true);
	} catch (e) {
		console.error('Update check failed:', e);
	}
}

export async function restartApp() {
	try {
		const { relaunch } = await import('@tauri-apps/plugin-process');
		await relaunch();
	} catch (e) {
		console.error('Relaunch failed:', e);
	}
}

export function startUpdateChecker() {
	if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

	checkForUpdate();
	intervalId = setInterval(checkForUpdate, CHECK_INTERVAL);
}

export function stopUpdateChecker() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
